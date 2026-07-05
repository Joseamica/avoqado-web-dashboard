import { describe, expect, it } from 'vitest'
import { deriveStatement } from './derive'
import type {
  MerchantAccountBreakdown,
  PaymentMethodDetailedBreakdown,
  SettlementCalendarDay,
} from '@/services/reports/salesSummary.service'

const bucket = (b: Partial<PaymentMethodDetailedBreakdown> & { bucket: PaymentMethodDetailedBreakdown['bucket'] }): PaymentMethodDetailedBreakdown => ({
  amount: 0,
  count: 0,
  percentage: 0,
  tips: 0,
  refunds: 0,
  platformFees: 0,
  ...b,
})

const merchant = (m: Partial<MerchantAccountBreakdown> & { merchantAccountId: string }): MerchantAccountBreakdown => ({
  displayName: m.merchantAccountId,
  provider: 'Test',
  affiliation: null,
  collectedOnCard: 0,
  platformFee: 0,
  netToReceive: 0,
  transactionCount: 0,
  ...m,
})

const TODAY = '2026-07-04'

describe('deriveStatement', () => {
  it('commissions is the single sum of every bucket platformFees (card + other)', () => {
    const m = deriveStatement({
      buckets: [
        bucket({ bucket: 'CARD', amount: 1000, platformFees: 80 }),
        bucket({ bucket: 'OTHER', amount: 200, platformFees: 5 }),
        bucket({ bucket: 'CASH', amount: 300 }),
      ],
      merchants: [],
      calendar: [],
      todayKey: TODAY,
    })
    expect(m.commissions).toBe(85)
    expect(m.collectedTotal).toBe(1500)
  })

  it('reconciles youKeep = cash + cardNet + other.net', () => {
    const m = deriveStatement({
      buckets: [
        bucket({ bucket: 'CARD', amount: 1000, platformFees: 80 }),
        bucket({ bucket: 'OTHER', amount: 200, platformFees: 5 }),
        bucket({ bucket: 'CASH', amount: 300 }),
      ],
      merchants: [merchant({ merchantAccountId: 'a', collectedOnCard: 1000, platformFee: 80, netToReceive: 920 })],
      calendar: [],
      todayKey: TODAY,
    })
    expect(m.youKeep).toBeCloseTo(m.cash.amount + m.cardNet + m.other.net, 5)
    expect(m.youKeep).toBe(1500 - 85)
  })

  it('falls back to the CARD bucket net when byMerchantAccount is absent', () => {
    const m = deriveStatement({
      buckets: [bucket({ bucket: 'CARD', amount: 1000, platformFees: 80 })],
      merchants: [],
      calendar: [],
      todayKey: TODAY,
    })
    expect(m.cardNet).toBe(920)
  })

  it('prefers the per-merchant net sum over the bucket when merchants exist', () => {
    const m = deriveStatement({
      buckets: [bucket({ bucket: 'CARD', amount: 1000, platformFees: 80 })],
      merchants: [
        merchant({ merchantAccountId: 'a', netToReceive: 500 }),
        merchant({ merchantAccountId: 'b', netToReceive: 420 }),
      ],
      calendar: [],
      todayKey: TODAY,
    })
    expect(m.cardNet).toBe(920)
  })

  it('unprojected fires only when card money exceeds the calendar total by > 1 peso', () => {
    const base = {
      buckets: [bucket({ bucket: 'CARD', amount: 1000, platformFees: 0 })],
      merchants: [merchant({ merchantAccountId: 'a', netToReceive: 1000 })],
      todayKey: TODAY,
    }
    const projected = deriveStatement({
      ...base,
      calendar: [{ date: '2026-07-06', status: 'projected', totalNet: 999.5, byMerchant: [] }],
    })
    expect(projected.unprojected).toBeCloseTo(0.5, 5) // ≤ 1 → UI hides the chip

    const gap = deriveStatement({
      ...base,
      calendar: [{ date: '2026-07-06', status: 'projected', totalNet: 400, byMerchant: [] }],
    })
    expect(gap.unprojected).toBe(600) // > 1 → chip shows
  })

  it('sorts calendar days ascending and computes incoming from non-settled days', () => {
    const cal: SettlementCalendarDay[] = [
      { date: '2026-07-08', status: 'projected', totalNet: 300, byMerchant: [] },
      { date: '2026-07-02', status: 'settled', totalNet: 100, byMerchant: [] },
      { date: '2026-07-05', status: 'pending', totalNet: 200, byMerchant: [] },
    ]
    const m = deriveStatement({ buckets: [], merchants: [], calendar: cal, todayKey: TODAY })
    expect(m.days.map(d => d.date)).toEqual(['2026-07-02', '2026-07-05', '2026-07-08'])
    expect(m.incoming).toBe(500) // pending + projected, not settled
    expect(m.lastDepositDate).toBe('2026-07-08')
  })

  it('computes effective rate and payout status per merchant', () => {
    const m = deriveStatement({
      buckets: [],
      merchants: [
        merchant({ merchantAccountId: 'past', collectedOnCard: 100, platformFee: 8, netToReceive: 92, estimatedSettlement: { nextDate: '2026-07-01', settlementDays: 1 } }),
        merchant({ merchantAccountId: 'future', collectedOnCard: 200, platformFee: 8, netToReceive: 192, estimatedSettlement: { nextDate: '2026-07-09', settlementDays: 1 } }),
        merchant({ merchantAccountId: 'norule', collectedOnCard: 0, platformFee: 0, netToReceive: 0 }),
      ],
      calendar: [],
      todayKey: TODAY,
    })
    const [past, future, norule] = m.merchants
    expect(past.effectiveRatePct).toBeCloseTo(8, 5)
    expect(past.payoutStatus).toBe('landed')
    expect(future.payoutStatus).toBe('lands')
    expect(norule.effectiveRatePct).toBeNull() // no collection → no rate
    expect(norule.payoutStatus).toBe('noRule')
  })

  it('handles all-cash (no card activity) without producing a phantom chip', () => {
    const m = deriveStatement({
      buckets: [bucket({ bucket: 'CASH', amount: 500, count: 3 })],
      merchants: [],
      calendar: [],
      todayKey: TODAY,
    })
    expect(m.cardNet).toBe(0)
    expect(m.hasCardActivity).toBe(false)
    expect(m.unprojected).toBe(0)
    expect(m.segments).toHaveLength(1)
    expect(m.segments[0].key).toBe('cash')
    expect(m.segments[0].pct).toBe(100)
  })

  it('attaches each merchant its calendar deposit slices', () => {
    const m = deriveStatement({
      buckets: [],
      merchants: [merchant({ merchantAccountId: 'a', netToReceive: 92 })],
      calendar: [
        { date: '2026-07-06', status: 'projected', totalNet: 92, byMerchant: [{ merchantAccountId: 'a', displayName: 'A', platformFee: 8, netToReceive: 92, transactionCount: 1 }] },
      ],
      todayKey: TODAY,
    })
    expect(m.merchants[0].deposits).toEqual([{ date: '2026-07-06', status: 'projected', platformFee: 8, netToReceive: 92 }])
  })

  it("payout=next when money is estimated across several days: shows only the NEXT upcoming slice (amount+date)", () => {
    // 3 slices around today (2026-07-04): two past (should-have-landed) + one upcoming.
    const m = deriveStatement({
      buckets: [],
      merchants: [merchant({ merchantAccountId: 'x', netToReceive: 300, estimatedSettlement: { nextDate: '2026-07-06', settlementDays: 1 } })],
      calendar: [
        { date: '2026-07-01', status: 'settled', totalNet: 60, byMerchant: [{ merchantAccountId: 'x', displayName: 'X', platformFee: 4, netToReceive: 60, transactionCount: 1 }] },
        { date: '2026-07-03', status: 'settled', totalNet: 40, byMerchant: [{ merchantAccountId: 'x', displayName: 'X', platformFee: 3, netToReceive: 40, transactionCount: 1 }] },
        { date: '2026-07-06', status: 'projected', totalNet: 200, byMerchant: [{ merchantAccountId: 'x', displayName: 'X', platformFee: 8, netToReceive: 200, transactionCount: 1 }] },
      ],
      todayKey: TODAY,
    })
    const row = m.merchants[0]
    expect(row.payoutStatus).toBe('next')
    expect(row.payoutDate).toBe('2026-07-06') // the soonest UPCOMING slice, not the full net's single date
    expect(row.payoutAmount).toBe(200) // only that slice (< netToReceive 300)
  })

  it('payout stays a single date (lands/landed, amount null) when a merchant lands on ONE day', () => {
    const single = (nextDate: string, date: string) =>
      deriveStatement({
        buckets: [],
        merchants: [merchant({ merchantAccountId: 'x', netToReceive: 200, estimatedSettlement: { nextDate, settlementDays: 1 } })],
        calendar: [{ date, status: 'projected', totalNet: 200, byMerchant: [{ merchantAccountId: 'x', displayName: 'X', platformFee: 8, netToReceive: 200, transactionCount: 1 }] }],
        todayKey: TODAY,
      }).merchants[0]

    const future = single('2026-07-09', '2026-07-09')
    expect(future.payoutStatus).toBe('lands')
    expect(future.payoutAmount).toBeNull()

    const past = single('2026-07-01', '2026-07-01')
    expect(past.payoutStatus).toBe('landed')
    expect(past.payoutAmount).toBeNull()
  })

  it('trusts the calendar slices over a disagreeing backend nextDate (no future flip on all-past slices)', () => {
    // All slices are past, but the backend's single estimate points to a FUTURE date
    // (e.g. clock skew or a stale nextDate). The chip must follow the slices — the same
    // data the strip/expand show — not flip to a future "Cae".
    const m = deriveStatement({
      buckets: [],
      merchants: [merchant({ merchantAccountId: 'x', netToReceive: 100, estimatedSettlement: { nextDate: '2026-07-20', settlementDays: 1 } })],
      calendar: [
        { date: '2026-07-01', status: 'settled', totalNet: 60, byMerchant: [{ merchantAccountId: 'x', displayName: 'X', platformFee: 4, netToReceive: 60, transactionCount: 1 }] },
        { date: '2026-07-02', status: 'settled', totalNet: 40, byMerchant: [{ merchantAccountId: 'x', displayName: 'X', platformFee: 3, netToReceive: 40, transactionCount: 1 }] },
      ],
      todayKey: TODAY, // 2026-07-04 → both slices past
    })
    expect(m.merchants[0].payoutStatus).toBe('landed') // NOT 'lands' from nextDate 2026-07-20
    expect(m.merchants[0].payoutDate).toBe('2026-07-02') // last slice, not the backend date
  })
})
