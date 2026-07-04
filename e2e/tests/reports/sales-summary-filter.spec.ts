/**
 * E2E tests for the Sales Summary payment-method / card-type filter.
 *
 * Covers the persistent regression surface of the filter feature:
 *  - default "All" state with no Filtered badge
 *  - opening the Filter-by panel and revealing the Card-type level
 *  - applying a Card → AMEX filter and asserting the outgoing request carries
 *    paymentMethod=CARD & cardType=AMEX + the Filtered badge appears
 *  - order-level rows + distribution chart hidden under a filter
 *  - enriched payment-method breakdown expanding Card → sub-types
 *  - clearing the filter refetches unfiltered
 *  - QR Legacy filter option is absent for a non-MindForm venue
 *
 * The app default E2E locale is English (i18n fallbackLng: 'en'; the language
 * detector returns 'en' for the Chromium default en-US). Assertions therefore
 * use the English `reports` namespace strings.
 *
 * Playwright routes use LIFO matching — the specific sales-summary route is
 * registered AFTER setupApiMocks (which installs the catch-all + auth mocks).
 */

import { test, expect, Page } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'
import { StaffRole, createMockVenue } from '../../fixtures/mock-data'

test.setTimeout(45_000)
test.use({ viewport: { width: 1280, height: 900 } })

// ─── Fixtures ────────────────────────────────────────────────────

// Mirrors SalesSummaryResponse (src/services/reports/salesSummary.service.ts).
const SUMMARY_UNFILTERED = {
  dateRange: { startDate: '2026-01-01T00:00:00Z', endDate: '2026-01-31T23:59:59Z' },
  reportType: 'summary',
  summary: {
    grossSales: 10000,
    items: 10000,
    serviceCosts: 0,
    discounts: 500,
    refunds: 200,
    netSales: 9300,
    deferredSales: 0,
    taxes: 1600,
    tips: 800,
    platformFees: 150,
    staffCommissions: 50,
    commissions: 150,
    totalCollected: 9950,
    netProfit: 9100,
    transactionCount: 23,
  },
  byPaymentMethod: [
    { method: 'CREDIT_CARD', amount: 6000, count: 12, percentage: 60 },
    { method: 'CASH', amount: 3000, count: 8, percentage: 30 },
    { method: 'DEBIT_CARD', amount: 1000, count: 3, percentage: 10 },
  ],
  byPaymentMethodDetailed: [
    {
      bucket: 'CARD',
      amount: 7000,
      count: 15,
      percentage: 70,
      tips: 600,
      refunds: 200,
      platformFees: 150,
      subBuckets: [
        { type: 'CREDIT', amount: 4000, count: 8, percentage: 57, platformFees: 80 },
        { type: 'DEBIT', amount: 1000, count: 3, percentage: 14, platformFees: 20 },
        { type: 'AMEX', amount: 1500, count: 3, percentage: 21, platformFees: 40 },
        { type: 'INTERNATIONAL', amount: 500, count: 1, percentage: 7, platformFees: 10 },
      ],
    },
    { bucket: 'CASH', amount: 3000, count: 8, percentage: 30, tips: 200, refunds: 0, platformFees: 0 },
  ],
  filtered: false,
}

// Card → AMEX filter: order-derived metrics null, no payment-method breakdown.
const SUMMARY_FILTERED_AMEX = {
  ...SUMMARY_UNFILTERED,
  summary: {
    grossSales: null,
    items: null,
    serviceCosts: null,
    discounts: null,
    refunds: 0,
    netSales: null,
    deferredSales: null,
    taxes: null,
    tips: 100,
    platformFees: 40,
    staffCommissions: 0,
    commissions: 40,
    totalCollected: 1500,
    netProfit: 1460,
    transactionCount: 3,
  },
  byPaymentMethod: undefined,
  byPaymentMethodDetailed: undefined,
  filtered: true,
}

// ─── Helpers ─────────────────────────────────────────────────────

/** Plain restaurant venue (non-MindForm) with reports access. */
function reportsVenue() {
  return createMockVenue({
    id: 'venue-alpha',
    name: 'Restaurante Alpha',
    slug: 'venue-alpha',
  })
}

interface SalesSummaryMockState {
  /** Most recent sales-summary request URL — used to assert query params. */
  lastUrl: string | null
}

/**
 * Wires up auth + the sales-summary endpoint. The route handler branches on the
 * `paymentMethod` query param: present → FILTERED fixture, else → UNFILTERED.
 * Returns a mutable state object whose `lastUrl` records the last request URL.
 *
 * Registered AFTER setupApiMocks so it wins LIFO matching. The merchant-account
 * and settlement-info endpoints are stubbed empty so the merchant pill never
 * renders and settlement labels stay off — keeping the DOM deterministic.
 */
async function setupSalesSummaryMocks(page: Page): Promise<SalesSummaryMockState> {
  const venue = reportsVenue()
  await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [venue] })

  const state: SalesSummaryMockState = { lastUrl: null }

  // Merchant accounts + settlement info — empty arrays (deterministic).
  await page.route('**/api/v1/dashboard/venues/*/payment-config/merchant-accounts*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) }),
  )
  await page.route('**/api/v1/dashboard/venues/*/payment-config/settlement-info*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) }),
  )

  // Sales summary — branch on the paymentMethod query param.
  await page.route('**/api/v1/dashboard/reports/sales-summary*', (route) => {
    const url = route.request().url()
    state.lastUrl = url
    const filtered = new URL(url).searchParams.has('paymentMethod')
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: filtered ? SUMMARY_FILTERED_AMEX : SUMMARY_UNFILTERED }),
    })
  })

  return state
}

async function gotoReport(page: Page) {
  await page.goto('/venues/venue-alpha/reports/sales-summary')
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})

  // Hide React Query devtools if open (it overlays + blocks interactions).
  await page.evaluate(() => {
    const panel = document.querySelector('.tsqd-parent-container')
    if (panel) (panel as HTMLElement).style.display = 'none'
    const toggle = document.querySelector('.tsqd-open-btn-container') as HTMLElement
    if (toggle) toggle.style.display = 'none'
  })

  // Wait for the report header (proves data loaded past the skeleton).
  await expect(page.getByRole('heading', { name: /Sales Summary/i })).toBeVisible({ timeout: 15_000 })
}

/** The controls Sheet (Radix dialog) that hosts the Filter-by panel. */
function controlsSheet(page: Page) {
  return page.locator('[role="dialog"]')
}

/**
 * The Filter-by sub-panel root (the slide-in div that owns its own header +
 * Apply button). Each sub-panel renders its own "Apply" button, so the Apply
 * click MUST be scoped to this panel to avoid a strict-mode multi-match.
 */
function filterPanel(page: Page) {
  return controlsSheet(page)
    .locator('div')
    .filter({ has: page.getByRole('heading', { name: 'Filter by', level: 2 }) })
    .first()
}

/** Click the Filter-by panel's Apply button and wait for the filtered request. */
async function applyFilter(page: Page) {
  await Promise.all([
    page.waitForRequest(
      (req) => req.url().includes('/sales-summary') && req.url().includes('paymentMethod='),
      { timeout: 10_000 },
    ),
    filterPanel(page).getByRole('button', { name: 'Apply', exact: true }).click(),
  ])
}

/**
 * Open the Filter-by panel: click the "Filter by" pill in the pills row, then
 * wait for the Filter-by panel heading inside the Sheet to slide in.
 */
async function openFilterPanel(page: Page) {
  // The pills row "Filter by" control. There may be a same-named row inside the
  // (closed) Sheet, so target the first visible one — the pill button.
  const filterPill = page.getByRole('button', { name: /Filter by/i }).first()
  await expect(filterPill).toBeVisible({ timeout: 10_000 })
  await filterPill.click()

  const sheet = controlsSheet(page)
  await expect(sheet).toBeVisible({ timeout: 5_000 })
  // Panel heading (h2) — distinct from the row label.
  await expect(sheet.getByRole('heading', { name: 'Filter by', level: 2 })).toBeVisible({ timeout: 5_000 })
  // Let the slide-in transition finish (300ms).
  await page.waitForTimeout(500)
}

// ─── Tests ───────────────────────────────────────────────────────

test.describe('Sales Summary — payment filter', () => {
  test('1 — default state shows "All" and no Filtered badge', async ({ page }) => {
    await setupSalesSummaryMocks(page)
    await gotoReport(page)

    // The Filter-by pill shows the "All" value (filterBy.none).
    const filterPill = page.getByRole('button', { name: /Filter by/i }).first()
    await expect(filterPill).toContainText('All')

    // No "Filtered" badge in the header.
    await expect(page.getByText(/Filtered/)).toHaveCount(0)
  })

  test('2 — selecting Card reveals the Card type level', async ({ page }) => {
    await setupSalesSummaryMocks(page)
    await gotoReport(page)
    await openFilterPanel(page)

    const sheet = controlsSheet(page)

    // Card type level is NOT visible until Card is chosen.
    await expect(sheet.getByRole('heading', { name: 'Card type', level: 3 })).toHaveCount(0)

    // Choose the "Card" payment-method option (label inside the panel).
    await sheet.getByText('Card', { exact: true }).click()

    // Card type radiogroup heading + its options appear.
    await expect(sheet.getByRole('heading', { name: 'Card type', level: 3 })).toBeVisible({ timeout: 5_000 })
    await expect(sheet.getByText('Credit', { exact: true })).toBeVisible()
    await expect(sheet.getByText('Debit', { exact: true })).toBeVisible()
    await expect(sheet.getByText('AMEX', { exact: true })).toBeVisible()
    await expect(sheet.getByText('International', { exact: true })).toBeVisible()
  })

  test('3 — applying AMEX sends paymentMethod=CARD&cardType=AMEX + shows badge', async ({ page }) => {
    const state = await setupSalesSummaryMocks(page)
    await gotoReport(page)
    await openFilterPanel(page)

    const sheet = controlsSheet(page)
    await sheet.getByText('Card', { exact: true }).click()
    await expect(sheet.getByRole('heading', { name: 'Card type', level: 3 })).toBeVisible({ timeout: 5_000 })
    await sheet.getByText('AMEX', { exact: true }).click()

    // Apply — wait for the filtered request to go out (scoped to the panel).
    const [request] = await Promise.all([
      page.waitForRequest(
        (req) => req.url().includes('/api/v1/dashboard/reports/sales-summary') && req.url().includes('paymentMethod='),
        { timeout: 10_000 },
      ),
      filterPanel(page).getByRole('button', { name: 'Apply', exact: true }).click(),
    ])

    // Outgoing request carries the filter params.
    expect(request.url()).toContain('paymentMethod=CARD')
    expect(request.url()).toContain('cardType=AMEX')
    // Recorder agrees.
    expect(state.lastUrl).toContain('paymentMethod=CARD')
    expect(state.lastUrl).toContain('cardType=AMEX')

    // Header shows the Filtered badge with the AMEX value (single interpolated
    // text node "Filtered: AMEX").
    await expect(page.getByText(/Filtered:\s*AMEX/i)).toBeVisible({ timeout: 5_000 })
  })

  test('4 — under a filter, order rows hidden + clear-filter hint shown', async ({ page }) => {
    await setupSalesSummaryMocks(page)
    await gotoReport(page)
    await openFilterPanel(page)

    const sheet = controlsSheet(page)
    await sheet.getByText('Card', { exact: true }).click()
    await expect(sheet.getByRole('heading', { name: 'Card type', level: 3 })).toBeVisible({ timeout: 5_000 })
    await sheet.getByText('AMEX', { exact: true }).click()
    await applyFilter(page)

    // Sheet closed after apply.
    await expect(controlsSheet(page)).toHaveCount(0, { timeout: 5_000 })

    // Order-derived "Gross sales" row is hidden under the filter.
    await expect(page.getByText('Gross sales', { exact: true })).toHaveCount(0)

    // The "clear the filter" distribution hint is visible.
    await expect(
      page.getByText('Clear the filter to see the full distribution').first(),
    ).toBeVisible({ timeout: 5_000 })

    // Under a payment-method filter the period statement is suppressed (it can't
    // honestly answer "where's my money" per-method), and a one-line note explains it.
    await expect(page.getByTestId('statement-hero-net')).toHaveCount(0)
    await expect(page.getByTestId('statement-filtered-note')).toBeVisible()
  })

  test('5 — enriched card-type detail lives in the period statement (Pro, unfiltered)', async ({ page }) => {
    await setupSalesSummaryMocks(page)
    await gotoReport(page)

    // On the Pro, unfiltered view the statement replaces the old Payment Methods
    // block; card sub-types now live behind its "View card type detail" toggle.
    await expect(page.getByTestId('statement-hero-net')).toBeVisible({ timeout: 10_000 })

    // Sub-types hidden until expanded.
    await expect(page.getByText('AMEX', { exact: true })).toHaveCount(0)

    await page.getByTestId('statement-card-detail-toggle').click()

    // Card sub-buckets become visible (labels from the shared cardType options).
    await expect(page.getByText('AMEX', { exact: true }).first()).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('International', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Credit', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Debit', { exact: true }).first()).toBeVisible()
  })

  test('6 — clearing the filter returns to the unfiltered view', async ({ page }) => {
    await setupSalesSummaryMocks(page)
    await gotoReport(page)
    await openFilterPanel(page)

    const sheet = controlsSheet(page)
    await sheet.getByText('Card', { exact: true }).click()
    await expect(sheet.getByRole('heading', { name: 'Card type', level: 3 })).toBeVisible({ timeout: 5_000 })
    await sheet.getByText('AMEX', { exact: true }).click()
    await applyFilter(page)

    // Filtered state confirmed (badge node reads "Filtered: AMEX").
    await expect(page.getByText(/Filtered:\s*AMEX/i)).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Gross sales', { exact: true })).toHaveCount(0)

    // Clear via the badge X button (aria-label "Clear filter"). The query key
    // reverts to the unfiltered filters — already cached from initial load, so
    // React Query serves it without a new request. We assert on the resulting
    // unfiltered view rather than a network call.
    await page.getByRole('button', { name: 'Clear filter' }).click()

    // Badge gone, order-level rows back, distribution hint gone.
    await expect(page.getByText(/Filtered/)).toHaveCount(0, { timeout: 5_000 })
    await expect(page.getByText('Gross sales', { exact: true }).first()).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Clear the filter to see the full distribution')).toHaveCount(0)
  })

  test('7 — non-MindForm venue: QR Legacy option is absent', async ({ page }) => {
    await setupSalesSummaryMocks(page)
    await gotoReport(page)
    await openFilterPanel(page)

    const sheet = controlsSheet(page)
    // Payment-method options present…
    await expect(sheet.getByText('Card', { exact: true })).toBeVisible()
    await expect(sheet.getByText('Cash', { exact: true })).toBeVisible()
    // …but QR Legacy is gated to MindForm only.
    await expect(sheet.getByText('QR Legacy', { exact: true })).toHaveCount(0)
  })
})
