import api from '@/api'
import type { Promotion, PromotionsListResponse, PromotionStatus, UpsertPromotionRequest } from '@/types/promotion'

const base = (venueId: string) => `/api/v1/dashboard/venues/${venueId}/promotions`

const promotionService = {
  async getPromotions(venueId: string, params: { page?: number; pageSize?: number; status?: PromotionStatus; search?: string } = {}) {
    const qs = new URLSearchParams()
    if (params.page) qs.set('page', String(params.page))
    if (params.pageSize) qs.set('pageSize', String(params.pageSize))
    if (params.status) qs.set('status', params.status)
    if (params.search) qs.set('search', params.search)
    const query = qs.toString()
    const response = await api.get<PromotionsListResponse>(`${base(venueId)}${query ? `?${query}` : ''}`)
    return response.data
  },

  async getPromotionById(venueId: string, promotionId: string) {
    const response = await api.get<Promotion>(`${base(venueId)}/${promotionId}`)
    return response.data
  },

  async createPromotion(venueId: string, data: UpsertPromotionRequest) {
    const response = await api.post<Promotion>(base(venueId), data)
    return response.data
  },

  async updatePromotion(venueId: string, promotionId: string, data: Partial<UpsertPromotionRequest>) {
    const response = await api.put<Promotion>(`${base(venueId)}/${promotionId}`, data)
    return response.data
  },

  /** El 400 llega como { errors: string[] } — el caller los pinta como lista. */
  async publishPromotion(venueId: string, promotionId: string) {
    const response = await api.post<Promotion>(`${base(venueId)}/${promotionId}/publish`)
    return response.data
  },

  async archivePromotion(venueId: string, promotionId: string) {
    const response = await api.post<Promotion>(`${base(venueId)}/${promotionId}/archive`)
    return response.data
  },

  async unarchivePromotion(venueId: string, promotionId: string) {
    const response = await api.post<Promotion>(`${base(venueId)}/${promotionId}/unarchive`)
    return response.data
  },

  async deletePromotion(venueId: string, promotionId: string) {
    await api.delete(`${base(venueId)}/${promotionId}`)
  },
}

export default promotionService
