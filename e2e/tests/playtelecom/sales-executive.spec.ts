/**
 * E2E tests for the org-level "Ventas" executive dashboard (SalesExecutive).
 *
 * Covers the client-requested fixes (Asana 1215613218390496):
 *   - "Monto confirmado" KPI uses confirmedRevenue (only SaleVerification
 *     COMPLETED), NOT totalRevenue which includes "en revisión"
 *   - Heatmap tables pin a "Total País" row at the top with per-month totals
 *   - Month columns ordered oldest → newest, left to right
 *   - New "Ventas Totales por Promotor" table
 *   - Header makes the covered period explicit
 */

import { test, expect, Page } from '@playwright/test'
import { StaffRole, createMockVenue, createMockUser, createAuthStatusResponse, DEFAULT_ROLE_CONFIGS } from '../../fixtures/mock-data'

test.setTimeout(45_000)
test.use({ viewport: { width: 1280, height: 900 } })

const TEST_ORG_ID = 'org-playtelecom-001'

function json(data: unknown) {
  return { status: 200, contentType: 'application/json', body: JSON.stringify(data) }
}

async function setupSalesExecutiveMocks(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('lang', 'es')
    } catch {
      /* ignore */
    }
  })

  const venue = createMockVenue({
    id: 'venue-bae-001',
    name: 'BAE POZOS',
    slug: 'bae-pozos',
    organizationId: TEST_ORG_ID,
    organization: { id: TEST_ORG_ID, name: 'PlayTelecom' },
    modules: [{ module: { id: 'mod-si', code: 'SERIALIZED_INVENTORY', name: 'Serialized Inventory' }, enabled: true }],
  })
  const venueWithRole = { ...venue, role: StaffRole.OWNER }
  const user = createMockUser(StaffRole.OWNER, [venueWithRole])

  // 1. Catch-all (lowest priority — LIFO)
  await page.route('**/api/**', route => route.fulfill(json({})))

  // 2. Org shell endpoints
  await page.route(`**/api/v1/dashboard/organizations/${TEST_ORG_ID}/stats`, route =>
    route.fulfill(json({ id: TEST_ORG_ID, name: 'PlayTelecom', venueCount: 1, totalRevenue: 0, totalOrders: 0 })),
  )
  await page.route(`**/api/v1/dashboard/organizations/${TEST_ORG_ID}/venues`, route => route.fulfill(json([venueWithRole])))
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

  // 3. Sales executive aggregation endpoints
  const base = `**/api/v1/dashboard/organizations/${TEST_ORG_ID}/sale-verifications`

  await page.route(`${base}/summary*`, route =>
    route.fulfill(
      json({
        success: true,
        data: {
          // totalRevenue includes "en revisión" — the KPI must NOT show this
          totalRevenue: 1850,
          confirmedRevenue: 1000,
          totalCount: 4,
          completedCount: 2,
          pendingCount: 1,
          failedCount: 1,
          withoutVerificationCount: 0,
        },
      }),
    ),
  )
  await page.route(`${base}/by-month*`, route =>
    route.fulfill(
      json({
        success: true,
        data: [
          { month: '2026-04', count: 3, revenue: 600 },
          { month: '2026-03', count: 2, revenue: 400 },
        ],
      }),
    ),
  )
  await page.route(`${base}/by-sim-type*`, route => route.fulfill(json({ success: true, data: [] })))
  await page.route(`${base}/by-week*`, route => route.fulfill(json({ success: true, data: [] })))
  await page.route(`${base}/by-city*`, route =>
    route.fulfill(
      json({
        success: true,
        data: [
          { city: 'San Luis Potosí', byMonth: { '2026-03': 2, '2026-04': 1 }, total: 3 },
          { city: 'Querétaro', byMonth: { '2026-04': 2 }, total: 2 },
        ],
      }),
    ),
  )
  await page.route(`${base}/by-supervisor*`, route =>
    route.fulfill(
      json({
        success: true,
        data: [
          {
            supervisorId: 'sup-1',
            supervisorName: 'Hugo Gonzalez',
            byWeek: { W11: 3 },
            byMonth: { '2026-03': 2, '2026-04': 1 },
            total: 3,
          },
        ],
      }),
    ),
  )
  await page.route(`${base}/by-store*`, route =>
    route.fulfill(
      json({
        success: true,
        data: [
          { venueId: 'v1', venueName: 'BAE POZOS', byWeek: { W11: 3 }, byMonth: { '2026-03': 2, '2026-04': 1 }, total: 3 },
          { venueId: 'v2', venueName: 'GEOPLAZAS', byWeek: { W15: 2 }, byMonth: { '2026-04': 2 }, total: 2 },
        ],
      }),
    ),
  )
  await page.route(`${base}/by-promoter*`, route =>
    route.fulfill(
      json({
        success: true,
        data: [
          { staffId: 's1', promoterName: 'Susana Valdez', byMonth: { '2026-03': 2, '2026-04': 1 }, total: 3 },
          { staffId: 's2', promoterName: 'Ricardo Martinez', byMonth: { '2026-04': 1 }, total: 1 },
        ],
      }),
    ),
  )
  // Registered AFTER by-promoter* so LIFO matching checks this specific route first.
  await page.route(`${base}/by-promoter-daily*`, route =>
    route.fulfill(
      json({
        success: true,
        data: {
          month: '2026-06',
          days: ['2026-06-01', '2026-06-02', '2026-06-03'],
          rows: [
            { staffId: 'p1', promoterName: 'Nancy Casillas', byDay: { '2026-06-01': 7, '2026-06-02': 79, '2026-06-03': 104 }, total: 190, toReview: 4 },
            { staffId: 'p2', promoterName: 'Patricia Navarro', byDay: { '2026-06-01': 4, '2026-06-02': 85 }, total: 89, toReview: 3 },
            // only to-review (no confirmed) → must still appear so the promoter acts
            { staffId: 'p3', promoterName: 'Lucia Briones', byDay: {}, total: 0, toReview: 6 },
          ],
        },
      }),
    ),
  )

  // 4. Auth status (highest priority — registered last)
  await page.route('**/api/v1/dashboard/auth/status', route => route.fulfill(json(createAuthStatusResponse(user))))
}

test.describe('SalesExecutive (org Ventas)', () => {
  test.beforeEach(async ({ page }) => {
    await setupSalesExecutiveMocks(page)
    await page.goto(`/organizations/${TEST_ORG_ID}/sales`)
    await expect(page.getByRole('heading', { name: 'Ventas', exact: true })).toBeVisible({ timeout: 15_000 })
  })

  test('1 — "Monto confirmado" shows confirmedRevenue, not totalRevenue', async ({ page }) => {
    const kpiCard = page.locator('text=Monto confirmado').locator('..')
    await expect(kpiCard).toContainText('$1,000')
    await expect(kpiCard).not.toContainText('$1,850')
  })

  test('2 — header states the covered period explicitly', async ({ page }) => {
    await expect(page.getByText(/Histórico completo: Mar 2026 a Abr 2026/)).toBeVisible()
  })

  test('3 — city table pins "Total País" on top with column totals and months oldest → newest', async ({ page }) => {
    const cityCard = page.locator('div', { has: page.getByRole('heading', { name: 'Ventas Totales por Ciudad' }) }).last()

    // Months left-to-right: Mar (older) must come before Abr (newer).
    // Header row uses CSS `uppercase`, which affects innerText.
    const headers = (await cityCard.locator('thead th').allInnerTexts()).map(h => h.trim().toUpperCase())
    const mar = headers.indexOf('MAR')
    const abr = headers.indexOf('ABR')
    expect(mar).toBeGreaterThan(-1)
    expect(abr).toBeGreaterThan(mar)

    // First body row is the country total with per-month sums (2+0=2, 1+2=3, total 5).
    // CSS `uppercase` affects innerText, so compare case-insensitively.
    const totalRow = cityCard.locator('tbody tr').first()
    const totalCells = await totalRow.locator('td').allInnerTexts()
    expect(totalCells.map(c => c.trim().toUpperCase())).toEqual(['TOTAL PAÍS', '2', '3', '5'])

    // Data rows sorted desc by total: SLP (3) before QRO (2)
    const rowNames = await cityCard.locator('tbody tr td:first-child').allInnerTexts()
    expect(rowNames.indexOf('San Luis Potosí')).toBeLessThan(rowNames.indexOf('Querétaro'))
  })

  test('4 — supervisor and store tables use month buckets, not weeks', async ({ page }) => {
    const supervisorCard = page.locator('div', { has: page.getByRole('heading', { name: 'Ventas Totales por Supervisor' }) }).last()
    await expect(supervisorCard).toContainText('Hugo Gonzalez')
    await expect(supervisorCard.locator('thead')).toContainText('Mar')
    await expect(supervisorCard.locator('thead')).not.toContainText('W11')

    const storeCard = page.locator('div', { has: page.getByRole('heading', { name: 'Ventas Totales por Tienda' }) }).last()
    await expect(storeCard.locator('thead')).toContainText('Abr')
    await expect(storeCard.locator('thead')).not.toContainText('W15')
  })

  test('5 — promoter table renders with country total on top', async ({ page }) => {
    // exact:true so it doesn't also match "Ventas Totales por Promotor por día"
    const promoterCard = page.locator('div', { has: page.getByRole('heading', { name: 'Ventas Totales por Promotor', exact: true }) }).last()
    await expect(promoterCard).toContainText('Susana Valdez')
    await expect(promoterCard).toContainText('Ricardo Martinez')

    const totalRow = promoterCard.locator('tbody tr').first()
    // Column totals: Mar 2, Abr 2, grand total 4 (CSS `uppercase` affects innerText)
    const totalCells = await totalRow.locator('td').allInnerTexts()
    expect(totalCells.map(c => c.trim().toUpperCase())).toEqual(['TOTAL PAÍS', '2', '2', '4'])
  })

  test('6 — daily promoter table: day columns, to-review column, total excludes to-review', async ({ page }) => {
    const card = page.locator('div', { has: page.getByRole('heading', { name: 'Ventas Totales por Promotor por día' }) }).last()

    // Day columns formatted "01-jun" and the to-review column header present
    await expect(card.locator('thead')).toContainText('01-jun')
    await expect(card.locator('thead')).toContainText('03-jun')
    await expect(card.locator('thead')).toContainText('Pendientes de revisar por el promotor en TPV')

    // Total País on top: days 11 / 164 / 104, grand 279, to-review 13 (4+3+6)
    const totalRow = card.locator('tbody tr').first()
    const totalCells = (await totalRow.locator('td').allInnerTexts()).map(c => c.trim().toUpperCase())
    expect(totalCells).toEqual(['TOTAL PAÍS', '11', '164', '104', '279', '13'])

    // Rows sorted desc by confirmed total; a promoter with only to-review still shows
    const names = await card.locator('tbody tr td:first-child').allInnerTexts()
    expect(names.indexOf('Nancy Casillas')).toBeLessThan(names.indexOf('Patricia Navarro'))
    await expect(card).toContainText('Lucia Briones')

    // Lucia: 0 confirmed but 6 to-review (the action signal)
    const lucia = card.locator('tbody tr', { hasText: 'Lucia Briones' })
    const luciaCells = (await lucia.locator('td').allInnerTexts()).map(c => c.trim())
    expect(luciaCells[luciaCells.length - 1]).toBe('6') // to-review
    expect(luciaCells[luciaCells.length - 2]).toBe('0') // confirmed total
  })
})
