import { expect, test } from '@playwright/test'

import { setupApiMocks } from '../../fixtures/api-mocks'
import { createMockVenue, StaffRole } from '../../fixtures/mock-data'

test.setTimeout(45_000)

test.beforeEach(async ({ page }) => {
  await page.routeWebSocket('**/socket.io/**', socket => socket.close())
})

const venue = createMockVenue({
  id: 'venue-commercial',
  slug: 'venue-commercial',
  name: 'Avoqado Comercial',
  permissions: ['home:read', 'settings:read', 'billing:read', 'billing:subscriptions:read', 'billing:history:read'],
})

const overview = {
  schemaVersion: 1,
  state: 'READY',
  collectionState: 'PAYMENT_UNDER_REVIEW',
  contract: {
    id: 'contract-commercial',
    status: 'PENDING_PAYMENT',
    cadence: 'MONTHLY',
    currency: 'MXN',
    timezone: 'America/Mexico_City',
    startsAt: '2026-09-01T18:00:00.000Z',
    endedAt: null,
    quoteId: 'quote-commercial',
    lines: [
      {
        lineKey: 'pos',
        targetType: 'PRODUCT',
        targetCode: 'POS',
        priceCode: 'POS_MONTHLY',
        quantity: 1,
        productKind: 'POS',
        name: 'Punto de venta',
        billingUnit: 'VENUE_MONTH',
        listUnitAmountMinor: '24900',
        listSubtotalMinor: '24900',
        discountMinor: '0',
        subtotalMinor: '24900',
        taxMinor: '3984',
        totalMinor: '28884',
        promotionalCycles: null,
        renewalSubtotalMinor: '24900',
        renewalTaxMinor: '3984',
        renewalTotalMinor: '28884',
      },
    ],
    today: {
      listSubtotalMinor: '24900',
      discountMinor: '0',
      subtotalMinor: '24900',
      taxMinor: '3984',
      totalMinor: '28884',
    },
    renewal: {
      listSubtotalMinor: '24900',
      discountMinor: '0',
      subtotalMinor: '24900',
      taxMinor: '3984',
      totalMinor: '28884',
    },
    entitlements: ['POS_CORE'],
  },
  obligations: [
    {
      periodId: 'period-commercial',
      scheduleKey: 'SAAS_MONTHLY',
      cadence: 'MONTHLY',
      sequence: 1,
      startsAt: '2026-09-01T18:00:00.000Z',
      endsAt: '2026-10-01T18:00:00.000Z',
      dueAt: '2026-09-01T18:00:00.000Z',
      graceEndsAt: '2026-09-06T18:00:00.000Z',
      periodStatus: 'OPEN',
      receivableId: 'receivable-commercial',
      reference: 'AVQ-LAB-REFERENCE',
      receivableStatus: 'PARTIALLY_PAID',
      amountDueMinor: '28884',
      allocatedMinor: '0',
      outstandingMinor: '28884',
      currency: 'MXN',
      paymentProvider: 'MANUAL_SPEI',
      paymentState: 'UNDER_REVIEW',
    },
  ],
  latestPaidPeriod: null,
  nextRenewalAt: null,
  recentReceipts: [],
  receiptHistoryHasMore: false,
}

test('keeps the exact Server amount from subscription overview through receipt history without a payment action', async ({ page }) => {
  await page.addInitScript(() => {
    const style = document.createElement('style')
    style.textContent = '.tsqd-parent-container { display: none !important; }'
    if (document.head) document.head.appendChild(style)
    else document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style))
  })
  await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [venue] })
  await page.route('**/api/v1/dashboard/commercial/venues/*/billing/overview', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: overview }) }),
  )
  await page.route('**/api/v1/dashboard/commercial/venues/*/billing/receipts*', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          schemaVersion: 1,
          state: 'READY',
          items: [
            {
              id: 'receipt-commercial',
              provider: 'MANUAL_SPEI',
              entryType: 'PAYMENT',
              amountMinor: '28884',
              currency: 'MXN',
              observedAt: '2026-09-01T19:00:00.000Z',
              createdAt: '2026-09-01T19:01:00.000Z',
            },
          ],
          nextCursor: null,
        },
      }),
    }),
  )

  await page.goto('/venues/venue-commercial/settings/billing/subscriptions')
  const billing = page.locator('[data-tour="commercial-billing-overview"]')
  await expect(billing).toBeVisible()
  await expect(billing.getByText('Punto de venta')).toBeVisible()
  await expect(billing.getByText('$288.84').first()).toBeVisible()
  await expect(billing.getByText('AVQ-LAB-REFERENCE')).toBeVisible()
  await expect(billing.getByRole('button', { name: /pay|pagar|retry|reintentar/i })).toHaveCount(0)

  await page.locator('[data-tour="commercial-billing-view-receipts"]').click()
  await expect(page).toHaveURL(/\/settings\/billing\/history$/)
  const receipts = page.locator('[data-tour="commercial-billing-receipts"]')
  await expect(receipts).toBeVisible()
  await expect(receipts.getByText('$288.84')).toBeVisible()
})

for (const appearance of ['desktop-light', 'mobile-dark'] as const) {
  test(`reviews a refreshed modular offer without charges or lost selections (${appearance})`, async ({ page }, testInfo) => {
    await page.setViewportSize(appearance === 'mobile-dark' ? { width: 390, height: 844 } : { width: 1440, height: 1000 })
    await page.addInitScript(() => {
      localStorage.setItem('lang', 'es')
      const style = document.createElement('style')
      style.textContent = '.tsqd-parent-container { display: none !important; }'
      if (document.head) document.head.appendChild(style)
      else document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style))
    })
    await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [{ ...venue, permissions: [...venue.permissions!, 'billing:subscriptions:manage'] }] })
    await page.route('**/api/v1/dashboard/commercial/venues/*/billing/overview', route =>
      route.fulfill({ json: { success: true, data: overview } }),
    )
    const mutations: string[] = []
    let previewRequests = 0
    let reviewing = false
    page.on('request', request => {
      if (reviewing && request.url().includes('/api/v1/') && !['GET', 'OPTIONS', 'HEAD'].includes(request.method()) && !request.url().endsWith('/configurator/preview')) {
        mutations.push(`${request.method()} ${request.url()}`)
      }
    })
    await page.route('**/api/v1/dashboard/commercial/venues/*/billing/configurator/preview', async route => {
      previewRequests += 1
      const { selection } = route.request().postDataJSON()
      const includesCfdi = selection.moduleCodes?.includes('CFDI_MODULE')
      const pos = {
        lineKey: 'PRODUCT:POS:POS_MONTHLY', targetType: 'PRODUCT', targetCode: 'POS', priceCode: 'POS_MONTHLY',
        productKind: 'POS', name: 'Punto de venta', billingUnit: 'VENUE_MONTH',
        listSubtotalMinor: '24900', discountMinor: '19900', subtotalMinor: '5000', taxMinor: '800', totalMinor: '5800',
        promotionalCycles: 3, renewalSubtotalMinor: '24900', renewalTaxMinor: '3984', renewalTotalMinor: '28884',
        appliedDiscounts: [{ type: 'FIXED_PRICE', cycles: 3, discountMinor: '19900' }],
      }
      const cfdi = {
        ...pos, lineKey: 'PRODUCT:CFDI_MODULE:CFDI_MONTHLY', targetCode: 'CFDI_MODULE', priceCode: 'CFDI_MONTHLY',
        productKind: 'MODULE', name: 'Facturación CFDI 4.0', listSubtotalMinor: '17900', discountMinor: '0',
        subtotalMinor: '17900', taxMinor: '2864', totalMinor: '20764', promotionalCycles: null,
        renewalSubtotalMinor: '17900', renewalTaxMinor: '2864', renewalTotalMinor: '20764', appliedDiscounts: [],
      }
      const premiumAnnual = {
        ...cfdi, lineKey: 'PRODUCT:PREMIUM:PREMIUM_ANNUAL', targetCode: 'PREMIUM', priceCode: 'PREMIUM_ANNUAL',
        productKind: 'PLAN', name: 'Premium', billingUnit: 'VENUE_YEAR',
        listSubtotalMinor: '1699000', subtotalMinor: '1699000', taxMinor: '271840', totalMinor: '1970840',
        renewalSubtotalMinor: '1699000', renewalTaxMinor: '271840', renewalTotalMinor: '1970840',
      }
      const annualTotal = { listSubtotalMinor: '1699000', discountMinor: '0', subtotalMinor: '1699000', taxMinor: '271840', totalMinor: '1970840' }
      await route.fulfill({ json: { success: true, data: {
        schemaVersion: 1, state: 'READY',
        pricing: { state: 'BOUND_OFFER_APPLIED', offerVersionId: 'offer-pos50-v1', offerCode: 'POS_50' },
        preview: {
          schemaVersion: 1, catalogPublicationId: 'catalog-1', selection,
          offer: { offerVersionId: 'offer-pos50-v1', offerCode: 'POS_50' },
          options: {
            packages: [{ code: 'PREMIUM', name: 'Premium', description: 'Paquete completo', kind: 'PLAN', salesMode: 'SELF_SERVICE', capabilityCodes: ['POS_CORE', 'CFDI'], prices: [{ code: 'PREMIUM_ANNUAL', billingUnit: 'VENUE_YEAR', listUnitAmountMinor: '1699000', taxRateBasisPoints: 1600 }] }],
            customBase: { code: 'POS', name: 'Punto de venta', description: 'Ventas y caja', kind: 'POS', salesMode: 'SELF_SERVICE', capabilityCodes: ['POS_CORE'], prices: [{ code: 'POS_MONTHLY', billingUnit: 'VENUE_MONTH', listUnitAmountMinor: '24900', taxRateBasisPoints: 1600 }] },
            modules: [{ code: 'CFDI_MODULE', name: 'Facturación CFDI 4.0', description: 'Facturas para tus clientes', kind: 'MODULE', salesMode: 'SELF_SERVICE', capabilityCodes: ['CFDI'], prices: [{ code: 'CFDI_MONTHLY', billingUnit: 'VENUE_MONTH', listUnitAmountMinor: '17900', taxRateBasisPoints: 1600 }] }],
          },
          quote: {
            lines: selection.mode === 'PACKAGE' ? [premiumAnnual] : includesCfdi ? [pos, cfdi] : [pos],
            today: selection.mode === 'PACKAGE' ? annualTotal : includesCfdi
              ? { listSubtotalMinor: '42800', discountMinor: '19900', subtotalMinor: '22900', taxMinor: '3664', totalMinor: '26564' }
              : { listSubtotalMinor: '24900', discountMinor: '19900', subtotalMinor: '5000', taxMinor: '800', totalMinor: '5800' },
            renewal: selection.mode === 'PACKAGE' ? annualTotal : includesCfdi
              ? { listSubtotalMinor: '42800', discountMinor: '0', subtotalMinor: '42800', taxMinor: '6848', totalMinor: '49648' }
              : { listSubtotalMinor: '24900', discountMinor: '0', subtotalMinor: '24900', taxMinor: '3984', totalMinor: '28884' },
            entitlementCodes: includesCfdi ? ['POS_CORE', 'CFDI'] : ['POS_CORE'],
          },
          recommendation: null,
        },
      } } })
    })

    await page.goto('/venues/venue-commercial/settings/billing/subscriptions')
    await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), appearance === 'mobile-dark')
    await page.locator('[data-tour="commercial-billing-open-configurator"]').click()
    const cfdi = page.getByRole('checkbox', { name: /Facturación CFDI/ })
    await cfdi.check()
    const summary = page.getByTestId('commercial-configurator-summary')
    await expect(summary.locator('dd').filter({ hasText: /265,64/ })).toBeVisible()
    const requestsBeforeReview = previewRequests
    reviewing = true
    await page.locator('[data-tour="commercial-billing-review-change"]').click()
    const review = page.getByRole('dialog')
    await expect(review.getByText('POS_50', { exact: true })).toBeVisible()
    await expect(review.locator('dd').filter({ hasText: /265,64/ })).toBeVisible()
    await expect(review.locator('dd').filter({ hasText: /36,64/ })).toBeVisible()
    await expect(review.getByText(/496,48/)).toBeVisible()
    const reviewLines = review.locator('[data-tour="commercial-billing-review-line"]')
    await expect(reviewLines.filter({ hasText: 'Punto de venta' }).getByText(/Con esta oferta:/)).toBeVisible()
    await expect(reviewLines.filter({ hasText: 'Facturación CFDI' }).getByText(/^Total:.*207,64/)).toBeVisible()
    await expect(reviewLines.filter({ hasText: 'Facturación CFDI' }).getByText(/Con esta oferta:/)).toHaveCount(0)
    await expect(review.locator('[data-tour="commercial-billing-review-confirm"]')).toBeDisabled()
    expect(previewRequests).toBe(requestsBeforeReview + 1)
    expect(await review.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    expect(await review.locator('[data-fsm-content]').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`review-${appearance}.png`), animations: 'disabled' })
    await review.locator('[data-tour="commercial-billing-review-edit"]').click()
    await expect(cfdi).toBeChecked()
    await page.getByRole('tab', { name: 'Paquetes', exact: true }).click()
    await page.getByRole('button', { name: 'Anual', exact: true }).click()
    await page.getByRole('button', { name: /^Premium/ }).click()
    await expect(summary.locator('dd').filter({ hasText: /19\.708,40/ })).toBeVisible()
    await page.locator('[data-tour="commercial-billing-review-change"]').click()
    await expect(review.getByText('Premium', { exact: true })).toBeVisible()
    await expect(review.getByText(/^Total:.*19\.708,40/)).toBeVisible()
    await expect(review.getByText(/^Total por renovación:.*19\.708,40/)).toBeVisible()
    await expect(review.getByText(/Campaña aplicada|Con esta oferta:|al terminar todas las promociones|POS_50/)).toHaveCount(0)
    await expect(review.getByText('Descuento', { exact: true })).toHaveCount(0)
    await expect(review.locator('[data-tour="commercial-billing-review-confirm"]')).toBeDisabled()
    expect(await review.locator('[data-fsm-content]').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`review-premium-${appearance}.png`), animations: 'disabled' })
    expect(mutations).toEqual([])
  })
}
