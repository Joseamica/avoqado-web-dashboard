/**
 * E2E happy-path test for the org-level "Comisiones" (Cash Out) page.
 *
 * Covers OrgComisionesPage (src/pages/playtelecom/Organization/OrgComisionesPage.tsx),
 * mounted at /organizations/:orgId/comisiones behind OwnerProtectedRoute, and reached
 * via the "Comisiones" item in the org sidebar (only shown for white-label orgs — a
 * venue with the WHITE_LABEL_DASHBOARD module enabled).
 *
 * Backend surface mocked (org-wide cash-out endpoints):
 *   - GET/PUT /api/v1/dashboard/organizations/:orgId/cash-out/commission-rates
 *   - GET/PUT /api/v1/dashboard/organizations/:orgId/cash-out/active-days
 *   - GET      /api/v1/dashboard/organizations/:orgId/cash-out/withdrawals
 *   - POST     /api/v1/dashboard/organizations/:orgId/cash-out/report
 */

import { test, expect, Page } from '@playwright/test'
import { StaffRole, createMockVenue, createMockUser, createAuthStatusResponse, DEFAULT_ROLE_CONFIGS } from '../../fixtures/mock-data'

test.setTimeout(45_000)
test.use({ viewport: { width: 1280, height: 900 } })

const TEST_ORG_ID = 'org-playtelecom-comisiones-001'

function json(data: unknown) {
  return { status: 200, contentType: 'application/json', body: JSON.stringify(data) }
}

// Mutable "server-side" state so PUT/POST mocks can echo back what was sent.
let ratesState: Array<{ id?: string; saleType: string; minCount: number; maxCount: number | null; amount: number }>
let daysState: string[]

function resetState() {
  ratesState = [
    { id: 'rate-1', saleType: 'LINEA_NUEVA', minCount: 1, maxCount: 10, amount: 50 },
    { id: 'rate-2', saleType: 'LINEA_NUEVA', minCount: 11, maxCount: null, amount: 75 },
    { id: 'rate-3', saleType: 'PORTABILIDAD', minCount: 1, maxCount: null, amount: 100 },
  ]
  daysState = ['2026-07-06', '2026-07-13']
}

async function setupOrgComisionesMocks(page: Page) {
  resetState()

  await page.addInitScript(() => {
    try {
      localStorage.setItem('lang', 'es')
    } catch {
      /* ignore */
    }
  })

  // Venue must have WHITE_LABEL_DASHBOARD enabled for the "Comisiones" sidebar
  // item to render (OrgSidebar.tsx gates the whole "org config" section on it).
  const venue = createMockVenue({
    id: 'venue-bae-comisiones-001',
    name: 'BAE Comisiones',
    slug: 'bae-comisiones',
    organizationId: TEST_ORG_ID,
    organization: { id: TEST_ORG_ID, name: 'PlayTelecom Comisiones' },
    modules: [
      { module: { id: 'mod-si', code: 'SERIALIZED_INVENTORY', name: 'Serialized Inventory' }, enabled: true },
      { module: { id: 'mod-wl', code: 'WHITE_LABEL_DASHBOARD', name: 'White Label Dashboard' }, enabled: true },
    ],
  })
  const venueWithRole = { ...venue, role: StaffRole.OWNER }
  const user = createMockUser(StaffRole.OWNER, [venueWithRole])

  // ── 1. Catch-all FIRST (lowest priority — LIFO) ──────────────────
  await page.route('**/api/v1/**', route => route.fulfill(json({})))

  // ── 2. Org shell endpoints ────────────────────────────────────────
  // NOTE: organization.service.ts calls /api/v1/organizations/:orgId/(stats|venues)
  // — NOT /api/v1/dashboard/organizations/... — unlike the cash-out endpoints.
  await page.route(`**/api/v1/organizations/${TEST_ORG_ID}/stats`, route =>
    route.fulfill(json({ id: TEST_ORG_ID, name: 'PlayTelecom Comisiones', venueCount: 1, totalRevenue: 0, totalOrders: 0 })),
  )
  await page.route(`**/api/v1/organizations/${TEST_ORG_ID}/venues`, route => route.fulfill(json([venueWithRole])))
  // OrgRevenueTrendsChart destructures data.currentPeriod.dataPoints directly (no
  // optional chaining on `currentPeriod`), so the generic `{}` catch-all crashes the
  // org dashboard root (/organizations/:orgId). Only needed for test 1, which visits
  // that route to click the sidebar link; give it a minimal well-shaped response.
  await page.route(`**/api/v1/organizations/${TEST_ORG_ID}/analytics/revenue-trends*`, route =>
    route.fulfill(
      json({
        currentPeriod: { from: '2026-06-01', to: '2026-06-30', dataPoints: [], totals: { revenue: 0, orders: 0 } },
        previousPeriod: { from: '2026-05-01', to: '2026-05-31', dataPoints: [], totals: { revenue: 0, orders: 0 } },
        comparison: { revenueChange: 0, ordersChange: 0 },
      }),
    ),
  )
  // TopItemsTable does `items.map(...)` directly (no `items ?? []` guard), so it
  // also needs a real array instead of the generic `{}` catch-all.
  await page.route(`**/api/v1/organizations/${TEST_ORG_ID}/analytics/top-items*`, route => route.fulfill(json([])))
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

  // ── 3. Org cash-out (Comisiones) endpoints ───────────────────────
  const cashOutBase = `**/api/v1/dashboard/organizations/${TEST_ORG_ID}/cash-out`

  await page.route(`${cashOutBase}/commission-rates`, route => {
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON() as { rates: typeof ratesState }
      ratesState = body.rates
      return route.fulfill(json({ success: true, data: ratesState }))
    }
    return route.fulfill(json({ success: true, data: ratesState }))
  })

  await page.route(`${cashOutBase}/active-days`, route => {
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON() as { days: string[] }
      daysState = body.days
      return route.fulfill(json({ success: true, data: daysState }))
    }
    return route.fulfill(json({ success: true, data: daysState }))
  })

  await page.route(`${cashOutBase}/withdrawals`, route =>
    route.fulfill(
      json({
        success: true,
        data: [
          {
            id: 'wd-1',
            folio: 'F-0001',
            staffId: 'staff-1',
            promoterName: 'Susana Valdez',
            status: 'REQUESTED',
            grossAmount: '500',
            netAmount: '475',
            clabe: '012345678901234567',
            businessDate: '2026-07-01',
            createdAt: '2026-07-01T10:00:00.000Z',
            reportedAt: null,
            paidAt: null,
            venueName: 'BAE Comisiones',
          },
          {
            id: 'wd-2',
            folio: 'F-0002',
            staffId: 'staff-2',
            promoterName: 'Ricardo Martinez',
            status: 'REQUESTED',
            grossAmount: '300',
            netAmount: '285',
            clabe: null,
            businessDate: '2026-07-02',
            createdAt: '2026-07-02T10:00:00.000Z',
            reportedAt: null,
            paidAt: null,
            venueName: 'GEOPLAZAS',
          },
        ],
      }),
    ),
  )

  await page.route(`${cashOutBase}/report`, route =>
    route.fulfill(
      json({
        success: true,
        data: {
          orgId: TEST_ORG_ID,
          rows: [
            { withdrawalId: 'wd-1', folio: 'F-0001', promoterId: 'staff-1', promoterName: 'Susana Valdez', clabe: '012345678901234567', netAmount: '475' },
            { withdrawalId: 'wd-2', folio: 'F-0002', promoterId: 'staff-2', promoterName: 'Ricardo Martinez', clabe: null, netAmount: '285' },
          ],
          totalNet: '760',
          count: 2,
        },
      }),
    ),
  )

  // ── 4. Auth status (highest priority — registered last) ──────────
  await page.route('**/api/v1/dashboard/auth/status', route => route.fulfill(json(createAuthStatusResponse(user))))
}

// Hide the TanStack Query devtools overlay — it renders open by default in dev
// mode and intercepts pointer events, blocking clicks on real page elements.
// Established repo convention (see e2e/tests/playtelecom/sales-review.spec.ts,
// sales-detail-edit.spec.ts, and many others).
async function hideQueryDevtools(page: Page) {
  await page.addStyleTag({
    content: `.tsqd-parent-container, [class*="tsqd-"] { display: none !important; pointer-events: none !important; }`,
  })
}

test.describe('OrgComisionesPage (org-level Comisiones)', () => {
  test.beforeEach(async ({ page }) => {
    await setupOrgComisionesMocks(page)
  })

  test('1 — "Comisiones" is visible in the org sidebar and navigates to /organizations/:orgId/comisiones', async ({ page }) => {
    await page.goto(`/organizations/${TEST_ORG_ID}`)
    await hideQueryDevtools(page)

    const sidebarLink = page.getByRole('link', { name: 'Comisiones', exact: true })
    await expect(sidebarLink).toBeVisible({ timeout: 15_000 })

    await sidebarLink.click()
    await expect(page).toHaveURL(new RegExp(`/organizations/${TEST_ORG_ID}/comisiones$`))
    await expect(page.getByText('Tabla de comisiones escalonada')).toBeVisible()
  })

  test('2 — rate table and active-days calendar render from mocked data', async ({ page }) => {
    await page.goto(`/organizations/${TEST_ORG_ID}/comisiones`)
    await hideQueryDevtools(page)
    await expect(page.getByText('Tabla de comisiones escalonada')).toBeVisible({ timeout: 15_000 })

    // Rate table: sale-type sections + seeded amounts (Línea Nueva: 50, 75; Portabilidad: 100)
    await expect(page.getByText('Línea Nueva')).toBeVisible()
    await expect(page.getByText('Portabilidad')).toBeVisible()

    const amountInputs = page.locator('input[type="number"]')
    const values = await amountInputs.evaluateAll(inputs => (inputs as HTMLInputElement[]).map(i => i.value))
    expect(values).toContain('50')
    expect(values).toContain('75')
    expect(values).toContain('100')

    // Active days calendar: seeded days rendered as badges
    await expect(page.getByText('Días activos del esquema')).toBeVisible()
    await expect(page.getByText('2026-07-06')).toBeVisible()
    await expect(page.getByText('2026-07-13')).toBeVisible()

    // Withdrawals table rendered from mocked data (venueName included)
    await expect(page.getByText('Retiros y reporte de dispersión')).toBeVisible()
    await expect(page.getByText('Susana Valdez')).toBeVisible()
    await expect(page.getByRole('cell', { name: 'BAE Comisiones' })).toBeVisible()
    await expect(page.getByText('GEOPLAZAS')).toBeVisible()
  })

  test('3 — editing a rate and saving fires a PUT to commission-rates', async ({ page }) => {
    await page.goto(`/organizations/${TEST_ORG_ID}/comisiones`)
    await hideQueryDevtools(page)
    await expect(page.getByText('Tabla de comisiones escalonada')).toBeVisible({ timeout: 15_000 })

    const putPromise = page.waitForRequest(
      req => req.url().includes(`/organizations/${TEST_ORG_ID}/cash-out/commission-rates`) && req.method() === 'PUT',
    )

    // Amount column is the 3rd number input in each 3-input row (from/to/amount).
    // Find the input currently holding "50" (first Línea Nueva tier) and change it.
    const amountInputs = page.locator('input[type="number"]')
    const inputsCount = await amountInputs.count()
    let targetIndex = -1
    for (let i = 0; i < inputsCount; i++) {
      const val = await amountInputs.nth(i).inputValue()
      if (val === '50') {
        targetIndex = i
        break
      }
    }
    expect(targetIndex).toBeGreaterThan(-1)

    await amountInputs.nth(targetIndex).fill('99')

    const saveButtons = page.getByRole('button', { name: 'Guardar' })
    // The rates card's Guardar button is the first one that becomes enabled after editing.
    await saveButtons.first().click()

    const putReq = await putPromise
    const putBody = putReq.postDataJSON() as { rates: Array<{ amount: number }> }
    expect(putBody.rates.some(r => r.amount === 99)).toBe(true)

    await expect(page.getByText('Tarifas guardadas', { exact: true })).toBeVisible()
  })

  test('4 — toggling (removing) an active day fires a PUT to active-days', async ({ page }) => {
    await page.goto(`/organizations/${TEST_ORG_ID}/comisiones`)
    await hideQueryDevtools(page)
    await expect(page.getByText('Días activos del esquema')).toBeVisible({ timeout: 15_000 })

    const putPromise = page.waitForRequest(
      req => req.url().includes(`/organizations/${TEST_ORG_ID}/cash-out/active-days`) && req.method() === 'PUT',
    )

    // Clicking a day badge removes it (per OrgComisionesPage.tsx removeDay handler).
    await page.getByText('2026-07-06').click()

    const saveButtons = page.getByRole('button', { name: 'Guardar' })
    // Two "Guardar" buttons exist (rates card + days card) — the days card's is the 2nd.
    await saveButtons.nth(1).click()

    const putReq = await putPromise
    const putBody = putReq.postDataJSON() as { days: string[] }
    expect(putBody.days).not.toContain('2026-07-06')
    expect(putBody.days).toContain('2026-07-13')

    await expect(page.getByText('Días guardados', { exact: true })).toBeVisible()
  })

  test('5 — "Generar reporte" fires a POST to report and shows the returned totals', async ({ page }) => {
    await page.goto(`/organizations/${TEST_ORG_ID}/comisiones`)
    await hideQueryDevtools(page)
    await expect(page.getByText('Retiros y reporte de dispersión')).toBeVisible({ timeout: 15_000 })

    const postPromise = page.waitForRequest(
      req => req.url().includes(`/organizations/${TEST_ORG_ID}/cash-out/report`) && req.method() === 'POST',
    )

    const genReportButton = page.getByRole('button', { name: /Generar reporte/ })
    await expect(genReportButton).toBeEnabled()
    await genReportButton.click()

    await postPromise

    // Toast shows the returned totals: count=2, totalNet=760
    await expect(page.getByText('Reporte generado', { exact: true })).toBeVisible()
    await expect(page.getByText(/2 retiros/).first()).toBeVisible()
    await expect(page.getByText(/760/).first()).toBeVisible()
  })
})
