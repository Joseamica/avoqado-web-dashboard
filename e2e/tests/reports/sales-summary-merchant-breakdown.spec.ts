/**
 * E2E for the Sales Summary per-merchant reconciliation (Entrega 1):
 *  - the "¿Dónde está tu dinero?" / "Where is your money?" strip
 *  - the per-merchant card breakdown panel (Cobrado · Comisión · Neto a recibir)
 *
 * Both are additive: they render from the new optional `byMerchantAccount` field
 * on the sales-summary response. The request must carry includeMerchantBreakdown=true.
 *
 * Default E2E locale is English (i18n fallbackLng: 'en'), so assertions use the
 * English `reports` namespace strings. Merchant display names come from the
 * mocked payload, so they render verbatim regardless of locale.
 *
 * Playwright routes are LIFO — the specific sales-summary route is registered
 * AFTER setupApiMocks (catch-all + auth).
 */

import { test, expect, Page } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'
import { StaffRole, createMockVenue } from '../../fixtures/mock-data'

test.setTimeout(45_000)
test.use({ viewport: { width: 1280, height: 900 } })

const SUMMARY_WITH_MERCHANTS = {
  dateRange: { startDate: '2026-05-01T00:00:00Z', endDate: '2026-05-31T23:59:59Z' },
  reportType: 'summary',
  summary: {
    grossSales: 27767,
    items: 27767,
    serviceCosts: 0,
    discounts: 0,
    refunds: 0,
    netSales: 27767,
    deferredSales: 0,
    taxes: 0,
    tips: 0,
    platformFees: 563.3,
    staffCommissions: 0,
    commissions: 563.3,
    totalCollected: 27203.7,
    netProfit: 27203.7,
    transactionCount: 40,
  },
  byPaymentMethod: [
    { method: 'CREDIT_CARD', amount: 1823, count: 21, percentage: 7 },
    { method: 'CASH', amount: 9070, count: 12, percentage: 33 },
  ],
  byPaymentMethodDetailed: [
    { bucket: 'CARD', amount: 18697, count: 28, percentage: 67, tips: 0, refunds: 0, platformFees: 563.3 },
    { bucket: 'CASH', amount: 9070, count: 12, percentage: 33, tips: 0, refunds: 0, platformFees: 0 },
  ],
  byMerchantAccount: [
    {
      merchantAccountId: 'ext',
      displayName: 'Amaena - Externo',
      provider: 'Blumon PAX',
      affiliation: null,
      collectedOnCard: 13827,
      platformFee: 497.7,
      netToReceive: 13329.3,
      transactionCount: 17,
    },
    {
      merchantAccountId: 'a',
      displayName: 'Amaena - A',
      provider: 'AngelPay (Nexgo)',
      affiliation: '7494104',
      collectedOnCard: 1823,
      platformFee: 65.6,
      netToReceive: 1757.4,
      transactionCount: 5,
    },
  ],
  filtered: false,
}

interface MockState {
  lastUrl: string | null
}

async function setupMocks(page: Page): Promise<MockState> {
  const venue = createMockVenue({ id: 'venue-alpha', name: 'Restaurante Alpha', slug: 'venue-alpha' })
  await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [venue] })

  const state: MockState = { lastUrl: null }

  await page.route('**/api/v1/dashboard/venues/*/payment-config/merchant-accounts*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) }),
  )
  await page.route('**/api/v1/dashboard/venues/*/payment-config/settlement-info*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) }),
  )

  await page.route('**/api/v1/dashboard/reports/sales-summary*', (route) => {
    state.lastUrl = route.request().url()
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: SUMMARY_WITH_MERCHANTS }),
    })
  })

  return state
}

async function gotoReport(page: Page) {
  await page.goto('/venues/venue-alpha/reports/sales-summary')
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
  await page.evaluate(() => {
    const panel = document.querySelector('.tsqd-parent-container')
    if (panel) (panel as HTMLElement).style.display = 'none'
  })
  await expect(page.getByRole('heading', { name: /Sales Summary/i })).toBeVisible({ timeout: 15_000 })
}

test.describe('Sales Summary — per-merchant reconciliation', () => {
  test('requests the breakdown and renders the money strip + merchant rows', async ({ page }) => {
    const state = await setupMocks(page)
    await gotoReport(page)

    // The request opted into the additive breakdown.
    expect(state.lastUrl).toContain('includeMerchantBreakdown=true')

    // "Where is your money?" strip + the per-merchant breakdown panel.
    await expect(page.getByText('Where is your money?')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Breakdown by merchant')).toBeVisible()

    // Both merchant rows render with their names.
    await expect(page.getByText('Amaena - Externo')).toBeVisible()
    await expect(page.getByText('Amaena - A')).toBeVisible()
  })
})
