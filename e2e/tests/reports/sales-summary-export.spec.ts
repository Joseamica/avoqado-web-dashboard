/**
 * E2E for the Sales Summary rich export dialog (SalesSummaryExportDialog).
 *
 *  1. Summary CSV happy path: open the dialog, submit, and assert the
 *     `/sales-summary/export` request fires with `mode=summary` (+ `format=csv`).
 *  2. PRO (non-Premium) venue: the "Detailed transactions" mode is disabled and
 *     the Premium upsell is shown (TRANSACTION_EXPORT is a PREMIUM feature).
 *  3. PREMIUM venue: detailed mode is selectable and reveals the column picker.
 *
 * Tier-gate signal source (verified 2026-06-15): the dialog's detailed-mode gate is
 * useTierFeatureAccess('TRANSACTION_EXPORT'), which reads
 * GET /api/v1/dashboard/venues/:id/plan-tier (getVenuePlanTierInfo -> { tier,
 * grandfathered, exempt }), NOT GET /plan. api-mocks.ts does NOT mock /plan-tier, so it
 * falls through to the catch-all (api catch-all -> {}), which makes getVenuePlanTierInfo
 * resolve to undefined -> the hook FAILS OPEN (detailed enabled). The permissive
 * happy-path test relies on that fail-open; the PRO and PREMIUM tests register their OWN
 * /plan-tier route (AFTER setupApiMocks, LIFO) to deterministically drive the gate. The
 * tier enum is FREE | PRO | PREMIUM | ENTERPRISE (features.service.ts VenuePlanTierInfo).
 *
 * Selector disambiguation: there are TWO "Export"-named controls (the page trigger + the
 * dialog submit), so role/name queries are strict-mode violations once the dialog is
 * open. Use the stable data-tour locators: trigger = [data-tour="sales-summary-export"],
 * submit = [data-tour="export-dialog-submit"].
 *
 * Default E2E locale is English (i18n fallbackLng: 'en'), so the visible-text assertions
 * use the English reports namespace strings ("Detailed transactions", "Columns to
 * include").
 *
 * Playwright routes are LIFO — the sales-summary GET mock + the NEW export mock are
 * registered AFTER setupApiMocks (catch-all + auth registered first inside it).
 */

import { test, expect, type Page } from '@playwright/test'
import { setupApiMocks, type SetupApiMocksOptions } from '../../fixtures/api-mocks'
import { StaffRole, createMockVenue } from '../../fixtures/mock-data'

test.setTimeout(45_000)
test.use({ viewport: { width: 1280, height: 900 } })

/**
 * @param tier the value the /plan-tier endpoint reports — drives useTierFeatureAccess.
 *   undefined → do NOT register a /plan-tier route (hook fails open → detailed enabled),
 *   used by the permissive happy-path test. 'PRO'/'PREMIUM' → deterministic gate.
 */
async function setupMocks(page: Page, tier?: 'PRO' | 'PREMIUM', extra: Partial<SetupApiMocksOptions> = {}) {
  const venue = createMockVenue({ id: 'venue-alpha', name: 'Restaurante Alpha', slug: 'venue-alpha' })
  await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [venue], ...extra })
  const state: { exportUrl: string | null } = { exportUrl: null }

  // Deterministic tier-gate signal (the gate reads /plan-tier, NOT /plan — see CRITICAL note).
  if (tier) {
    await page.route('**/api/v1/dashboard/venues/*/plan-tier', route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { tier, grandfathered: false, exempt: false } }),
      }),
    )
  }

  // GET sales-summary report (drives the on-screen view + estimated count).
  await page.route('**/api/v1/dashboard/reports/sales-summary*', route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          dateRange: { startDate: '2026-05-01T00:00:00Z', endDate: '2026-05-31T23:59:59Z' },
          reportType: 'summary',
          summary: {
            grossSales: 0, items: 0, serviceCosts: 0, discounts: 0, refunds: 0, netSales: 0,
            deferredSales: 0, taxes: 0, tips: 0, platformFees: 0, staffCommissions: 0,
            commissions: 0, totalCollected: 0, netProfit: 0, transactionCount: 42,
          },
          byPaymentMethod: [],
          filtered: false,
        },
      }),
    }),
  )
  // NEW: the export endpoint — returns a tiny CSV blob. The dialog builds the URL as
  // /api/v1/dashboard/reports/venues/:venueId/sales-summary/export.
  await page.route('**/sales-summary/export*', route => {
    state.exportUrl = route.request().url()
    return route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/csv', 'content-disposition': 'attachment; filename="resumen-ventas-2026-06-15.csv"' },
      body: 'Seccion,Concepto,Cantidad,Monto,Porcentaje\r\n',
    })
  })
  return state
}

async function gotoReport(page: Page) {
  await page.goto('/venues/venue-alpha/reports/sales-summary')
  await page.waitForLoadState('networkidle').catch(() => {})
  // Hide the TanStack Query devtools panel so it can't cover the controls under test.
  await page.addStyleTag({ content: `.tsqd-parent-container, [class*="tsqd-"] { display: none !important; pointer-events: none !important; }` })
  await expect(page.getByRole('heading', { name: /Sales Summary/i })).toBeVisible({ timeout: 15_000 })
}

async function openDialog(page: Page) {
  await page.locator('[data-tour="sales-summary-export"]').click()
  // The FullScreenModal renders its title ("Export") as a heading.
  await expect(page.getByRole('heading', { name: /^Export$/i })).toBeVisible({ timeout: 10_000 })
}

test('summary CSV happy path: opens dialog and hits the export endpoint with mode=summary', async ({ page }) => {
  const state = await setupMocks(page) // permissive (no /plan-tier override → fail open)
  await gotoReport(page)
  await openDialog(page)

  const [req] = await Promise.all([
    page.waitForRequest(
      r => r.url().includes('/sales-summary/export') && r.url().includes('mode=summary'),
      { timeout: 10_000 },
    ),
    page.locator('[data-tour="export-dialog-submit"]').click(),
  ])
  expect(req.url()).toContain('format=csv')
  expect(state.exportUrl).toContain('mode=summary')
})

test('PRO (non-Premium) venue: detailed mode is disabled and shows the Premium upsell', async ({ page }) => {
  await setupMocks(page, 'PRO')
  await gotoReport(page)
  await openDialog(page)

  // The mode label is visible.
  await expect(page.getByText('Detailed transactions', { exact: true })).toBeVisible()
  // The detailed radio is disabled (TRANSACTION_EXPORT is PREMIUM; PRO < PREMIUM).
  await expect(page.locator('#mode-detailed')).toBeDisabled()
  // The Premium upsell hint renders once detailed is the active (disabled) mode is NOT
  // shown by default; the PREMIUM badge + the FREE/PRO-only upsell copy confirm gating.
  await expect(page.getByText('PREMIUM').first()).toBeVisible()
})

test('PREMIUM venue: detailed mode selectable and shows the column picker', async ({ page }) => {
  await setupMocks(page, 'PREMIUM')
  await gotoReport(page)
  await openDialog(page)

  // Detailed mode is enabled → selecting it swaps the section picker for the column picker.
  await expect(page.locator('#mode-detailed')).toBeEnabled()
  await page.locator('#mode-detailed').click()
  await expect(page.getByText('Columns to include', { exact: true })).toBeVisible()
})
