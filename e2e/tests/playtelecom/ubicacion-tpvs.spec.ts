/**
 * E2E happy-path test for the org-level "Ubicación de TPVs" (LiveLocation) page.
 *
 * Covers LiveLocation (src/pages/organizations/LiveLocation/LiveLocation.tsx),
 * mounted at /wl/organizations/:orgSlug/live-location behind OwnerProtectedRoute +
 * WLOrganizationLayout, reached via the "Ubicación de TPVs" item in the org
 * white-label sidebar (WLOrgSidebar.tsx).
 *
 * Backend surface mocked:
 *   - GET /api/v1/dashboard/organizations/:orgId/terminals-locations
 *
 * Modeled on e2e/tests/playtelecom/org-comisiones.spec.ts (same OWNER + org
 * white-label context pattern), adapted for the /wl/organizations/:orgSlug
 * mount (LiveLocation lives there, not under the legacy /organizations/:orgId
 * mount that org-comisiones.spec.ts covers).
 */

import { test, expect, Page } from '@playwright/test'
import { StaffRole, createMockVenue, createMockUser, createAuthStatusResponse, DEFAULT_ROLE_CONFIGS } from '../../fixtures/mock-data'

test.setTimeout(45_000)
test.use({ viewport: { width: 1280, height: 900 } })

// Used as both the org id AND the orgSlug in the URL — useCurrentOrganization()
// resolves orgId from orgSlug by matching allVenues[].organizationId, so a route
// slug equal to the org id resolves correctly (see use-current-organization.tsx).
const TEST_ORG_ID = 'org-playtelecom-livelocation-001'

function json(data: unknown) {
  return { status: 200, contentType: 'application/json', body: JSON.stringify(data) }
}

async function setupLiveLocationMocks(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('lang', 'es')
    } catch {
      /* ignore */
    }
  })

  const venue = createMockVenue({
    id: 'venue-bae-livelocation-001',
    name: 'BAE PAPAGAYO',
    slug: 'bae-papagayo',
    organizationId: TEST_ORG_ID,
    organization: { id: TEST_ORG_ID, name: 'PlayTelecom Ubicación' },
    modules: [
      { module: { id: 'mod-si', code: 'SERIALIZED_INVENTORY', name: 'Serialized Inventory' }, enabled: true },
      { module: { id: 'mod-wl', code: 'WHITE_LABEL_DASHBOARD', name: 'White Label Dashboard' }, enabled: true },
    ],
  })
  const venueWithRole = { ...venue, role: StaffRole.OWNER }
  const user = createMockUser(StaffRole.OWNER, [venueWithRole])

  // ── 1. Catch-all FIRST (lowest priority — LIFO) ──────────────────
  await page.route('**/api/v1/**', route => route.fulfill(json({})))

  // ── 2. Org shell endpoints (useCurrentOrganization + WLOrganizationLayout) ──
  // NOTE: organization.service.ts calls /api/v1/organizations/:orgId/(stats|venues)
  // — NOT /api/v1/dashboard/organizations/... (same as org-comisiones.spec.ts).
  await page.route(`**/api/v1/organizations/${TEST_ORG_ID}/stats`, route =>
    route.fulfill(json({ id: TEST_ORG_ID, name: 'PlayTelecom Ubicación', venueCount: 1, totalRevenue: 0, totalOrders: 0 })),
  )
  await page.route(`**/api/v1/organizations/${TEST_ORG_ID}/venues`, route => route.fulfill(json([venueWithRole])))
  await page.route('**/api/v1/notifications*', route =>
    route.fulfill(json({ data: [], meta: { total: 0, page: 1, pageSize: 20, totalPages: 0 } })),
  )
  await page.route('**/api/v1/dashboard/venues/*/role-config', route => route.fulfill(json(DEFAULT_ROLE_CONFIGS)))
  await page.route('**/api/v1/me/access*', route =>
    route.fulfill(
      json({
        userId: user.id,
        venueId: venueWithRole.id,
        organizationId: TEST_ORG_ID,
        role: StaffRole.OWNER,
        corePermissions: venueWithRole.permissions,
        whiteLabelEnabled: true,
        enabledFeatures: [],
        featureAccess: {},
      }),
    ),
  )

  // ── 3. Org terminal-locations endpoint (the page under test) ────────
  // Registered after the catch-all so LIFO gives it priority.
  await page.route(`**/api/v1/dashboard/organizations/${TEST_ORG_ID}/terminals-locations`, route =>
    route.fulfill(
      json({
        success: true,
        data: {
          terminals: [
            {
              terminalId: 't1',
              serialNumber: 'AVQD-2840744194',
              venue: { id: 'v1', name: 'BAE PAPAGAYO' },
              promoter: { staffId: 'p1', name: 'Isela Chávez' },
              latest: {
                latitude: 22.14,
                longitude: -100.97,
                accuracy: 30,
                capturedAt: new Date().toISOString(),
                source: 'PERIODIC',
              },
            },
          ],
        },
      }),
    ),
  )

  // ── 4. Auth status (highest priority — registered last) ──────────
  await page.route('**/api/v1/dashboard/auth/status', route => route.fulfill(json(createAuthStatusResponse(user))))
}

// Hide the TanStack Query devtools overlay — it renders open by default in dev
// mode and intercepts pointer events, blocking clicks on real page elements.
// Established repo convention (see org-comisiones.spec.ts, sales-review.spec.ts).
async function hideQueryDevtools(page: Page) {
  await page.addStyleTag({
    content: `.tsqd-parent-container, [class*="tsqd-"] { display: none !important; pointer-events: none !important; }`,
  })
}

test.describe('LiveLocation (org-level Ubicación de TPVs)', () => {
  test.beforeEach(async ({ page }) => {
    await setupLiveLocationMocks(page)
  })

  test('Org: Ubicación de TPVs lista terminales con link a Google Maps', async ({ page }) => {
    await page.goto(`/wl/organizations/${TEST_ORG_ID}/live-location`)
    await hideQueryDevtools(page)

    await expect(page.getByText('AVQD-2840744194')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Isela Chávez')).toBeVisible()

    const mapLink = page.getByRole('link', { name: /Ver en mapa/i })
    await expect(mapLink).toHaveAttribute('href', /google\.com\/maps\?q=22\.14,-100\.97/)
  })

  test('Org sidebar: "Ubicación de TPVs" navigates to /wl/organizations/:orgSlug/live-location', async ({ page }) => {
    await page.goto(`/wl/organizations/${TEST_ORG_ID}`)
    await hideQueryDevtools(page)

    const sidebarLink = page.getByRole('link', { name: 'Ubicación de TPVs', exact: true })
    await expect(sidebarLink).toBeVisible({ timeout: 15_000 })

    await sidebarLink.click()
    await expect(page).toHaveURL(new RegExp(`/wl/organizations/${TEST_ORG_ID}/live-location$`))
    await expect(page.getByText('AVQD-2840744194')).toBeVisible({ timeout: 15_000 })
  })
})
