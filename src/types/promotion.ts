export type PromotionType = 'BUNDLE' | 'COMBO'
export type PromotionPricingMode = 'FIXED_TOTAL' | 'PER_UNIT'
export type PromotionStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

export interface PromotionOption {
  id?: string
  productId: string
  /** Unidades que ENTRAN al carrito. 2 en un 2x1. */
  quantity: number
  /** Unidades que se COBRAN. 1 en un 2x1. */
  chargedQuantity: number
  /** Sobreprecio en PESOS (sólo FIXED_TOTAL). */
  priceDelta: number
}

export interface PromotionGroup {
  id?: string
  name: string
  options: PromotionOption[]
}

export interface Promotion {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  type: PromotionType
  pricingMode: PromotionPricingMode
  /** PESOS — el API nunca habla centavos. */
  price: number
  status: PromotionStatus
  displayOrder: number
  validFrom: string | null
  validUntil: string | null
  daysOfWeek: number[]
  timeFrom: string | null
  timeUntil: string | null
  createdAt: string
  updatedAt: string
  groups: PromotionGroup[]
}

export interface UpsertPromotionRequest {
  name: string
  description?: string | null
  imageUrl?: string | null
  type: PromotionType
  pricingMode: PromotionPricingMode
  price: number
  groups: Array<{ name: string; options: Array<Omit<PromotionOption, 'id'>> }>
  validFrom?: string | null
  validUntil?: string | null
  daysOfWeek?: number[]
  timeFrom?: string | null
  timeUntil?: string | null
  displayOrder?: number
}

export interface PromotionsListResponse {
  data: Promotion[]
  meta: { totalCount: number; pageSize: number; currentPage: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean }
}

/** El 400 de publicar trae TODOS los motivos juntos. */
export interface PublishValidationError {
  errors: string[]
}
