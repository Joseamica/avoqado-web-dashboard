/**
 * E2E for the Available Balance settlement timeline redesign (bank-statement day
 * grouping) + the disabled manual-confirmation flow. Everything on this page is an
 * automatic ESTIMATE by settlement date (no bank integration yet), so:
 *  - each day renders as ONE bordered group (a "Jun 7" with 3 card types reads as
 *    one day, not three loose rows), with the day's net total in the header
 *  - today is highlighted with a "Today" badge
 *  - days older than a week sit behind one "Show earlier days" button
 *  - the "Confirmar liquidación / Confirmar Todo" banner must NOT render
 *
 * Playwright routes are LIFO — specific routes are registered AFTER setupApiMocks.
 * Default E2E locale is English (i18n fallbackLng 'en').
 */

import { test, expect, Page } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'
import { StaffRole, createMockVenue } from '../../fixtures/mock-data'

test.setTimeout(45_000)
test.use({ viewport: { width: 1280, height: 900 } })

const TZ = 'America/Mexico_City'
/** yyyy-MM-dd of (now + n days) in the venue timezone — matches the component's day math. */
function dayOffset(n: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(Date.now() + n * 86_400_000))
}
/** Noon venue-local timestamp for a day key (safe from tz day-boundary drift). */
const at = (key: string) => `${key}T12:00:00-06:00`

const OLD_DAY = dayOffset(-20)
const PAST_DAY = dayOffset(-3)
const TODAY = dayOffset(0)

const TIMELINE = [
  // Old day — must sit behind the "show earlier" button.
  { date: at(OLD_DAY), cardType: 'CREDIT', transactionCount: 1, grossAmount: 520, fees: 20, netAmount: 500, status: 'SETTLED', estimatedSettlementDate: at(dayOffset(-19)) },
  // A recent past day with two card types.
  { date: at(PAST_DAY), cardType: 'CREDIT', transactionCount: 1, grossAmount: 885.5, fees: 70.84, netAmount: 814.66, status: 'SETTLED', estimatedSettlementDate: at(dayOffset(-2)) },
  { date: at(PAST_DAY), cardType: 'AMEX', transactionCount: 1, grossAmount: 85, fees: 6.8, netAmount: 78.2, status: 'SETTLED', estimatedSettlementDate: at(dayOffset(-1)) },
  // TODAY with three entries (the screenshot's "Jun 7" case: Amex + Cash + Credit).
  { date: at(TODAY), cardType: 'AMEX', transactionCount: 2, grossAmount: 1046, fees: 43.68, netAmount: 1002.32, status: 'PENDING', estimatedSettlementDate: at(dayOffset(4)) },
  { date: at(TODAY), cardType: 'CASH', transactionCount: 1, grossAmount: 2000, fees: 0, netAmount: 2000, status: 'SETTLED', estimatedSettlementDate: null },
  { date: at(TODAY), cardType: 'CREDIT', transactionCount: 1, grossAmount: 100, fees: 4.18, netAmount: 95.82, status: 'PENDING', estimatedSettlementDate: at(dayOffset(2)) },
]

const CARD_BREAKDOWN = [
  { cardType: 'CREDIT', baseSales: 1400, tips: 105.5, totalSales: 1505.5, fees: 95.02, netAmount: 1410.48, settlementDays: 1, pendingAmount: 95.82, settledAmount: 1314.66, transactionCount: 3 },
  { cardType: 'AMEX', baseSales: 1100, tips: 31, totalSales: 1131, fees: 50.48, netAmount: 1080.52, settlementDays: 3, pendingAmount: 1002.32, settledAmount: 78.2, transactionCount: 3 },
  { cardType: 'CASH', baseSales: 2000, tips: 0, totalSales: 2000, fees: 0, netAmount: 2000, settlementDays: 0, pendingAmount: 0, settledAmount: 2000, transactionCount: 1 },
]

const SUMMARY = {
  totalSales: 4636.5,
  totalFees: 145.5,
  availableNow: 3392.86,
  pendingSettlement: 1098.14,
  estimatedNextSettlement: { date: at(dayOffset(2)), amount: 95.82 },
}

const json = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) })

async function setupBalanceMocks(page: Page) {
  const venue = createMockVenue({
    id: 'venue-alpha',
    name: 'Restaurante Alpha',
    slug: 'venue-alpha',
    // The route is PermissionProtectedRoute("settlements:read") — the default mock
    // permission set doesn't include it, so grant it explicitly.
    permissions: [
      'menu:read',
      'orders:read',
      'payments:read',
      'reports:read',
      'settings:read',
      'settlements:read',
      'analytics:read',
    ],
  })
  await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [venue] })

  // Deterministic PRO gate (AvailableBalance is FeatureGate ADVANCED_REPORTS).
  await page.route('**/api/v1/dashboard/venues/*/plan-tier*', route =>
    route.fulfill(json({ tier: 'PRO', grandfathered: false, exempt: false })),
  )
  await page.route('**/api/v1/dashboard/venues/*/cash-closeouts/expected*', route =>
    route.fulfill(json({ needsCloseout: false, daysSinceLastCloseout: 0, hasCloseouts: false, expectedAmount: 0 })),
  )
  await page.route('**/api/v1/dashboard/venues/*/available-balance/by-card-type*', route => route.fulfill(json(CARD_BREAKDOWN)))
  await page.route('**/api/v1/dashboard/venues/*/available-balance/timeline*', route => route.fulfill(json(TIMELINE)))
  await page.route('**/api/v1/dashboard/venues/*/available-balance/settlement-calendar*', route => route.fulfill(json([])))
  await page.route('**/api/v1/dashboard/venues/*/available-balance/settlement-week*', route => {
    const monday = new URL(route.request().url()).searchParams.get('weekStart')
    if (!monday) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'mock expected weekStart' }) })
    const end = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(new Date(`${monday}T12:00:00Z`).getTime() + 6 * 86_400_000))
    return route.fulfill(json({ weekStart: monday, weekEnd: end, days: [], weekTotal: { gross: 0, commission: 0, net: 0, count: 0 } }))
  })
  // Summary last: single '*' doesn't cross '/', so this matches only the bare endpoint.
  await page.route('**/api/v1/dashboard/venues/*/available-balance*', route => route.fulfill(json(SUMMARY)))
}

async function gotoBalance(page: Page) {
  await page.goto('/venues/venue-alpha/available-balance')
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
  // The TanStack Query devtools panel overlays the bottom of the page and
  // intercepts clicks on the collapsed timeline card — hide it (same as the
  // sales-summary-statement spec).
  await page.evaluate(() => {
    const panel = document.querySelector('.tsqd-parent-container')
    if (panel) (panel as HTMLElement).style.display = 'none'
  })
}

async function gotoBalanceAndOpenTimeline(page: Page) {
  await gotoBalance(page)
  // Open the collapsed timeline card.
  await page.getByRole('heading', { name: 'Settlement Timeline' }).click()
  await expect(page.getByTestId('settlement-timeline')).toBeVisible({ timeout: 10_000 })
}

test.describe('Available Balance — settlement timeline (day groups, estimates only)', () => {
  test('groups entries into one bordered block per day with the day net total', async ({ page }) => {
    await setupBalanceMocks(page)
    await gotoBalanceAndOpenTimeline(page)

    // Today's group holds ALL THREE card types of the day (one day, not loose rows).
    const today = page.getByTestId(`timeline-day-${TODAY}`)
    await expect(today).toBeVisible()
    await expect(today).toContainText('1,002.32') // Amex
    await expect(today).toContainText('2,000.00') // Cash
    await expect(today).toContainText('95.82') // Credit
    // Day header shows the day's summed net (1002.32 + 2000 + 95.82).
    await expect(today).toContainText('3,098.14')
    // Today is labeled.
    await expect(today).toContainText('Today')

    // The recent past day renders as its own separate group.
    await expect(page.getByTestId(`timeline-day-${PAST_DAY}`)).toBeVisible()
  })

  test('cash settles instantly; card rows show an ~estimated settlement date', async ({ page }) => {
    await setupBalanceMocks(page)
    await gotoBalanceAndOpenTimeline(page)

    const today = page.getByTestId(`timeline-day-${TODAY}`)
    await expect(today).toContainText('Instant') // CASH → no settlement date
    await expect(today).toContainText('~') // card rows carry the estimate marker
    // The estimates disclaimer is always visible.
    await expect(page.getByText(/confirmed deposit/)).toBeVisible()
  })

  test('old days sit behind "Show earlier days" and expand on click', async ({ page }) => {
    await setupBalanceMocks(page)
    await gotoBalanceAndOpenTimeline(page)

    await expect(page.getByTestId(`timeline-day-${OLD_DAY}`)).toHaveCount(0)
    const earlier = page.getByTestId('settlement-timeline-earlier')
    await expect(earlier).toBeVisible()
    await earlier.click()
    await expect(page.getByTestId(`timeline-day-${OLD_DAY}`)).toBeVisible()
  })

  test('manual settlement-confirmation flow is gone (everything is an automatic estimate)', async ({ page }) => {
    await setupBalanceMocks(page)
    await gotoBalance(page)

    // The page rendered (timeline card present)…
    await expect(page.getByRole('heading', { name: 'Settlement Timeline' })).toBeVisible({ timeout: 10_000 })
    // …but no confirmation banner/button in ANY locale.
    await expect(page.getByText(/Confirmar Todo|Confirm All/i)).toHaveCount(0)
    await expect(page.getByText(/Confirmación de Liquidación|Settlement Confirmation/i)).toHaveCount(0)
  })
})
