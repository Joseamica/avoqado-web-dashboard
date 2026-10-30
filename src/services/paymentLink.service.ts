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

export type PaymentLinkDiscountInput =
  | { mode: 'MANUAL'; type: 'PERCENTAGE' | 'FIXED_AMOUNT'; value: number; name?: string }
  | { mode: 'CATALOG'; discountId: string }

export type PaymentLinkDiscountStatus = 'OK' | 'VENCIDO' | 'NO_INICIA' | 'FUERA_DE_HORARIO' | 'MINIMO' | 'INACTIVO' | 'AGOTADO'

export interface PaymentLinkDiscountView {
  name: string
  type: 'PERCENTAGE' | 'FIXED_AMOUNT'
  value: number
  origen: 'MANUAL' | 'CATALOGO'
  /** Sólo en la respuesta autenticada del panel. */
  discountId?: string | null
}

export interface PaymentLink {
  id: string
  shortCode: string
  venueId: string
  ecommerceMerchantId: string
  createdById: string
  customerId?: string | null
  customer?: PaymentLinkCustomer | null
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
  discount?: PaymentLinkDiscountView | null
  discountStatus?: PaymentLinkDiscountStatus | null
  discountValidUntil?: string | null
  status: 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'ARCHIVED'
  totalCollected: number
  paymentCount: number
  /** Cuándo se completó el último cobro de la liga (null si nadie la ha pagado). Sólo lo trae el listado; un servidor viejo no lo manda. */
  lastPaidAt?: string | null
  /** Sólo en el detalle: los pagos completados más recientes (hasta 50), cada uno con el pago donde vive su recibo. */
  completedPayments?: Array<{ id: string; amount: number; completedAt: string | null; paymentId: string | null }>
  /** Sólo en el detalle: cuántos pagos completados tiene en total (puede ser más que los que llegan). */
  completedPaymentsTotal?: number
  createdAt: string
  updatedAt: string
  createdBy?: {
    id: string
    user?: { firstName?: string; lastName?: string }
  }
}

export interface PaymentLinkCustomer {
  id: string
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
}

export interface CreatePaymentLinkRequest {
  customerId?: string | null
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
  /** Descuento opcional; omitirlo = sin descuento. */
  discount?: PaymentLinkDiscountInput
}

export interface UpdatePaymentLinkRequest {
  /** Sólo para agregar a una liga sin cliente; el servidor rechaza cambiarlo. */
  customerId?: string
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
  /** Omitir = no cambiar; null = quitar. Sólo mandarlo si el usuario lo tocó. */
  discount?: PaymentLinkDiscountInput | null
}

/** Pestañas de la lista. «used» = de un solo uso ya cobrada (en la base sigue ACTIVE); lo resuelve el servidor. */
export type PaymentLinkView = 'all' | 'active' | 'used' | 'paused' | 'expired'

export interface PaymentLinksPage {
  paymentLinks: PaymentLink[]
  /** Ligas de la pestaña y filtros, no sólo las de esta página. */
  total: number
  /** Contadores por pestaña (con la búsqueda y los estados, sin la pestaña). */
  counts?: Record<PaymentLinkView, number>
  /** Totales de la pestaña y filtros para las tarjetas. */
  summary?: { totalCollected: number; paidLinks: number }
}

export const paymentLinkService = {
  async getPaymentLinks(
    venueId: string,
    params: { view?: PaymentLinkView; statuses?: string[]; search?: string; limit: number; offset: number },
  ): Promise<PaymentLinksPage> {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/payment-links`, {
      params: {
        limit: params.limit,
        offset: params.offset,
        ...(params.view && { view: params.view }),
        ...(params.statuses?.length && { statuses: params.statuses.join(',') }),
        ...(params.search && { search: params.search }),
      },
    })
    // Backend returns { success, data: { paymentLinks, total, counts, summary, ... } }
    const data = response.data?.data
    return { paymentLinks: data?.paymentLinks || [], total: data?.total ?? 0, counts: data?.counts, summary: data?.summary }
  },

  async getPaymentLink(venueId: string, linkId: string): Promise<{ success: boolean; data: PaymentLink }> {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/payment-links/${linkId}`)
    return response.data
  },

  async createPaymentLink(
    venueId: string,
    data: CreatePaymentLinkRequest,
    creationKey?: string,
  ): Promise<{ success: boolean; data: PaymentLink }> {
    const response = await api.post(`/api/v1/dashboard/venues/${venueId}/payment-links`, data, {
      ...(creationKey ? { headers: { 'Idempotency-Key': creationKey } } : {}),
    })
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

  /**
   * Share a payment link with a customer via WhatsApp using the approved
   * `payment_link_share` Meta template. `phone` should be E.164 (`+52...`);
   * the backend normalizes further.
   */
  async shareViaWhatsapp(venueId: string, linkId: string, phone: string): Promise<{ success: boolean; data: { sent: boolean } }> {
    const response = await api.post(`/api/v1/dashboard/venues/${venueId}/payment-links/${linkId}/share-whatsapp`, { phone })
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

  async getSettings(venueId: string): Promise<PaymentLinkSettings> {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/payment-links/settings`)
    return response.data?.data ?? response.data
  },

  async updateSettings(venueId: string, settings: Partial<PaymentLinkSettings>): Promise<PaymentLinkSettings> {
    const response = await api.patch(`/api/v1/dashboard/venues/${venueId}/payment-links/settings`, settings)
    return response.data?.data ?? response.data
  },
}

/** Per-venue defaults applied to new payment links + admin notification
 *  preferences. Backs the "Ajustes generales" page. Per-link config still
 *  lives on PaymentLink itself for cases where a venue overrides defaults
 *  at creation time. */
export interface PaymentLinkSettings {
  notifyOnPaid: boolean
  defaultTippingConfig: TippingConfig | null
  defaultCustomFields: CustomFieldDefinition[] | null
  customerNotesEnabled: boolean
  merchantPolicies: string | null
}

export const DEFAULT_PAYMENT_LINK_SETTINGS: PaymentLinkSettings = {
  notifyOnPaid: false,
  defaultTippingConfig: null,
  defaultCustomFields: null,
  customerNotesEnabled: false,
  merchantPolicies: null,
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
