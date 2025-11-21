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
  totalSales: number
  fees: number
  netAmount: number
  settlementDays: number | null
  pendingAmount: number
  settledAmount: number
  transactionCount: number
}

export interface TimelineEntry {
  date: string
  transactionCount: number
  grossAmount: number
  feesAmount: number
  netAmount: number
  settlementStatus: 'SETTLED' | 'PENDING' | 'PROJECTED'
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

/**
 * Project future balance based on historical patterns
 */
export async function projectHistoricalBalance(
  venueId: string,
  params: {
    projectionDays: number
  },
): Promise<{ success: boolean; data: HistoricalProjectionResult }> {
  const res = await api.post(`/api/v1/dashboard/venues/${venueId}/available-balance/project`, params, {
    withCredentials: true,
  })
  return res.data
}
