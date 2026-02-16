import { Page } from '@playwright/test'
import {
  StaffRole,
  MockSessionVenue,
  createMockVenue,
  createMockUser,
  createAuthStatusResponse,
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
  await page.route('**/api/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    }),
  )

  // ── 2. Specific routes AFTER (higher priority in LIFO) ───────

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

  // Auth status (HIGHEST priority — registered last)
  await page.route('**/api/v1/dashboard/auth/status', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(authResponse),
    }),
  )
}
