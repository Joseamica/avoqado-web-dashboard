/**
 * E2E for the Sales Summary "period statement" (Mercury-style) — the redesign
 * that replaced the old money strip + merchant breakdown + settlement calendar
 * + payment-methods blocks with one cohesive card. Covers:
 *  - the hero reconciliation (You keep = collected − fees; segments; fee shown once)
 *  - per-merchant rows: effective rate %, payout chips (lands / should-have-landed)
 *  - the honesty note for unprojected money (card money with no settlement rule)
 *  - the shared SettlementWeekStrip: 7 landing-day cells, week total, ‹ › paging, day detail
 *  - card-type detail expander
 *  - PRO gating: FREE venues fall back to the old Payment Methods block + paywall
 *
 * All additive: renders from optional byPaymentMethodDetailed / byMerchantAccount /
 * settlementCalendar. Default E2E locale is English (i18n fallbackLng 'en').
 * Playwright routes are LIFO — the sales-summary route is registered AFTER
 * setupApiMocks (catch-all + auth).
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

/** Add n days to a bare yyyy-MM-dd (UTC parts, no timezone shift). */
function addDaysKey(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

// Internally CONSISTENT scenario so the statement reconciles visibly:
//   cash 9,070 + card collected 15,650 = collected 24,720
//   fees 563.30 → You keep 24,156.70 = cash 9,070 + card net 15,086.70
//   Σ calendar net (1,757.40 + 13,329.30) = card net 15,086.70 → no unprojected chip.
const SUMMARY_WITH_MERCHANTS = {
  dateRange: { startDate: '2026-05-01T00:00:00Z', endDate: '2026-05-31T23:59:59Z' },
  reportType: 'summary',
  summary: {
    grossSales: 24720,
    items: 24720,
    serviceCosts: 0,
    discounts: 0,
    refunds: 0,
    netSales: 24720,
    deferredSales: 0,
    taxes: 0,
    tips: 0,
    platformFees: 563.3,
    staffCommissions: 0,
    commissions: 563.3,
    totalCollected: 24156.7,
    netProfit: 24156.7,
    transactionCount: 34,
  },
  byPaymentMethodDetailed: [
    {
      bucket: 'CARD',
      amount: 15650,
      count: 22,
      percentage: 63.3,
      tips: 0,
      refunds: 0,
      platformFees: 563.3,
      subBuckets: [
        { type: 'CREDIT', amount: 10000, count: 12, percentage: 63.9, platformFees: 400 },
        { type: 'DEBIT', amount: 4650, count: 8, percentage: 29.7, platformFees: 130 },
        { type: 'AMEX', amount: 1000, count: 2, percentage: 6.4, platformFees: 33.3 },
      ],
    },
    { bucket: 'CASH', amount: 9070, count: 12, percentage: 36.7, tips: 0, refunds: 0, platformFees: 0 },
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
      estimatedSettlement: { nextDate: FUTURE_DATE, settlementDays: 1 },
      settlementRules: [
        { cardType: 'CREDIT', settlementDays: 1 },
        { cardType: 'DEBIT', settlementDays: 1 },
        { cardType: 'AMEX', settlementDays: 3 },
      ],
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
      estimatedSettlement: { nextDate: PAST_DATE, settlementDays: 1 },
    },
  ],
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
      byMerchant: [{ merchantAccountId: 'ext', displayName: 'Amaena - Externo', platformFee: 497.7, netToReceive: 13329.3, transactionCount: 17 }],
    },
  ],
  filtered: false,
}

interface MockState {
  lastUrl: string | null
  /** Every `weekStart` the SettlementWeekStrip requested, in order (for ‹ › paging assertions). */
  requestedWeeks: string[]
}

/**
 * Mock the settlement-week endpoint the SettlementWeekStrip fetches, anchored
 * DYNAMICALLY to whatever `weekStart` (the Monday) the strip is currently
 * showing — so the returned day keys always match the rendered cells, even after
 * paging with ‹ ›. Two populated days: Mon net 965 + Tue net 528.5 → week 1,493.50.
 */
async function routeSettlementWeek(page: Page, state: MockState): Promise<void> {
  await page.route('**/api/v1/dashboard/venues/*/available-balance/settlement-week*', route => {
    const monday = new URL(route.request().url()).searchParams.get('weekStart')
    // The strip must always send weekStart; a missing param means a real regression
    // upstream — fail loudly (400) instead of masking it with a fixed date.
    if (!monday) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'mock expected weekStart' }) })
    state.requestedWeeks.push(monday)
    const merchant = { merchantAccountId: 'm1', displayName: 'Amaena - B', provider: 'AngelPay (Nexgo)' }
    const day = (date: string, status: string, gross: number, commission: number, cardType: string) => ({
      date,
      status,
      gross,
      commission,
      net: gross - commission,
      count: 1,
      byMerchant: [{ ...merchant, gross, commission, net: gross - commission, count: 1 }],
      byCardType: [{ cardType, gross, commission, net: gross - commission, count: 1 }],
    })
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          weekStart: monday,
          weekEnd: addDaysKey(monday, 6),
          days: [day(monday, 'settled', 1000, 35, 'CREDIT'), day(addDaysKey(monday, 1), 'projected', 550, 21.5, 'DEBIT')],
          weekTotal: { gross: 1550, commission: 56.5, net: 1493.5, count: 2 },
        },
      }),
    })
  })
}

async function setupMocks(page: Page, summaryOverride?: object, extraOptions: Partial<SetupApiMocksOptions> = {}): Promise<MockState> {
  const venue = createMockVenue({ id: 'venue-alpha', name: 'Restaurante Alpha', slug: 'venue-alpha' })
  await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [venue], ...extraOptions })

  const state: MockState = { lastUrl: null, requestedWeeks: [] }
  await routeSettlementWeek(page, state)

  await page.route('**/api/v1/dashboard/venues/*/payment-config/merchant-accounts*', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) }),
  )
  await page.route('**/api/v1/dashboard/venues/*/payment-config/settlement-info*', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) }),
  )

  await page.route('**/api/v1/dashboard/reports/sales-summary*', route => {
    state.lastUrl = route.request().url()
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: summaryOverride ?? SUMMARY_WITH_MERCHANTS }),
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

test.describe('Sales Summary — period statement', () => {
  test('requests both additive blocks and reconciles the hero', async ({ page }) => {
    const state = await setupMocks(page)
    await gotoReport(page)

    expect(state.lastUrl).toContain('includeMerchantBreakdown=true')
    expect(state.lastUrl).toContain('includeSettlementProjection=true')

    // Hero: You keep = collected − fees.
    await expect(page.getByTestId('statement-hero-net')).toContainText('24,156.70', { timeout: 10_000 })
    await expect(page.getByTestId('statement-collected')).toContainText('24,720')
    // Fee total appears exactly once, as a deduction.
    await expect(page.getByTestId('statement-fees')).toContainText('563.30')
  })

  test('per-merchant rows show effective rate and payout chips', async ({ page }) => {
    await setupMocks(page)
    await gotoReport(page)

    // Merchant identity renders in both the desktop table and the mobile cards
    // (one hidden by CSS), so scope with .first() to dodge strict-mode duplicates.
    await expect(page.getByText('Amaena - Externo').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Amaena - A').first()).toBeVisible()
    // Effective rate 497.7/13827 ≈ 3.6% and 65.6/1823 ≈ 3.6%.
    await expect(page.getByText(/3\.6%/).first()).toBeVisible()
    // ext settles in the future → "lands"; a settled in the past → "landed".
    await expect(page.getByTestId('payout-chip-lands').first()).toBeVisible()
    await expect(page.getByTestId('payout-chip-landed').first()).toBeVisible()
  })

  test('settlement week strip renders 7 landing-day cells and the week total', async ({ page }) => {
    await setupMocks(page)
    await gotoReport(page)

    await expect(page.getByTestId('settlement-week')).toBeVisible({ timeout: 10_000 })
    // Always exactly 7 day cells (Mon–Sun), regardless of how many land.
    await expect(page.locator('[data-testid^="settlement-week-day-"]')).toHaveCount(7)
    // Week total = net of the two landing days (965 + 528.5).
    await expect(page.getByTestId('settlement-week-total')).toContainText('1,493.50')
  })

  test('settlement week strip pages back a week with ‹ (re-fetches the prior Monday)', async ({ page }) => {
    const state = await setupMocks(page)
    await gotoReport(page)
    await expect(page.getByTestId('settlement-week')).toBeVisible({ timeout: 10_000 })

    const firstMonday = state.requestedWeeks[0]
    await page.getByTestId('settlement-week-prev').click()
    // Paging back → a fresh request keyed to the Monday one week earlier.
    await expect.poll(() => state.requestedWeeks.at(-1)).toBe(addDaysKey(firstMonday, -7))
    // The rendered cells move to that earlier week too.
    await expect(page.getByTestId(`settlement-week-day-${addDaysKey(firstMonday, -7)}`)).toBeVisible()
  })

  test('settlement week strip: clicking a landing day opens its per-merchant detail', async ({ page }) => {
    const state = await setupMocks(page)
    await gotoReport(page)
    await expect(page.getByTestId('settlement-week')).toBeVisible({ timeout: 10_000 })

    const monday = state.requestedWeeks[0]
    await page.getByTestId(`settlement-week-day-${monday}`).click()
    const detail = page.getByTestId('settlement-week-detail')
    await expect(detail).toBeVisible({ timeout: 10_000 })
    await expect(detail).toContainText('Amaena - B')
    await expect(detail).toContainText('965') // "you receive $965.00"
  })

  test('settlement week strip: empty week shows the "nothing lands" note', async ({ page }) => {
    await setupMocks(page)
    // LIFO: this more-specific override wins over setupMocks' populated route.
    await page.route('**/api/v1/dashboard/venues/*/available-balance/settlement-week*', route => {
      const monday = new URL(route.request().url()).searchParams.get('weekStart')
      if (!monday) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'mock expected weekStart' }) })
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { weekStart: monday, weekEnd: addDaysKey(monday, 6), days: [], weekTotal: { gross: 0, commission: 0, net: 0, count: 0 } },
        }),
      })
    })
    await gotoReport(page)

    await expect(page.getByTestId('settlement-week')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('settlement-week-empty')).toBeVisible()
    await expect(page.getByTestId('settlement-week-detail')).toHaveCount(0)
  })

  test('honesty note appears when card money has no estimated date', async ({ page }) => {
    // Same payload but an EMPTY calendar → all card net is unprojected.
    await setupMocks(page, { ...SUMMARY_WITH_MERCHANTS, settlementCalendar: [] })
    await gotoReport(page)

    const note = page.getByTestId('statement-unprojected')
    await expect(note).toBeVisible({ timeout: 10_000 })
    await expect(note).toContainText('15,086.70')
  })

  test('expanding a merchant reveals its settlement rules', async ({ page }) => {
    await setupMocks(page)
    await gotoReport(page)

    await page.getByTestId('merchant-statement-row').filter({ hasText: 'Amaena - Externo' }).click()
    // CREDIT & DEBIT both 1 day → grouped "Visa/MC"; AMEX 3 days listed separately.
    // Detail renders in both layouts (shared expand state) → scope with .first().
    await expect(page.getByText(/Visa\/MC/).first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/3 business days/).first()).toBeVisible()
  })

  test('card-type detail expander lists the sub-buckets', async ({ page }) => {
    await setupMocks(page)
    await gotoReport(page)

    await page.getByTestId('statement-card-detail-toggle').click()
    await expect(page.getByText('Credit', { exact: true })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Debit', { exact: true })).toBeVisible()
  })

  test('FREE venue: statement hidden, Payment Methods block + PRO paywall shown', async ({ page }) => {
    await setupMocks(page, undefined, { planState: { grandfathered: false, hasPlan: false, state: 'none', planTier: null } })
    // Deterministic FREE gate (see the old spec's note on the /plan-tier fail-open).
    await page.route('**/api/v1/dashboard/venues/*/plan-tier', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { tier: 'FREE', grandfathered: false, exempt: false } }),
      }),
    )

    await gotoReport(page)

    // Statement must NOT render…
    await expect(page.getByTestId('statement-hero-net')).toHaveCount(0)
    // …the legacy Payment Methods block returns…
    await expect(page.getByText('Payment Methods').first()).toBeVisible({ timeout: 10_000 })
    // …and the PRO paywall upsell shows.
    await expect(page.getByRole('button', { name: /Upgrade to Pro/i })).toBeVisible()
  })
})
