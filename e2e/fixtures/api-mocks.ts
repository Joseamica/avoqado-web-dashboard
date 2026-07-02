import { Page } from '@playwright/test'
import {
  StaffRole,
  MockSessionVenue,
  MockPlanState,
  MockSeatStatus,
  MockDowngradePreview,
  MockVenueFeatureStatus,
  createMockVenue,
  createMockUser,
  createAuthStatusResponse,
  createMockPlanState,
  createMockSeatStatus,
  createMockDowngradePreview,
  createMockVenueFeatureStatus,
  DEFAULT_ROLE_CONFIGS,
  VENUE_ALPHA,
  VENUE_BETA,
} from './mock-data'

// ─── Types ──────────────────────────────────────────────────────

export interface SetupApiMocksOptions {
  /** The role the logged-in user has. Default: OWNER */
  userRole?: StaffRole
  /** Override venues. Defaults to [VENUE_ALPHA, VENUE_BETA] */
  venues?: MockSessionVenue[]
  /** Shortcut: number of venues to auto-generate instead of providing `venues`. */
  venueCount?: number
  /**
   * Override the base-plan state served by GET /venues/:id/plan.
   * DEFAULT IS PERMISSIVE (`grandfathered: true`) so legacy tests keep the
   * pre-tier behavior (no paywalls, no sidebar badges, no seat cap).
   * Tier tests pass e.g. `{ planTier: 'GRATIS', grandfathered: false }` (Free)
   * or `{ hasPlan: true, state: 'active', planTier: 'PRO', grandfathered: false }` (Pro).
   */
  planState?: Partial<MockPlanState>
  /** Override GET /venues/:id/plan/seat-status. Default: unlimited seats, invites allowed. */
  seatStatus?: Partial<MockSeatStatus>
  /** Override GET /venues/:id/plan/downgrade-preview. Default: `required: false`. */
  downgradePreview?: Partial<MockDowngradePreview>
  /** Override GET /venues/:id/features. Default: no à-la-carte feature grants. */
  venueFeatures?: Partial<MockVenueFeatureStatus>
}

// ─── Setup ──────────────────────────────────────────────────────

/**
 * Intercepts all API calls the Teams page makes so that
 * Playwright tests run without a real backend.
 *
 * IMPORTANT: Playwright routes use LIFO matching — the LAST registered
 * route is checked FIRST. So we register the catch-all first (lowest
 * priority) and specific routes after (highest priority).
 */
export async function setupApiMocks(page: Page, options: SetupApiMocksOptions = {}) {
  const {
    userRole = StaffRole.OWNER,
    venueCount,
  } = options

  // Build venue list
  let venues = options.venues ?? [VENUE_ALPHA, VENUE_BETA]
  if (venueCount !== undefined) {
    venues = Array.from({ length: venueCount }, (_, i) =>
      createMockVenue({
        id: `venue-gen-${i}`,
        name: `Venue ${i + 1}`,
        slug: `venue-gen-${i}`,
      }),
    )
  }

  // Assign userRole to each venue
  const venuesWithRole = venues.map((v) => ({ ...v, role: userRole }))

  const user = createMockUser(userRole, venuesWithRole)
  const authResponse = createAuthStatusResponse(user)

  // ── 1. Catch-all FIRST (lowest priority in LIFO) ─────────────
  await page.route('**/api/v1/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    }),
  )

  // ── 2. Specific routes AFTER (higher priority in LIFO) ───────

  // Plan-tier / billing endpoints. The frontend unwraps `response.data.data`
  // (features.service.ts), so every body is wrapped in { success, data }.
  // These globs match whole URLs, so `**/plan` does NOT swallow `/plan/seat-status`.
  const planState = createMockPlanState(options.planState)
  await page.route('**/api/v1/dashboard/venues/*/plan', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: planState }),
    }),
  )

  // Plan-tier gating signal — GET /venues/:id/plan-tier → { tier, grandfathered, exempt }.
  // SOURCE OF TRUTH for useVenueTier() / FeatureGate (readable by every role; the gate migrated
  // here from /plan on 2026-06-13). Derived from the SAME planState so page paywalls AND sidebar
  // tier badges resolve correctly. Without this route getVenuePlanTierInfo() falls through to the
  // catch-all → planTierInfo undefined → fail-open → gated features wrongly appear UNLOCKED.
  const planTierInfo = {
    tier: !planState.planTier || planState.planTier === 'GRATIS' ? 'FREE' : planState.planTier,
    grandfathered: planState.grandfathered === true,
    // exempt = grandfathered OR demo; demo venues are exercised via venue.status (the hook's
    // isDemoVenue check), so deriving exempt from grandfathered alone is correct for the fixture.
    exempt: planState.grandfathered === true,
  }
  await page.route('**/api/v1/dashboard/venues/*/plan-tier', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: planTierInfo }),
    }),
  )

  const seatStatus = createMockSeatStatus(options.seatStatus)
  await page.route('**/api/v1/dashboard/venues/*/plan/seat-status', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: seatStatus }),
    }),
  )

  const downgradePreview = createMockDowngradePreview(options.downgradePreview)
  await page.route('**/api/v1/dashboard/venues/*/plan/downgrade-preview', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: downgradePreview }),
    }),
  )

  // Venue feature grants (à-la-carte) — consumed by useVenueTier() alongside /plan.
  const venueFeatures = createMockVenueFeatureStatus({
    venueId: venuesWithRole[0]?.id,
    venueName: venuesWithRole[0]?.name,
    ...options.venueFeatures,
  })
  await page.route('**/api/v1/dashboard/venues/*/features', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: venueFeatures }),
    }),
  )

  // White-label config
  await page.route('**/api/v1/dashboard/venues/*/white-label*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ enabled: false, features: [] }),
    }),
  )

  // Invite team member (POST) + team members fallback (GET /team)
  await page.route('**/api/v1/dashboard/venues/*/team', (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Invitation sent',
          invitation: {
            id: 'inv-001',
            email: 'invited@test.com',
            role: StaffRole.ADMIN,
            status: 'PENDING',
            expiresAt: '2026-03-16T00:00:00.000Z',
            createdAt: '2026-02-16T00:00:00.000Z',
          },
          emailSent: true,
          isTPVOnly: false,
        }),
      })
    }
    // GET /team (no query params) — empty list
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [],
        meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
      }),
    })
  })

  // Team invitations
  await page.route('**/api/v1/dashboard/venues/*/team/invitations', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    }),
  )

  // Team members (paginated — URL has query params)
  await page.route('**/api/v1/dashboard/venues/*/team?*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [],
        meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
      }),
    }),
  )

  // Role config
  await page.route('**/api/v1/dashboard/venues/*/role-config', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(DEFAULT_ROLE_CONFIGS),
    }),
  )

  // User access (permissions) — used by useAccess() hook / PermissionGate
  const primaryVenue = venuesWithRole[0]
  await page.route('**/api/v1/me/access*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        userId: user.id,
        venueId: primaryVenue.id,
        organizationId: primaryVenue.organizationId,
        role: userRole,
        corePermissions: primaryVenue.permissions,
        whiteLabelEnabled: false,
        enabledFeatures: [],
        featureAccess: {},
      }),
    }),
  )

  // Keep dashboard setup widgets from covering buttons under test.
  await page.route('**/api/v1/dashboard/venues/*/onboarding-state', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          'inventory-checklist': {
            dismissed: true,
            collapsed: true,
            steps: {},
          },
        },
      }),
    }),
  )

  // Auth status (HIGHEST priority — registered last)
  await page.route('**/api/v1/dashboard/auth/status', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(authResponse),
    }),
  )
}
