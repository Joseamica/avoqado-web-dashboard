import type { MerchantAccountBreakdown, MoneyDestination } from '@/services/reports/salesSummary.service'
import type { DeriveStatementInput, MerchantStatementRowModel, StatementCardSub, StatementModel, StatementSegment } from './types'

/** What a bucket CHARGED (refunds apart). An old SERVIDOR doesn't send it: its net movement, never below 0. */
const chargedOf = (b: { amount: number; chargedAmount?: number }) => b.chargedAmount ?? Math.max(b.amount, 0)
/** How many charges. Old SERVIDOR: its rows, unless the bucket only moved money out. */
const chargedCountOf = (b: { amount: number; count: number; chargedCount?: number }) => b.chargedCount ?? (b.amount > 0 ? b.count : 0)

/** Money to the cent (sums of cents in float leave 1e-13 noise that would print «−$0.00»). */
const r2 = (n: number) => Math.round(n * 100) / 100

/** % of a whole that is ≥ 0, so a slice is never negative nor above 100. */
const pctOf = (part: number, whole: number) => (whole > 0 ? Math.min(100, Math.max(0, (part / whole) * 100)) : 0)

/**
 * Pure transform from the raw sales-summary payload into the statement view model.
 * No React, no i18n — all money math lives here so it can be unit-tested and so
 * the totals reconcile visibly in the UI.
 *
 * Reconciliation (carril C, 21-nov-2026), to the cent:
 *   youKeep = collected − refunds − commissions − tenderCommissions            (the «Cobraste» block)
 *           = cash.amount + cardNet + other.net − tenderCommissions             (the «where is it» block)
 * The second line holds by construction when the SERVIDOR sends `statementDestinations` (each charge in ONE destination,
 * read with the buckets). Without it (old SERVIDOR) the figures are the ones shown before this change.
 */
export function deriveStatement(input: DeriveStatementInput): StatementModel {
  const { buckets, merchants, destinations, calendar, todayKey } = input

  const cashBucket = buckets.find(b => b.bucket === 'CASH')
  const cardBucket = buckets.find(b => b.bucket === 'CARD')
  const otherBuckets = buckets.filter(b => b.bucket === 'OTHER' || b.bucket === 'QR_LEGACY')

  const collectedTotal = r2(buckets.reduce((s, b) => s + chargedOf(b), 0))
  const collectedCount = buckets.reduce((s, b) => s + chargedCountOf(b), 0)
  const refunds = {
    amount: r2(buckets.reduce((s, b) => s + chargedOf(b) - b.amount, 0)),
    count: buckets.reduce((s, b) => s + b.count - chargedCountOf(b), 0),
  }
  const cancelledOrderRefunds = buckets.reduce((s, b) => s + (b.cancelledOrderRefunds ?? 0), 0)
  // Fee total from the buckets — covers CARD + OTHER/QR fees (net of the ones a refund gave back).
  const feesFromBuckets = buckets.reduce((s, b) => s + b.platformFees, 0)
  const tenderCommissions = destinations?.tenderCommissions ?? buckets.reduce((s, b) => s + (b.tenderCommissions ?? 0), 0)

  const otherCharged = otherBuckets.reduce((s, b) => s + chargedOf(b), 0)
  const otherCount = otherBuckets.reduce((s, b) => s + chargedCountOf(b), 0)
  const online = destinations && destinations.online.transactionCount > 0 ? destinations.online : null

  let cash: StatementModel['cash']
  let cardNet: number
  let otherNet: number
  let youKeep: number
  let commissions: number
  let hasCardActivity: boolean
  if (destinations) {
    // One destination per charge, decided by the SERVIDOR's authority and read with the buckets and the merchants (carril C): a
    // voucher that counts as cash is in the drawer, an old OXXO stored as CASH but processed by Avoqado lands in the bank, and a
    // Rappi order paid in cash stays whole in the drawer (its commission is its own line). Every figure comes rounded to the cent,
    // so «Te queda» IS the sum of the rows below it, and «Comisiones» is what closes the block above to that same cent.
    cash = { amount: destinations.drawer.netToReceive, count: destinations.drawer.transactionCount - destinations.drawer.refundCount }
    cardNet = r2(merchants.reduce((s, m) => s + m.netToReceive, 0) + (online?.netToReceive ?? 0))
    otherNet = destinations.other.netToReceive
    youKeep = r2(cash.amount + cardNet + otherNet - tenderCommissions)
    commissions = r2(collectedTotal - refunds.amount - tenderCommissions - youKeep)
    hasCardActivity = merchants.length > 0 || online !== null
  } else {
    // Old SERVIDOR: the figures of before (per-merchant sum, else the CARD bucket).
    cash = { amount: cashBucket?.amount ?? 0, count: cashBucket ? chargedCountOf(cashBucket) : 0 }
    cardNet = merchants.length
      ? merchants.reduce((s, m) => s + m.netToReceive, 0)
      : cardBucket
        ? cardBucket.amount - cardBucket.platformFees
        : 0
    otherNet = otherBuckets.reduce((s, b) => s + b.amount - b.platformFees, 0)
    commissions = feesFromBuckets
    youKeep = buckets.reduce((s, b) => s + b.amount, 0) - commissions - tenderCommissions
    hasCardActivity = (cardBucket?.count ?? 0) > 0 || merchants.length > 0
  }
  const bankRefunds = merchants.reduce((s, m) => s + (m.refunds ?? 0), 0) + (online?.refunds ?? 0)
  const other = { amount: otherCharged, count: otherCount, net: otherNet }

  // The bar shows what was CHARGED by method (D10.2): a refund is its own line, so a slice is never negative nor above 100%.
  const segments: StatementSegment[] = (
    [
      { key: 'cash', amount: cashBucket ? chargedOf(cashBucket) : 0, count: cashBucket ? chargedCountOf(cashBucket) : 0 },
      { key: 'card', amount: cardBucket ? chargedOf(cardBucket) : 0, count: cardBucket ? chargedCountOf(cardBucket) : 0 },
      { key: 'other', amount: otherCharged, count: otherCount },
    ] as Array<Omit<StatementSegment, 'pct'>>
  )
    .filter(s => s.amount > 0)
    .map(s => ({ ...s, pct: pctOf(s.amount, collectedTotal) }))

  const cardCharged = cardBucket ? chargedOf(cardBucket) : 0
  const cardSubs: StatementCardSub[] = (cardBucket?.subBuckets ?? [])
    // The fee on the same per-charge rounding as «Comisiones» and the merchants (Codex r5 #2); an old SERVIDOR: the raw sum.
    .map(sub => ({ type: sub.type, amount: chargedOf(sub), count: chargedCountOf(sub), platformFees: sub.platformFeesCents ?? sub.platformFees, pct: 0 }))
    .filter(sub => sub.amount > 0)
    .map(sub => ({ ...sub, pct: pctOf(sub.amount, cardCharged) }))

  // Timeline — YYYY-MM-DD sorts chronologically as a string.
  const days = [...calendar].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  const incoming = days.filter(d => d.status !== 'settled').reduce((s, d) => s + d.totalNet, 0)
  const projectedTotal = days.reduce((s, d) => s + d.totalNet, 0)
  // A new SERVIDOR says per merchant what the projection couldn't date; subtracting two sums read differently mixed in refunds
  // without a cost yet and online money (which carries its own «no estimated date» chip). Old SERVIDOR: the difference, as before.
  // Per merchant, so one merchant's refund without a cost yet cannot hide another merchant's undated money.
  const unprojected = merchants.some(m => m.unprojectedNet !== undefined)
    ? merchants.reduce((s, m) => s + Math.max(0, m.unprojectedNet ?? 0), 0)
    : cardNet - projectedTotal
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

  // Online money (no terminal merchant) goes in the same table (D11), as a row with no settlement date.
  const totalNet = merchants.reduce((s, m) => s + m.netToReceive, 0) + (online?.netToReceive ?? 0)
  const asRow = (m: MerchantAccountBreakdown | MoneyDestination) => {
    const refundsOf = m.refunds ?? 0
    const charged = ('collectedOnCard' in m ? m.collectedOnCard : m.collected) + refundsOf
    const platformFee = m.platformFee
    return {
      collectedOnCard: charged,
      platformFee,
      netToReceive: m.netToReceive,
      transactionCount: m.transactionCount - (m.refundCount ?? 0),
      refunds: refundsOf,
      effectiveRatePct: charged > 0 ? (platformFee / charged) * 100 : null,
      shareOfNetPct: totalNet > 0 ? pctOf(m.netToReceive, totalNet) : 0,
    }
  }
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
      // Also `next` when ANY part of this merchant's net has no date — a charge without a rule, or a refund without a cost yet
      // (Codex r2 #7, r3 #3): «Cae ~lunes» would imply the whole net lands that day.
      const partial = Math.abs(m.unprojectedNet ?? 0) >= 0.005
      if ((deposits.length > 1 || partial) && upcoming.length > 0) {
        payoutStatus = 'next'
        payoutDate = upcoming[0].date
        payoutAmount = upcoming[0].netToReceive
      } else if (upcoming.length > 0) {
        payoutStatus = 'lands' // one upcoming slice ⇒ the whole net lands then
        payoutDate = upcoming[0].date
      } else {
        payoutStatus = 'landed' // every slice is in the past
        payoutDate = deposits[deposits.length - 1].date
        // With undated money too, the amount of THAT dated slice (Codex r4 #1, r5 #3), never the full net nor other days' sum.
        if (partial) payoutAmount = deposits[deposits.length - 1].netToReceive
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
      ...asRow(m),
      payoutStatus,
      payoutDate,
      payoutAmount,
      settlementRules: m.settlementRules,
      deposits,
    }
  })
  if (online) {
    merchantRows.push({
      kind: 'online',
      merchantAccountId: 'online',
      displayName: '',
      provider: '',
      affiliation: null,
      ...asRow(online),
      payoutStatus: 'noRule',
      payoutDate: null,
      payoutAmount: null,
      deposits: [],
    })
  }

  return {
    youKeep,
    collectedTotal,
    collectedCount,
    commissions,
    refunds,
    cancelledOrderRefunds,
    tenderCommissions,
    cash,
    cardNet,
    bankRefunds,
    cardBucket,
    cardSubs,
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
