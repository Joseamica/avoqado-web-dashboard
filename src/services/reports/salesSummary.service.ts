/**
 * Sales Summary Report Service
 *
 * API client for the Sales Summary dashboard report.
 * Communicates with /api/v1/dashboard/reports/sales-summary endpoint.
 */

import api from '@/api'

// ============================================================
// Types
// ============================================================

export interface SalesSummaryMetrics {
  grossSales: number
  items: number
  serviceCosts: number
  discounts: number
  refunds: number
  netSales: number
  deferredSales: number
  taxes: number
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

export interface TimePeriodMetrics {
  period: string
  periodLabel?: string
  metrics: SalesSummaryMetrics
}

export type ReportType = 'summary' | 'hours' | 'days' | 'weeks' | 'months' | 'hourlySum' | 'dailySum'
export type GroupBy = 'none' | 'paymentMethod'

export interface SalesSummaryResponse {
  dateRange: {
    startDate: string
    endDate: string
  }
  reportType: ReportType
  summary: SalesSummaryMetrics
  byPaymentMethod?: PaymentMethodBreakdown[]
  byPeriod?: TimePeriodMetrics[]
}

export interface SalesSummaryFilters {
  startDate: string
  endDate: string
  groupBy?: GroupBy
  reportType?: ReportType
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
      },
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
