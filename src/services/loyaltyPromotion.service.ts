import api from '@/api'
import type {
  LoyaltyPromotion,
  LoyaltyPromotionEndDatePatch,
  LoyaltyPromotionInput,
  LoyaltyPromotionStatus,
  PaginatedLoyaltyPromotions,
} from '@/types/customer'

const base = (venueId: string) => `/api/v1/dashboard/venues/${venueId}/loyalty/promotions`

/** Promociones de lealtad. Las reglas (rangos, fechas del negocio, tope de 10, «activa = sólo fecha de fin») viven en el servidor. */
export const loyaltyPromotionService = {
  async list(
    venueId: string,
    params: { status: LoyaltyPromotionStatus; page: number; pageSize: number },
  ): Promise<PaginatedLoyaltyPromotions> {
    const response = await api.get(base(venueId), { params })
    return response.data
  },

  async create(venueId: string, data: LoyaltyPromotionInput): Promise<LoyaltyPromotion> {
    const response = await api.post(base(venueId), data)
    return response.data
  },

  /** Programada: el cuerpo completo. Activa: SÓLO `{ endDate }`. */
  async update(venueId: string, id: string, data: LoyaltyPromotionInput | LoyaltyPromotionEndDatePatch): Promise<LoyaltyPromotion> {
    const response = await api.patch(`${base(venueId)}/${id}`, data)
    return response.data
  },

  async end(venueId: string, id: string): Promise<LoyaltyPromotion> {
    const response = await api.post(`${base(venueId)}/${id}/end`)
    return response.data
  },
}
