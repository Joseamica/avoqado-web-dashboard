/**
 * Sales Summary Report Service
 *
 * API client for the Sales Summary dashboard report.
 * Communicates with /api/v1/dashboard/reports/sales-summary endpoint.
 */

import api from '@/api'

// ============================================================
// Constants
// ============================================================

// Mirrors avoqado-server/src/services/legacy/qrPayments.legacy.service.ts
// (MINDFORM_NEW_VENUE_ID). Kept in sync manually; a comment in the backend
// file points here. Used to gate the QR_LEGACY filter option to MindForm only.
export const MINDFORM_VENUE_ID = 'cmisvi38o001fhr2828ygmxi2'

// ============================================================
// Types
// ============================================================

export type PaymentMethodFilter = 'CASH' | 'CARD' | 'QR_LEGACY' | 'OTHER'
export type CardTypeFilter = 'CREDIT' | 'DEBIT' | 'AMEX' | 'INTERNATIONAL'

export interface SalesSummaryMetrics {
  // Order-derived fields. Null when a payment filter is active — they cannot
  // be honestly attributed to a single payment method (Square approach).
  grossSales: number | null
  items: number | null
  serviceCosts: number | null
  discounts: number | null
  netSales: number | null
  deferredSales: number | null
  taxes: number | null
  // Payment-derived fields. Always numbers, even under filter.
  refunds: number
  tips: number
  // Costs breakdown
  platformFees: number // Avoqado platform fees
  staffCommissions: number // Commissions paid to staff
  commissions: number // Legacy field (= platformFees for backwards compatibility)
  totalCollected: number
  // True profit after all costs
  netProfit: number
  transactionCount: number
}

export interface PaymentMethodBreakdown {
  method: string
  amount: number
  count: number
  percentage: number
}

export interface PaymentMethodDetailedBreakdown {
  bucket: 'CARD' | 'CASH' | 'OTHER' | 'QR_LEGACY'
  amount: number
  count: number
  percentage: number
  tips: number
  refunds: number
  platformFees: number
  subBuckets?: Array<{
    type: 'CREDIT' | 'DEBIT' | 'AMEX' | 'INTERNATIONAL'
    amount: number
    count: number
    percentage: number
    platformFees: number
  }>
}

export interface TimePeriodMetrics {
  period: string
  periodLabel?: string
  metrics: SalesSummaryMetrics
}

export type ReportType = 'summary' | 'hours' | 'days' | 'weeks' | 'months' | 'hourlySum' | 'dailySum'
export type GroupBy = 'none' | 'paymentMethod'

export interface MerchantAccountBreakdown {
  merchantAccountId: string
  displayName: string
  provider: string
  affiliation: string | null
  collectedOnCard: number
  platformFee: number
  netToReceive: number
  transactionCount: number
}

export interface SalesSummaryResponse {
  dateRange: {
    startDate: string
    endDate: string
  }
  reportType: ReportType
  summary: SalesSummaryMetrics
  byPaymentMethod?: PaymentMethodBreakdown[]
  byPaymentMethodDetailed?: PaymentMethodDetailedBreakdown[]
  byPeriod?: TimePeriodMetrics[]
  /** Per-merchant-account card breakdown; present only when includeMerchantBreakdown=true. */
  byMerchantAccount?: MerchantAccountBreakdown[]
  /** True when a payment filter is active; order-level metrics are then null. */
  filtered: boolean
}

export interface SalesSummaryFilters {
  // Included only to scope the query cache per venue. The backend resolves
  // venueId from auth, so it is not sent on the request.
  venueId?: string
  startDate: string
  endDate: string
  groupBy?: GroupBy
  reportType?: ReportType
  merchantAccountId?: string
  paymentMethod?: PaymentMethodFilter
  cardType?: CardTypeFilter
  includeMerchantBreakdown?: boolean
}

export interface ApiResponse<T> {
  success: boolean
  data: T
}

// ============================================================
// API Functions
// ============================================================

/**
 * Fetch sales summary report for the authenticated venue
 *
 * @param filters - Date range and optional grouping/report type
 * @returns Sales summary data with metrics, payment breakdown, and time periods
 */
export async function fetchSalesSummary(
  filters: SalesSummaryFilters,
): Promise<SalesSummaryResponse> {
  const response = await api.get<ApiResponse<SalesSummaryResponse>>(
    '/api/v1/dashboard/reports/sales-summary',
    {
      params: {
        startDate: filters.startDate,
        endDate: filters.endDate,
        groupBy: filters.groupBy || 'none',
        reportType: filters.reportType || 'summary',
        ...(filters.merchantAccountId ? { merchantAccountId: filters.merchantAccountId } : {}),
        ...(filters.paymentMethod ? { paymentMethod: filters.paymentMethod } : {}),
        ...(filters.paymentMethod === 'CARD' && filters.cardType ? { cardType: filters.cardType } : {}),
        ...(filters.includeMerchantBreakdown ? { includeMerchantBreakdown: 'true' } : {}),
      },
      // Tell the backend which venue is active. This endpoint has no :venueId in
      // its URL, so without this header it would fall back to the (possibly stale)
      // JWT venue and report the wrong venue's sales after a deep-link/refresh.
      ...(filters.venueId ? { headers: { 'x-venue-id': filters.venueId } } : {}),
      withCredentials: true,
    },
  )
  return response.data.data
}

// ============================================================
// Query Key Factory
// ============================================================

export const salesSummaryKeys = {
  all: ['salesSummary'] as const,
  summary: (filters: SalesSummaryFilters) =>
    [...salesSummaryKeys.all, 'report', filters] as const,
}
