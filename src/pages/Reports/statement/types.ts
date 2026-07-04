import type {
  MerchantAccountBreakdown,
  MerchantSettlementRule,
  PaymentMethodDetailedBreakdown,
  SettlementCalendarDay,
} from '@/services/reports/salesSummary.service'

/** Payout timing of one merchant's card money vs today. */
export type PayoutStatus = 'lands' | 'landed' | 'noRule'

/** One slice of the "Cobraste" segmented bar (by payment method). */
export interface StatementSegment {
  key: 'cash' | 'card' | 'other'
  amount: number
  count: number
  pct: number
}

/** One merchant's row in the statement, with all display math pre-computed. */
export interface MerchantStatementRowModel {
  merchantAccountId: string
  displayName: string
  provider: string
  affiliation: string | null
  collectedOnCard: number
  platformFee: number
  netToReceive: number
  transactionCount: number
  /** platformFee / collectedOnCard × 100; null when nothing was collected. */
  effectiveRatePct: number | null
  /** netToReceive / Σ net × 100. */
  shareOfNetPct: number
  payoutStatus: PayoutStatus
  payoutDate: string | null // YYYY-MM-DD
  settlementRules?: MerchantSettlementRule[]
  /** This merchant's slices pulled out of the settlement calendar days. */
  deposits: Array<{ date: string; status: SettlementCalendarDay['status']; platformFee: number; netToReceive: number }>
}

export interface StatementModel {
  // Hero + statement math
  youKeep: number
  collectedTotal: number
  collectedCount: number
  commissions: number
  cash: { amount: number; count: number }
  cardNet: number
  cardBucket: PaymentMethodDetailedBreakdown | undefined
  hasCardActivity: boolean
  other: { amount: number; count: number; net: number }
  segments: StatementSegment[]
  // Payout timeline
  days: SettlementCalendarDay[]
  incoming: number
  /** cardNet − Σ projected days; > 1 peso ⇒ money with no estimated date. */
  unprojected: number
  lastDepositDate: string | null
  lastDepositIsPast: boolean
  // Merchants
  merchants: MerchantStatementRowModel[]
}

export interface DeriveStatementInput {
  buckets: PaymentMethodDetailedBreakdown[]
  merchants: MerchantAccountBreakdown[]
  calendar: SettlementCalendarDay[]
  /** Today as YYYY-MM-DD in the venue timezone (see todayInVenue). */
  todayKey: string
}
