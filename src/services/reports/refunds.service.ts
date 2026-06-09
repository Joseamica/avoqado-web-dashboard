/**
 * Refunds Report Service
 *
 * API client for the Refunds ("Reembolsos") dashboard report.
 * Communicates with /api/v1/dashboard/reports/refunds.
 *
 * The backend lists every Payment with type=REFUND for the venue in the date
 * range and returns amounts as POSITIVE magnitudes (how much was given back),
 * plus totals and a breakdown by reason.
 */

import api from '@/api'

// ============================================================
// Types
// ============================================================

export type RefundReason = 'RETURNED_GOODS' | 'ACCIDENTAL_CHARGE' | 'CANCELLED_ORDER' | 'FRAUDULENT_CHARGE' | 'OTHER'

export interface RefundRecord {
  id: string
  createdAt: string
  orderNumber: string | null
  originalPaymentId: string | null
  method: string
  reason: RefundReason | null
  note: string | null
  saleAmount: number
  tipAmount: number
  totalAmount: number
  status: string
  processedByName: string | null
}

export interface RefundsReportResponse {
  dateRange: {
    startDate: string
    endDate: string
  }
  refunds: RefundRecord[]
  totals: {
    count: number
    totalRefunded: number
    totalSale: number
    totalTips: number
  }
  byReason: Array<{
    reason: RefundReason | 'UNKNOWN'
    count: number
    amount: number
  }>
}

export interface RefundsReportFilters {
  // Active venue id — sent as the x-venue-id header so the backend scopes the
  // report to the user's current venue (this endpoint has no :venueId in its URL).
  venueId?: string
  startDate: string
  endDate: string
}

interface ApiResponse<T> {
  success: boolean
  data: T
}

// ============================================================
// API Functions
// ============================================================

/**
 * Fetch the refunds report for the authenticated venue.
 *
 * @param filters - Date range.
 * @returns Refund records, totals and breakdown by reason.
 */
export async function fetchRefunds(filters: RefundsReportFilters): Promise<RefundsReportResponse> {
  const response = await api.get<ApiResponse<RefundsReportResponse>>('/api/v1/dashboard/reports/refunds', {
    params: {
      startDate: filters.startDate,
      endDate: filters.endDate,
    },
    // Tell the backend which venue is active — without this header it would fall
    // back to the (possibly stale) JWT venue after a deep-link/refresh.
    ...(filters.venueId ? { headers: { 'x-venue-id': filters.venueId } } : {}),
    withCredentials: true,
  })
  return response.data.data
}

// ============================================================
// Query Key Factory
// ============================================================

export const refundsKeys = {
  all: ['refunds'] as const,
  report: (filters: RefundsReportFilters) => [...refundsKeys.all, 'report', filters] as const,
}
