import { expect, test } from '@playwright/test'

import { setupApiMocks } from '../../fixtures/api-mocks'
import { createMockVenue, StaffRole } from '../../fixtures/mock-data'

test.setTimeout(45_000)

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
