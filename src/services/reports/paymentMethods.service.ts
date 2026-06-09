/**
 * Payment Methods Report Service
 *
 * API client for the Payment Methods dashboard report.
 *
 * There is no dedicated backend endpoint: this report reuses the
 * /api/v1/dashboard/reports/sales-summary endpoint with `groupBy=paymentMethod`.
 * The backend only computes the rich `byPaymentMethodDetailed` breakdown for the
 * unfiltered grouped view, so we never send a paymentMethod/cardType filter here.
 *
 * The detailed breakdown is computed from Payment records directly (amount, count,
 * tips, refunds, platform fees, and CARD → Credit/Debit/AMEX/International
 * sub-buckets) — the honest source for "how was I paid?", which item-level
 * grouping cannot answer without double-counting multi-payment orders.
 */

import api from '@/api'

// ============================================================
// Types
// ============================================================

export type PaymentBucket = 'CARD' | 'CASH' | 'OTHER' | 'QR_LEGACY'
export type CardSubType = 'CREDIT' | 'DEBIT' | 'AMEX' | 'INTERNATIONAL'

export interface PaymentMethodSubRow {
  type: CardSubType
  amount: number
  count: number
  percentage: number
  platformFees: number
}

export interface PaymentMethodRow {
  bucket: PaymentBucket
  amount: number // amount collected, tips-inclusive (matches backend)
  count: number
  percentage: number
  tips: number
  refunds: number
  platformFees: number
  subRows: PaymentMethodSubRow[]
}

export interface PaymentMethodsTotals {
  collected: number
  transactions: number
  tips: number
  refunds: number
  platformFees: number
}

export interface PaymentMethodsResponse {
  dateRange: {
    startDate: string
    endDate: string
  }
  methods: PaymentMethodRow[]
  totals: PaymentMethodsTotals
}

export interface PaymentMethodsFilters {
  // Active venue id — sent as the x-venue-id header so the backend scopes the
  // report to the user's current venue (this endpoint has no :venueId in its URL).
  venueId?: string
  startDate: string
  endDate: string
}

// Raw shapes from the sales-summary endpoint (only the parts we consume).
interface RawDetailedBreakdown {
  bucket: PaymentBucket
  amount: number
  count: number
  percentage: number
  tips: number
  refunds: number
  platformFees: number
  subBuckets?: Array<{
    type: CardSubType
    amount: number
    count: number
    percentage: number
    platformFees: number
  }>
}

interface RawSalesSummaryResponse {
  dateRange: { startDate: string; endDate: string }
  summary: {
    refunds: number
    tips: number
    platformFees: number
    totalCollected: number
    transactionCount: number
  }
  byPaymentMethodDetailed?: RawDetailedBreakdown[]
}

interface ApiResponse<T> {
  success: boolean
  data: T
}

// ============================================================
// API Functions
// ============================================================

/**
 * Fetch the payment-methods report for the authenticated venue.
 *
 * @param filters - Date range.
 * @returns Per-method breakdown (with card sub-types) and totals.
 */
export async function fetchPaymentMethods(filters: PaymentMethodsFilters): Promise<PaymentMethodsResponse> {
  const response = await api.get<ApiResponse<RawSalesSummaryResponse>>('/api/v1/dashboard/reports/sales-summary', {
    params: {
      startDate: filters.startDate,
      endDate: filters.endDate,
      groupBy: 'paymentMethod',
      reportType: 'summary',
    },
    // Tell the backend which venue is active — without this header it would fall
    // back to the (possibly stale) JWT venue after a deep-link/refresh.
    ...(filters.venueId ? { headers: { 'x-venue-id': filters.venueId } } : {}),
    withCredentials: true,
  })

  const raw = response.data.data
  const detailed = raw.byPaymentMethodDetailed ?? []

  const methods: PaymentMethodRow[] = detailed.map(b => ({
    bucket: b.bucket,
    amount: b.amount,
    count: b.count,
    percentage: b.percentage,
    tips: b.tips,
    refunds: b.refunds,
    platformFees: b.platformFees,
    subRows: (b.subBuckets ?? []).map(s => ({
      type: s.type,
      amount: s.amount,
      count: s.count,
      percentage: s.percentage,
      platformFees: s.platformFees,
    })),
  }))

  return {
    dateRange: raw.dateRange,
    methods,
    totals: {
      collected: raw.summary.totalCollected ?? 0,
      transactions: raw.summary.transactionCount ?? 0,
      tips: raw.summary.tips ?? 0,
      refunds: raw.summary.refunds ?? 0,
      platformFees: raw.summary.platformFees ?? 0,
    },
  }
}

// ============================================================
// Query Key Factory
// ============================================================

export const paymentMethodsKeys = {
  all: ['paymentMethods'] as const,
  report: (filters: PaymentMethodsFilters) => [...paymentMethodsKeys.all, 'report', filters] as const,
}
