import api from '@/api'

export interface CustomFieldDefinition {
  id: string
  type: 'TEXT' | 'SELECT'
  label: string
  required: boolean
  options?: string[]
}

export interface TippingConfig {
  presets: number[]
  allowCustom: boolean
}

export interface PaymentLinkBundleItem {
  id: string
  quantity: number
  product: {
    id: string
    name: string
    description?: string | null
    price: number
    imageUrl?: string | null
  }
  modifiers: Array<{
    id: string
    quantity: number
    modifier: {
      id: string
      name: string
      price: number
    }
  }>
}

export interface PaymentLink {
  id: string
  shortCode: string
  venueId: string
  ecommerceMerchantId: string
  createdById: string
  purpose: 'PAYMENT' | 'ITEM' | 'DONATION'
  /** Bundle line items for ITEM-purpose links. Empty for PAYMENT/DONATION. */
  items?: PaymentLinkBundleItem[]
  title: string
  description?: string
  imageUrl?: string
  amountType: 'FIXED' | 'OPEN'
  amount?: number
  currency: string
  isReusable: boolean
  expiresAt?: string
  redirectUrl?: string
  customFields?: CustomFieldDefinition[] | null
  tippingConfig?: TippingConfig | null
  status: 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'ARCHIVED'
  totalCollected: number
  paymentCount: number
  createdAt: string
  updatedAt: string
  createdBy?: {
    id: string
    user?: { firstName?: string; lastName?: string }
  }
}

export interface CreatePaymentLinkRequest {
  title: string
  description?: string
  imageUrl?: string
  amountType: 'FIXED' | 'OPEN'
  amount?: number
  currency?: string
  isReusable?: boolean
  expiresAt?: string
  redirectUrl?: string
  purpose?: 'PAYMENT' | 'ITEM' | 'DONATION'
  /** Bundle line items for ITEM-purpose links. Required when purpose is ITEM.
   *  Each item may include pre-selected modifiers. */
  items?: Array<{
    productId: string
    quantity: number
    modifiers?: Array<{ modifierId: string; quantity?: number }>
  }>
  customFields?: CustomFieldDefinition[] | null
  tippingConfig?: TippingConfig | null
  /** Pin link to a specific channel. Required when venue has >1 active merchants. */
  ecommerceMerchantId?: string
  /** Staff members who share commission when sales come via this link.
   *  [] / omitted = no commission. N IDs = commission split equally (1/N each). */
  attributedStaffIds?: string[]
}

export interface UpdatePaymentLinkRequest {
  title?: string
  description?: string
  imageUrl?: string
  amountType?: 'FIXED' | 'OPEN'
  amount?: number
  isReusable?: boolean
  expiresAt?: string | null
  redirectUrl?: string | null
  status?: 'ACTIVE' | 'PAUSED'
  /** Replace the bundle items list for ITEM links. Pass [] to clear. */
  items?: Array<{
    productId: string
    quantity: number
    modifiers?: Array<{ modifierId: string; quantity?: number }>
  }> | null
  customFields?: CustomFieldDefinition[] | null
  tippingConfig?: TippingConfig | null
}

export const paymentLinkService = {
  async getPaymentLinks(
    venueId: string,
    params?: { page?: number; pageSize?: number; status?: string; search?: string },
  ): Promise<PaymentLink[]> {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/payment-links`, {
      params: {
        ...(params?.page && { page: params.page }),
        ...(params?.pageSize && { pageSize: params.pageSize }),
        ...(params?.status && { status: params.status }),
        ...(params?.search && { search: params.search }),
      },
    })
    // Backend returns { success, data: { paymentLinks, total, ... } }
    return response.data?.data?.paymentLinks || []
  },

  async getPaymentLink(venueId: string, linkId: string): Promise<{ success: boolean; data: PaymentLink }> {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/payment-links/${linkId}`)
    return response.data
  },

  async createPaymentLink(venueId: string, data: CreatePaymentLinkRequest): Promise<{ success: boolean; data: PaymentLink }> {
    const response = await api.post(`/api/v1/dashboard/venues/${venueId}/payment-links`, data)
    return response.data
  },

  async updatePaymentLink(
    venueId: string,
    linkId: string,
    data: UpdatePaymentLinkRequest,
  ): Promise<{ success: boolean; data: PaymentLink }> {
    const response = await api.put(`/api/v1/dashboard/venues/${venueId}/payment-links/${linkId}`, data)
    return response.data
  },

  async archivePaymentLink(venueId: string, linkId: string): Promise<{ success: boolean }> {
    const response = await api.delete(`/api/v1/dashboard/venues/${venueId}/payment-links/${linkId}`)
    return response.data
  },

  async getBranding(venueId: string): Promise<PaymentLinkBranding> {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/payment-links/branding/config`)
    return response.data?.data ?? response.data
  },

  async updateBranding(venueId: string, branding: Partial<PaymentLinkBranding>): Promise<PaymentLinkBranding> {
    const response = await api.put(`/api/v1/dashboard/venues/${venueId}/payment-links/branding/config`, branding)
    return response.data?.data ?? response.data
  },
}

/** Per-venue branding for the public payment-link checkout. Mirrors the
 *  DEFAULT_PAYMENT_LINK_BRANDING constant in avoqado-server. */
export interface PaymentLinkBranding {
  showLogo: boolean
  buttonColor: string
  buttonShape: 'rounded' | 'square' | 'pill'
  /** One of the 40 whitelisted fonts — see payment-link-fonts.ts. Server
   *  validates with a Zod enum so arbitrary values can't slip through. */
  fontFamily: string
  showImage: boolean
  showTitle: boolean
  showPrice: boolean
}

export const DEFAULT_PAYMENT_LINK_BRANDING: PaymentLinkBranding = {
  showLogo: true,
  buttonColor: '#006aff',
  buttonShape: 'rounded',
  fontFamily: 'DM Sans',
  showImage: true,
  showTitle: true,
  showPrice: true,
}

export default paymentLinkService
