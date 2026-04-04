/**
 * E2E tests for Organization Config Sidebar visibility.
 *
 * Verifies that the "Configuración Org." sidebar section only
 * appears for organizations with the WHITE_LABEL_DASHBOARD module enabled.
 */

import { test, expect, Page } from '@playwright/test'
import {
  StaffRole,
  createMockVenue,
  createMockUser,
  createAuthStatusResponse,
  DEFAULT_ROLE_CONFIGS,
} from '../../fixtures/mock-data'

test.setTimeout(45_000)
test.use({ viewport: { width: 1280, height: 900 } })

// ─── Helpers ─────────────────────────────────────────────────────

const TEST_ORG_ID = 'org-test-001'

function createWLVenue() {
  return createMockVenue({
    id: 'venue-wl-001',
    name: 'Tienda WL',
    slug: 'venue-wl',
    organizationId: TEST_ORG_ID,
    organization: { id: TEST_ORG_ID, name: 'WL Organization' },
    modules: [
      { module: { id: 'mod-team', code: 'TEAM', name: 'Team Management' }, enabled: true },
      { module: { id: 'mod-wl', code: 'WHITE_LABEL_DASHBOARD', name: 'White Label Dashboard' }, enabled: true },
    ],
  })
}

async function setupOrgMocks(page: Page, options: { whiteLabelEnabled: boolean }) {
  const venue = options.whiteLabelEnabled
    ? createWLVenue()
    : createMockVenue({
        id: 'venue-basic-001',
        name: 'Tienda Basic',
        slug: 'venue-basic',
        organizationId: TEST_ORG_ID,
        organization: { id: TEST_ORG_ID, name: 'Basic Organization' },
      })

  const venueWithRole = { ...venue, role: StaffRole.OWNER }
  const user = createMockUser(StaffRole.OWNER, [venueWithRole])
  const authResponse = createAuthStatusResponse(user)

  const orgName = options.whiteLabelEnabled ? 'WL Organization' : 'Basic Organization'

  // 1. Catch-all (lowest priority — registered first in LIFO)
  await page.route('**/api/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    }),
  )

  // 2. Organization analytics endpoints (return proper shapes to avoid crashes)
  await page.route(`**/api/v1/organizations/${TEST_ORG_ID}/analytics/top-items*`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    }),
  )

  await page.route(`**/api/v1/organizations/${TEST_ORG_ID}/analytics/revenue-trends*`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        currentPeriod: { from: '2026-03-01', to: '2026-03-26', dataPoints: [], totals: { revenue: 0, orders: 0 } },
        previousPeriod: { from: '2026-02-01', to: '2026-02-26', dataPoints: [], totals: { revenue: 0, orders: 0 } },
        changes: { revenueChange: 0, ordersChange: 0 },
      }),
    }),
  )

  await page.route(`**/api/v1/organizations/${TEST_ORG_ID}/analytics/enhanced-overview*`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        totalRevenue: 0,
        totalOrders: 0,
        totalPayments: 0,
        averageTicketSize: 0,
        previousPeriod: { totalRevenue: 0, totalOrders: 0, totalPayments: 0, averageTicketSize: 0 },
        changes: { revenueChange: 0, ordersChange: 0, ticketSizeChange: 0, paymentsChange: 0 },
        topVenues: [],
      }),
    }),
  )

  // 3. Organization stats + venues
  await page.route(`**/api/v1/dashboard/organizations/${TEST_ORG_ID}/stats`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: TEST_ORG_ID,
        name: orgName,
        venueCount: 1,
        totalRevenue: 0,
        totalOrders: 0,
      }),
    }),
  )

  await page.route(`**/api/v1/dashboard/organizations/${TEST_ORG_ID}/venues`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([venueWithRole]),
    }),
  )

  // 4. Notifications (expects data array)
  await page.route('**/api/v1/notifications*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [], meta: { total: 0, page: 1, pageSize: 20, totalPages: 0 } }),
    }),
  )

  // 5. Role config
  await page.route('**/api/v1/dashboard/venues/*/role-config', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(DEFAULT_ROLE_CONFIGS),
    }),
  )

  // 6. User access
  await page.route('**/api/v1/me/access*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        userId: user.id,
        venueId: venueWithRole.id,
        organizationId: TEST_ORG_ID,
        role: StaffRole.OWNER,
        corePermissions: venueWithRole.permissions,
        whiteLabelEnabled: options.whiteLabelEnabled,
        enabledFeatures: [],
        featureAccess: {},
      }),
    }),
  )

  // 7. Auth status (highest priority — registered last)
  await page.route('**/api/v1/dashboard/auth/status', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(authResponse),
    }),
  )
}

// ─── Tests ───────────────────────────────────────────────────────

test.describe('Org Config Sidebar', () => {
  test('1 — WL org shows "Configuracion Org." sidebar section', async ({ page }) => {
    await setupOrgMocks(page, { whiteLabelEnabled: true })

    await page.goto(`/organizations/${TEST_ORG_ID}`)

    // Wait for sidebar to render
    await page.waitForSelector('[data-sidebar]', { state: 'visible', timeout: 15_000 })

    // The org config section label should be visible
    await expect(page.getByText('Configuración Org.')).toBeVisible({ timeout: 10_000 })

    // All 4 org config items should appear
    await expect(page.getByText('Configuración TPV')).toBeVisible()
    await expect(page.getByText('Metas')).toBeVisible()
    await expect(page.getByText('Categorías')).toBeVisible()
    await expect(page.getByText('Mensajes')).toBeVisible()
  })

  test('2 — Non-WL org does NOT show "Configuracion Org." sidebar section', async ({ page }) => {
    await setupOrgMocks(page, { whiteLabelEnabled: false })

    await page.goto(`/organizations/${TEST_ORG_ID}`)

    // Wait for sidebar to render
    await page.waitForSelector('[data-sidebar]', { state: 'visible', timeout: 15_000 })

    // Wait for a known standard section to confirm sidebar loaded (the management section items)
    await page.waitForTimeout(3_000)

    // Org config section should NOT appear
    await expect(page.getByText('Configuración Org.')).not.toBeVisible()
  })

  test('3 — Clicking "Metas" navigates to org-goals route', async ({ page }) => {
    await setupOrgMocks(page, { whiteLabelEnabled: true })

    await page.goto(`/organizations/${TEST_ORG_ID}`)

    // Wait for org config section to appear
    await expect(page.getByText('Configuración Org.')).toBeVisible({ timeout: 15_000 })

    // Close React Query devtools if open (it overlays the page and blocks interactions)
    await page.evaluate(() => {
      const devtoolsPanel = document.querySelector('.tsqd-parent-container')
      if (devtoolsPanel) (devtoolsPanel as HTMLElement).style.display = 'none'
      const toggleBtn = document.querySelector('[aria-label="Open React Query Devtools"]') as HTMLElement
        || document.querySelector('.tsqd-open-btn-container') as HTMLElement
      if (toggleBtn) toggleBtn.style.display = 'none'
    })

    // Click the Metas link
    const metasLink = page.getByRole('link', { name: 'Metas' })
    await expect(metasLink).toBeVisible({ timeout: 5_000 })
    await metasLink.click()

    // URL should change to the org-goals route
    await expect(page).toHaveURL(new RegExp(`/organizations/${TEST_ORG_ID}/org-goals`), { timeout: 10_000 })
  })
})
