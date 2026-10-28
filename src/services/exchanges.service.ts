import api from '@/api'

export interface ExchangeReviewRow {
  id: string
  status: string
  createdAt: string
  originalOrderId: string
  newOrderId: string
  originalPaymentId?: string | null
  chargePaymentId?: string | null
  originalOrderNumber?: string | null
  newOrderNumber?: string | null
  differenceCents: number
  reviewReason: string | null
  staffName?: string | null
  reviewedAt?: string | null
  reviewedById?: string | null
  reviewNote?: string | null
}

export interface ExchangeListFilters {
  pendingReview?: boolean
  originalOrderId?: string
  status?: string
}

export interface ExchangeReviewPage {
  total: number
  items: ExchangeReviewRow[]
  nextCursor?: string | null
  hayMas?: boolean
  siguienteOffset?: number | null
}

export const exchangesKeys = {
  all: (venueId: string) => ['exchanges', venueId] as const,
  review: (venueId: string, filters: ExchangeListFilters = { pendingReview: true }) => [...exchangesKeys.all(venueId), filters] as const,
}

export async function listExchangesForReview(venueId: string, filters: ExchangeListFilters, cursor?: string): Promise<ExchangeReviewPage> {
  const { data } = await api.get(`/api/v1/dashboard/venues/${venueId}/exchanges`, {
    params: { ...filters, limit: 25, ...(cursor ? { cursor } : {}) },
  })
  return data.data
}

export async function markExchangeReviewed(venueId: string, exchangeId: string, note: string): Promise<ExchangeReviewRow> {
  const { data } = await api.post(`/api/v1/dashboard/venues/${venueId}/exchanges/${exchangeId}/review`, { note })
  return data.data
}
