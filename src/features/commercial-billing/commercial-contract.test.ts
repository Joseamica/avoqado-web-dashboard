import { describe, expect, it } from 'vitest'

import { parseCommercialBillingOverview, parseCommercialBillingReceiptPage } from './commercial-contract'
import { formatCommercialMinor } from './money'

const hugeMinor = '900719925474099301'

function readyOverview() {
  return {
    schemaVersion: 1,
    state: 'READY',
    collectionState: 'PAYMENT_UNDER_REVIEW',
    contract: {
      id: 'contract-1',
      status: 'PENDING_PAYMENT',
      cadence: 'MONTHLY',
      currency: 'MXN',
      timezone: 'America/Mexico_City',
      startsAt: '2026-09-01T18:00:00.000Z',
      endedAt: null,
      quoteId: 'quote-1',
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
          listUnitAmountMinor: hugeMinor,
          listSubtotalMinor: hugeMinor,
          discountMinor: '0',
          subtotalMinor: hugeMinor,
          taxMinor: '0',
          totalMinor: hugeMinor,
          promotionalCycles: null,
          renewalSubtotalMinor: '24900',
          renewalTaxMinor: '3984',
          renewalTotalMinor: '28884',
        },
      ],
      today: {
        listSubtotalMinor: hugeMinor,
        discountMinor: '0',
        subtotalMinor: hugeMinor,
        taxMinor: '0',
        totalMinor: hugeMinor,
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
        periodId: 'period-1',
        scheduleKey: 'SAAS_MONTHLY',
        cadence: 'MONTHLY',
        sequence: 1,
        startsAt: '2026-09-01T18:00:00.000Z',
        endsAt: '2026-10-01T18:00:00.000Z',
        dueAt: '2026-09-01T18:00:00.000Z',
        graceEndsAt: '2026-09-06T18:00:00.000Z',
        periodStatus: 'OPEN',
        receivableId: 'receivable-1',
        reference: 'AVQ-REFERENCE-1',
        receivableStatus: 'PARTIALLY_PAID',
        amountDueMinor: hugeMinor,
        allocatedMinor: '200',
        outstandingMinor: '900719925474099101',
        currency: 'MXN',
        paymentProvider: 'MANUAL_SPEI',
        paymentState: 'UNDER_REVIEW',
      },
    ],
    latestPaidPeriod: null,
    nextRenewalAt: null,
    recentReceipts: [
      {
        id: 'receipt-1',
        provider: 'MANUAL_SPEI',
        entryType: 'PAYMENT',
        amountMinor: '200',
        currency: 'MXN',
        observedAt: '2026-09-01T19:00:00.000Z',
        createdAt: '2026-09-01T19:01:00.000Z',
      },
    ],
    receiptHistoryHasMore: false,
  }
}

describe('commercial billing contract boundary', () => {
  it('formats minor units beyond Number.MAX_SAFE_INTEGER without precision loss', () => {
    expect(formatCommercialMinor(hugeMinor, 'MXN', 'es-MX')).toBe('$9,007,199,254,740,993.01')
    expect(formatCommercialMinor('28884', 'MXN', 'en-US')).toBe('MX$288.84')
    expect(() => formatCommercialMinor('28.884', 'MXN', 'es-MX')).toThrow('COMMERCIAL_MONEY_MINOR_INVALID')
  })

  it('accepts the frozen read projection and preserves every monetary field as a string', () => {
    const parsed = parseCommercialBillingOverview(readyOverview())

    expect(parsed.state).toBe('READY')
    if (parsed.state !== 'READY') throw new Error('Expected READY')
    expect(parsed.contract.today.totalMinor).toBe(hugeMinor)
    expect(parsed.obligations[0]?.outstandingMinor).toBe('900719925474099101')
    expect(typeof parsed.contract.today.totalMinor).toBe('string')
  })

  it('rejects an unknown schema or any malformed money instead of falling back to local prices', () => {
    expect(() => parseCommercialBillingOverview({ ...readyOverview(), schemaVersion: 2 })).toThrow(
      'COMMERCIAL_BILLING_CONTRACT_INCOMPATIBLE',
    )
    const malformed = readyOverview()
    malformed.contract.today.totalMinor = '288.84'
    expect(() => parseCommercialBillingOverview(malformed)).toThrow('COMMERCIAL_BILLING_CONTRACT_INCOMPATIBLE')
  })

  it('validates bounded receipt pages and rejects a hidden pagination shape', () => {
    const parsed = parseCommercialBillingReceiptPage({
      schemaVersion: 1,
      state: 'READY',
      items: readyOverview().recentReceipts,
      nextCursor: 'receipt-1',
    })
    expect(parsed.state).toBe('READY')
    if (parsed.state !== 'READY') throw new Error('Expected READY receipt page')
    expect(parsed.nextCursor).toBe('receipt-1')
    expect(() =>
      parseCommercialBillingReceiptPage({
        schemaVersion: 1,
        state: 'READY',
        items: readyOverview().recentReceipts,
      }),
    ).toThrow('COMMERCIAL_BILLING_CONTRACT_INCOMPATIBLE')
  })
})
