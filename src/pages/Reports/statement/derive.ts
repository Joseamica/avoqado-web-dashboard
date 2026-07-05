import type { DeriveStatementInput, MerchantStatementRowModel, StatementModel, StatementSegment } from './types'

/**
 * Pure transform from the raw sales-summary payload into the statement view model.
 * No React, no i18n — all money math lives here so it can be unit-tested and so
 * the totals reconcile visibly in the UI.
 *
 * Reconciliation identity (holds when cash carries no fees, which it never does
 * in this system): youKeep = cash.amount + cardNet + other.net.
 */
export function deriveStatement(input: DeriveStatementInput): StatementModel {
  const { buckets, merchants, calendar, todayKey } = input

  const cashBucket = buckets.find(b => b.bucket === 'CASH')
  const cardBucket = buckets.find(b => b.bucket === 'CARD')
  const otherBuckets = buckets.filter(b => b.bucket === 'OTHER' || b.bucket === 'QR_LEGACY')

  const cash = { amount: cashBucket?.amount ?? 0, count: cashBucket?.count ?? 0 }
  const otherAmount = otherBuckets.reduce((s, b) => s + b.amount, 0)
  const otherFees = otherBuckets.reduce((s, b) => s + b.platformFees, 0)
  const other = {
    amount: otherAmount,
    count: otherBuckets.reduce((s, b) => s + b.count, 0),
    net: otherAmount - otherFees,
  }

  const collectedTotal = buckets.reduce((s, b) => s + b.amount, 0)
  const collectedCount = buckets.reduce((s, b) => s + b.count, 0)
  // Single source of truth for the fee total — covers CARD + OTHER/QR fees.
  const commissions = buckets.reduce((s, b) => s + b.platformFees, 0)

  // Prefer the per-merchant sum (authoritative). Fall back to the CARD bucket so
  // the statement stays honest when the backend omits byMerchantAccount.
  const cardNet = merchants.length
    ? merchants.reduce((s, m) => s + m.netToReceive, 0)
    : cardBucket
      ? cardBucket.amount - cardBucket.platformFees
      : 0

  const youKeep = collectedTotal - commissions
  const hasCardActivity = (cardBucket?.count ?? 0) > 0 || merchants.length > 0

  const segments: StatementSegment[] = (
    [
      { key: 'cash', amount: cash.amount, count: cash.count },
      { key: 'card', amount: cardBucket?.amount ?? 0, count: cardBucket?.count ?? 0 },
      { key: 'other', amount: other.amount, count: other.count },
    ] as Array<Omit<StatementSegment, 'pct'>>
  )
    .filter(s => s.amount > 0 || s.count > 0)
    .map(s => ({ ...s, pct: collectedTotal > 0 ? (s.amount / collectedTotal) * 100 : 0 }))

  // Timeline — YYYY-MM-DD sorts chronologically as a string.
  const days = [...calendar].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  const incoming = days.filter(d => d.status !== 'settled').reduce((s, d) => s + d.totalNet, 0)
  const projectedTotal = days.reduce((s, d) => s + d.totalNet, 0)
  const unprojected = cardNet - projectedTotal
  const lastDepositDate = days.length ? days[days.length - 1].date : null
  const lastDepositIsPast = lastDepositDate ? lastDepositDate < todayKey : false

  // Pull each merchant's per-day slices out of the calendar for its expanded row.
  const depositsByMerchant = new Map<string, MerchantStatementRowModel['deposits']>()
  for (const day of days) {
    for (const m of day.byMerchant) {
      const arr = depositsByMerchant.get(m.merchantAccountId) ?? []
      arr.push({ date: day.date, status: day.status, platformFee: m.platformFee, netToReceive: m.netToReceive })
      depositsByMerchant.set(m.merchantAccountId, arr)
    }
  }

  const totalNet = merchants.reduce((s, m) => s + m.netToReceive, 0)
  const merchantRows: MerchantStatementRowModel[] = merchants.map(m => {
    const nextDate = m.estimatedSettlement?.nextDate ?? null
    const deposits = (depositsByMerchant.get(m.merchantAccountId) ?? [])
      .slice()
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    const upcoming = deposits.filter(d => d.date >= todayKey)

    // Payout chip — all ESTIMATES (no bank confirmation exists yet, so nothing here
    // means "confirmed deposited"). When the money is estimated across SEVERAL days
    // with an upcoming slice, show only that NEXT deposit (amount + date) so the chip
    // never implies the full net lands on one date. A single-day estimate keeps the
    // plain "Cae/Debió caer ~fecha".
    let payoutStatus: MerchantStatementRowModel['payoutStatus']
    let payoutDate: string | null
    let payoutAmount: number | null = null
    if (deposits.length > 0) {
      // The calendar slices are the SINGLE source of truth for timing — the same data
      // the week strip and the expanded per-day list render — so the chip can never
      // disagree with them (e.g. all-past slices must not flip to a future "Cae" from a
      // separately-clocked nextDate). Derive everything here from the slices + venue today.
      if (deposits.length > 1 && upcoming.length > 0) {
        payoutStatus = 'next'
        payoutDate = upcoming[0].date
        payoutAmount = upcoming[0].netToReceive
      } else if (upcoming.length > 0) {
        payoutStatus = 'lands' // one upcoming slice ⇒ the whole net lands then
        payoutDate = upcoming[0].date
      } else {
        payoutStatus = 'landed' // every slice is in the past
        payoutDate = deposits[deposits.length - 1].date
      }
    } else if (nextDate != null) {
      // No per-day slices for this merchant (calendar not requested, or no projectable
      // payments in range) → fall back to the backend's single estimate.
      payoutStatus = nextDate < todayKey ? 'landed' : 'lands'
      payoutDate = nextDate
    } else {
      payoutStatus = 'noRule'
      payoutDate = null
    }
    return {
      merchantAccountId: m.merchantAccountId,
      displayName: m.displayName,
      provider: m.provider,
      affiliation: m.affiliation,
      collectedOnCard: m.collectedOnCard,
      platformFee: m.platformFee,
      netToReceive: m.netToReceive,
      transactionCount: m.transactionCount,
      effectiveRatePct: m.collectedOnCard > 0 ? (m.platformFee / m.collectedOnCard) * 100 : null,
      shareOfNetPct: totalNet > 0 ? (m.netToReceive / totalNet) * 100 : 0,
      payoutStatus,
      payoutDate,
      payoutAmount,
      settlementRules: m.settlementRules,
      deposits,
    }
  })

  return {
    youKeep,
    collectedTotal,
    collectedCount,
    commissions,
    cash,
    cardNet,
    cardBucket,
    hasCardActivity,
    other,
    segments,
    days,
    incoming,
    unprojected,
    lastDepositDate,
    lastDepositIsPast,
    merchants: merchantRows,
  }
}
