import type {
  MerchantAccountBreakdown,
  MerchantSettlementRule,
  PaymentMethodDetailedBreakdown,
  SettlementCalendarDay,
  StatementDestinations,
} from '@/services/reports/salesSummary.service'

/**
 * Estimated payout timing of one merchant's card money vs today. Everything is a
 * SUPPOSITION from settlement rules — there is no bank confirmation yet, so no
 * state here means "confirmed deposited".
 * - `lands`  — the whole net is estimated to land on one future day ("Cae ~fecha")
 * - `landed` — estimated it should have landed by a past day ("Debió caer ~fecha")
 * - `next`   — money is estimated across SEVERAL days; show only the NEXT upcoming
 *              slice (amount + date) so the chip never implies the full net lands once
 * - `noRule` — no settlement rule → can't estimate a date
 */
export type PayoutStatus = 'lands' | 'landed' | 'next' | 'noRule'

/** One slice of the "Cobraste" segmented bar (by payment method): only what was CHARGED, so `pct` is always 0–100. */
export interface StatementSegment {
  key: 'cash' | 'card' | 'other'
  amount: number
  count: number
  pct: number
}

/** One card type of the optional card detail, from what was charged (a type that only had refunds is left out). */
export interface StatementCardSub {
  type: 'CREDIT' | 'DEBIT' | 'AMEX' | 'INTERNATIONAL'
  amount: number
  count: number
  pct: number
  platformFees: number
}

/** One merchant's row in the statement, with all display math pre-computed. */
export interface MerchantStatementRowModel {
  /** A row without a terminal merchant (carril C, D11): online collections. */
  kind?: 'online'
  merchantAccountId: string
  displayName: string
  provider: string
  affiliation: string | null
  /** What was CHARGED (refunds apart). */
  collectedOnCard: number
  platformFee: number
  /** What lands: charged − fee − refunds. */
  netToReceive: number
  /** Charges only (a refund is not a transaction). */
  transactionCount: number
  /** Refunded to card in the range (positive); already inside `netToReceive`. */
  refunds?: number
  /** platformFee / collectedOnCard × 100; null when nothing was collected. */
  effectiveRatePct: number | null
  /** netToReceive / Σ net × 100. */
  shareOfNetPct: number
  payoutStatus: PayoutStatus
  payoutDate: string | null // YYYY-MM-DD — the relevant estimated date for the chip
  /** For `next`: the estimated net of the NEXT upcoming deposit (< full net). Else null. */
  payoutAmount: number | null
  settlementRules?: MerchantSettlementRule[]
  /** This merchant's slices pulled out of the settlement calendar days. */
  deposits: Array<{ date: string; status: SettlementCalendarDay['status']; platformFee: number; netToReceive: number }>
}

export interface StatementModel {
  // Hero + statement math
  youKeep: number
  collectedTotal: number
  collectedCount: number
  /** Avoqado's fees, net of the ones a refund gave back (can be negative). */
  commissions: number
  /** Refunds completed in the range: their own deduction line (D10.2). */
  refunds: { amount: number; count: number }
  /** Of `refunds`, what came from cancelled/deleted accounts: money that left, but sales don't subtract it. */
  cancelledOrderRefunds: number
  /** Rappi/Uber or own payment types' frozen commission (D1): its own deduction, not taken from any destination. */
  tenderCommissions: number
  /** Where the money is: in the drawer. youKeep = cash.amount + cardNet + other.net − tenderCommissions. */
  cash: { amount: number; count: number }
  /** Where the money is: what lands in the bank (terminal merchants + online collections). */
  cardNet: number
  /** Of `cardNet`, what refunds already took off. */
  bankRefunds: number
  cardBucket: PaymentMethodDetailedBreakdown | undefined
  cardSubs: StatementCardSub[]
  hasCardActivity: boolean
  other: { amount: number; count: number; net: number }
  segments: StatementSegment[]
  // Payout timeline
  days: SettlementCalendarDay[]
  incoming: number
  /** Terminal merchants' money the projection couldn't date (> 1 peso ⇒ shown). Online rows carry their own chip. */
  unprojected: number
  lastDepositDate: string | null
  lastDepositIsPast: boolean
  // Merchants
  merchants: MerchantStatementRowModel[]
}

export interface DeriveStatementInput {
  buckets: PaymentMethodDetailedBreakdown[]
  merchants: MerchantAccountBreakdown[]
  /** Absent with an old SERVIDOR: the statement falls back to the figures it showed before (carril C). */
  destinations?: StatementDestinations
  calendar: SettlementCalendarDay[]
  /** Today as YYYY-MM-DD in the venue timezone (see todayInVenue). */
  todayKey: string
}
