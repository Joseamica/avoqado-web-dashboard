/**
 * E2E for the Sales Summary per-merchant reconciliation:
 *  - Entrega 1: the "Where is your money?" strip + the per-merchant card
 *    breakdown panel (Collected · Commission · Net to receive · Share %)
 *  - Entrega 2: the settlement mini-calendar ("when does the card money land")
 *    + the per-merchant "Lands ~" / "Should have landed ~" line
 *  - PRO gating: the whole block is ADVANCED_REPORTS (PRO tier); FREE venues
 *    see the FeatureGate paywall instead.
 *
 * All additive: they render from the optional `byMerchantAccount` and
 * `settlementCalendar` fields. The request must carry includeMerchantBreakdown
 * and includeSettlementProjection.
 *
 * Default E2E locale is English (i18n fallbackLng: 'en'), so assertions use the
 * English `reports` namespace strings. Merchant display names come from the
 * mocked payload, so they render verbatim regardless of locale.
 *
 * Playwright routes are LIFO — the specific sales-summary route is registered
 * AFTER setupApiMocks (catch-all + auth).
 */

import { test, expect, Page } from '@playwright/test'
import { setupApiMocks, type SetupApiMocksOptions } from '../../fixtures/api-mocks'
import { StaffRole, createMockVenue } from '../../fixtures/mock-data'

test.setTimeout(45_000)
test.use({ viewport: { width: 1280, height: 900 } })

/** YYYY-MM-DD relative to the real clock — keeps past/future copy assertions stable. */
function isoDaysFromNow(days: number): string {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}
const PAST_DATE = isoDaysFromNow(-5)
const FUTURE_DATE = isoDaysFromNow(5)

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
      collectedOnCard: 13827, // tip-inclusive since 2026-06-10 (amount + tipAmount)
      platformFee: 497.7,
      netToReceive: 13329.3,
      transactionCount: 17,
      // Future date → the row reads "Lands ~…" (upcoming).
      estimatedSettlement: { nextDate: FUTURE_DATE, settlementDays: 1 },
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
      // Past date → the row must read "Should have landed ~…", NOT future-tense.
      estimatedSettlement: { nextDate: PAST_DATE, settlementDays: 1 },
    },
  ],
  // Entrega 2 — settlement mini-calendar payload (statuses drive the day labels).
  settlementCalendar: [
    {
      date: PAST_DATE,
      status: 'settled',
      totalNet: 1757.4,
      byMerchant: [{ merchantAccountId: 'a', displayName: 'Amaena - A', platformFee: 65.6, netToReceive: 1757.4, transactionCount: 5 }],
    },
    {
      date: FUTURE_DATE,
      status: 'projected',
      totalNet: 13329.3,
      byMerchant: [
        { merchantAccountId: 'ext', displayName: 'Amaena - Externo', platformFee: 497.7, netToReceive: 13329.3, transactionCount: 17 },
      ],
    },
  ],
  filtered: false,
}

interface MockState {
  lastUrl: string | null
}

async function setupMocks(page: Page, extraOptions: Partial<SetupApiMocksOptions> = {}): Promise<MockState> {
  const venue = createMockVenue({ id: 'venue-alpha', name: 'Restaurante Alpha', slug: 'venue-alpha' })
  await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [venue], ...extraOptions })

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

    // The request opted into BOTH additive blocks (breakdown + settlement projection).
    expect(state.lastUrl).toContain('includeMerchantBreakdown=true')
    expect(state.lastUrl).toContain('includeSettlementProjection=true')

    // "Where is your money?" strip + the per-merchant breakdown panel.
    await expect(page.getByText('Where is your money?')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Breakdown by merchant')).toBeVisible()

    // Both merchant rows render with their names.
    await expect(page.getByText('Amaena - Externo')).toBeVisible()
    await expect(page.getByText('Amaena - A')).toBeVisible()
  })

  test('share column shows each merchant\'s % of the net', async ({ page }) => {
    await setupMocks(page)
    await gotoReport(page)

    await expect(page.getByText('Breakdown by merchant')).toBeVisible({ timeout: 10_000 })
    // Header + per-row share: 13329.3 / 15086.7 ≈ 88%, 1757.4 / 15086.7 ≈ 12%.
    await expect(page.getByRole('columnheader', { name: 'Share' })).toBeVisible()
    await expect(page.getByRole('cell', { name: '88%' })).toBeVisible()
    await expect(page.getByRole('cell', { name: '12%' })).toBeVisible()
  })

  test('settlement dates: future reads "Lands ~", past reads "Should have landed ~"', async ({ page }) => {
    await setupMocks(page)
    await gotoReport(page)

    await expect(page.getByText('Breakdown by merchant')).toBeVisible({ timeout: 10_000 })
    // Externo settles in the future → upcoming copy. A settled in the past →
    // past copy (the future-tense regression caught in self-review 2026-06-10).
    await expect(page.getByText(/Lands ~/)).toBeVisible()
    await expect(page.getByText(/Should have landed ~/)).toBeVisible()
  })

  test('settlement mini-calendar renders collapsed, expands to day rows with statuses', async ({ page }) => {
    await setupMocks(page)
    await gotoReport(page)

    // Collapsed header with the incoming (non-settled) total: $13,329.30 projected.
    const calendarToggle = page.getByRole('button', { name: /Settlement calendar/i })
    await expect(calendarToggle).toBeVisible({ timeout: 10_000 })
    await expect(calendarToggle).toContainText('Incoming')

    await calendarToggle.click()

    // Expanded: per-day status labels + per-merchant line + honesty note.
    await expect(page.getByText('estimated · should have landed')).toBeVisible()
    await expect(page.getByText('projected', { exact: true })).toBeVisible()
    await expect(page.getByText(/fee .* you receive/).first()).toBeVisible()
    await expect(page.getByText(/Estimated from each merchant's settlement rules/)).toBeVisible()
  })

  test('FREE venue: reconciliation block hidden, PRO paywall shown instead', async ({ page }) => {
    // Non-grandfathered FREE plan → useTierFeatureAccess('ADVANCED_REPORTS') = no access.
    await setupMocks(page, { planState: { grandfathered: false, hasPlan: false, state: 'none', planTier: null } })

    // The reconciliation block is gated by useTierFeatureAccess('ADVANCED_REPORTS'), which reads
    // GET /plan-tier (getVenuePlanTierInfo), NOT GET /plan. api-mocks.ts does NOT mock /plan-tier,
    // so without this route it falls through to the catch-all → undefined → the hook FAILS OPEN
    // (block renders) and this "is hidden" assertion would wrongly fail. Register our OWN /plan-tier
    // (AFTER setupMocks, LIFO) returning the FREE tier so the gate DENIES deterministically:
    // ADVANCED_REPORTS requires PRO, and TIER_ORDER.indexOf('FREE') < indexOf('PRO') → no access.
    // Scoped to THIS test only — the other tests in this file rely on the fail-open (gate OPEN).
    await page.route('**/api/v1/dashboard/venues/*/plan-tier', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { tier: 'FREE', grandfathered: false, exempt: false } }),
      }),
    )

    await gotoReport(page)

    // The reconciliation block must NOT render…
    await expect(page.getByText('Where is your money?')).not.toBeVisible()
    await expect(page.getByText('Breakdown by merchant')).not.toBeVisible()
    await expect(page.getByRole('button', { name: /Settlement calendar/i })).not.toBeVisible()

    // …and the FeatureGate paywall upsell does (CTA navigates to billing).
    await expect(page.getByRole('button', { name: /Upgrade to Pro/i })).toBeVisible({ timeout: 10_000 })
  })
})
