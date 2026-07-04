import api from '@/api'

/**
 * Available Balance Service
 *
 * API client for settlement tracking and available balance features.
 * Provides methods to fetch settlement data, simulate transactions, and project future balances.
 */

export enum TransactionCardType {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
  AMEX = 'AMEX',
  INTERNATIONAL = 'INTERNATIONAL',
  CASH = 'CASH',
}

export interface AvailableBalanceSummary {
  totalSales: number
  totalFees: number
  availableNow: number
  pendingSettlement: number
  estimatedNextSettlement: {
    date: string | null
    amount: number
  }
}

export interface CardTypeBreakdown {
  cardType: TransactionCardType
  baseSales: number // Venta (monto sin propina)
  tips: number // Propina
  totalSales: number // monto + propina
  fees: number
  netAmount: number // totalSales - fees
  settlementDays: number | null
  pendingAmount: number
  settledAmount: number
  transactionCount: number
}

export interface TimelineEntry {
  date: string
  cardType: TransactionCardType | 'CASH'
  transactionCount: number
  grossAmount: number
  fees: number
  netAmount: number
  status: 'SETTLED' | 'PENDING' | 'PROJECTED'
  estimatedSettlementDate: string | null
}

export interface SimulationParams {
  amount: number
  cardType: TransactionCardType
  transactionDate: string
  transactionTime?: string
}

export interface SimulationResult {
  simulatedAmount: number
  cardType: TransactionCardType
  transactionDate: string
  estimatedSettlementDate: string
  settlementDays: number
  grossAmount: number
  fees: number
  netAmount: number
  configuration: {
    settlementDays: number
    settlementDayType: 'BUSINESS_DAYS' | 'CALENDAR_DAYS'
    cutoffTime: string
  }
}

export interface HistoricalProjectionResult {
  projectionDays: number
  projectedBalance: number
  projectedDailySettlements: Array<{
    date: string
    amount: number
  }>
  historicalAverage: number
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
}

export interface SettlementCalendarEntry {
  settlementDate: string
  totalNetAmount: number
  transactionCount: number
  status: 'SETTLED' | 'PENDING'
  byCardType: Array<{
    cardType: TransactionCardType
    netAmount: number
    transactionCount: number
  }>
}

/**
 * Get available balance summary for a venue
 */
export async function getAvailableBalance(
  venueId: string,
  params?: {
    from?: string
    to?: string
  },
): Promise<{ success: boolean; data: AvailableBalanceSummary }> {
  const res = await api.get(`/api/v1/dashboard/venues/${venueId}/available-balance`, {
    params,
    withCredentials: true,
  })
  return res.data
}

/**
 * Get balance breakdown by card type
 */
export async function getBalanceByCardType(
  venueId: string,
  params?: {
    from?: string
    to?: string
  },
): Promise<{ success: boolean; data: CardTypeBreakdown[] }> {
  const res = await api.get(`/api/v1/dashboard/venues/${venueId}/available-balance/by-card-type`, {
    params,
    withCredentials: true,
  })
  return res.data
}

/**
 * Get settlement timeline
 */
export async function getSettlementTimeline(
  venueId: string,
  params?: {
    from?: string
    to?: string
    includePast?: boolean
    includeFuture?: boolean
  },
): Promise<{ success: boolean; data: TimelineEntry[] }> {
  const res = await api.get(`/api/v1/dashboard/venues/${venueId}/available-balance/timeline`, {
    params,
    withCredentials: true,
  })
  return res.data
}

/**
 * Simulate a transaction to see settlement date
 */
export async function simulateTransaction(
  venueId: string,
  params: SimulationParams,
): Promise<{ success: boolean; data: SimulationResult }> {
  const res = await api.post(`/api/v1/dashboard/venues/${venueId}/available-balance/simulate`, params, {
    withCredentials: true,
  })
  return res.data
}

/**
 * Get settlement calendar - shows exactly how much will be deposited each day
 * Groups transactions by their settlement date (not transaction date)
 */
export async function getSettlementCalendar(
  venueId: string,
  params?: {
    from?: string
    to?: string
  },
): Promise<{ success: boolean; data: SettlementCalendarEntry[] }> {
  const res = await api.get(`/api/v1/dashboard/venues/${venueId}/available-balance/settlement-calendar`, {
    params,
    withCredentials: true,
  })
  return res.data
}

// ── Weekly settlement view (settlement-date, Monday–Sunday) ──────────────────

export interface SettlementWeekAgg {
  gross: number
  commission: number
  net: number
  count: number
}
export interface SettlementWeekMerchant extends SettlementWeekAgg {
  merchantAccountId: string
  displayName: string
  provider: string
}
export interface SettlementWeekCardType extends SettlementWeekAgg {
  cardType: string
}
export interface SettlementWeekDay extends SettlementWeekAgg {
  date: string // yyyy-MM-dd (venue-local settlement day)
  status: 'settled' | 'today' | 'projected'
  byMerchant: SettlementWeekMerchant[]
  byCardType: SettlementWeekCardType[]
}
export interface SettlementWeek {
  weekStart: string
  weekEnd: string
  days: SettlementWeekDay[]
  weekTotal: SettlementWeekAgg
}

/**
 * Weekly settlement calendar — how much card money lands in the bank on each day
 * of a Monday–Sunday week (by settlement date). `weekStart` (yyyy-MM-dd, any day
 * in the target week) selects the week; omit for the current week.
 */
export async function getSettlementWeek(venueId: string, weekStart?: string): Promise<{ success: boolean; data: SettlementWeek }> {
  const res = await api.get(`/api/v1/dashboard/venues/${venueId}/available-balance/settlement-week`, {
    params: weekStart ? { weekStart } : {},
    withCredentials: true,
  })
  return res.data
}
