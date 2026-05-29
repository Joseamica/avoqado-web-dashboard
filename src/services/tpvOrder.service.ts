// src/services/tpvOrder.service.ts
import api from '@/api'

export type TerminalOrderPaymentMethod = 'CARD_STRIPE' | 'SPEI'
export type TerminalOrderPaymentStatus =
  | 'AWAITING_PAYMENT'
  | 'AWAITING_PROOF'
  | 'PROOF_UPLOADED'
  | 'PAID'
  | 'REJECTED'
  | 'EXPIRED'
  | 'REFUNDED'
export type TerminalOrderFulfillmentStatus =
  | 'NEW'
  | 'AWAITING_SERIALS'
  | 'SERIALS_ASSIGNED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'

export interface CreateOrderItemPayload {
  catalogKey: string
  quantity: number
  namePrefix?: string
}

export interface CreateOrderPayload {
  items: CreateOrderItemPayload[]
  contactName: string
  contactEmail: string
  contactPhone: string
  shippingAddress: string
  shippingAddress2?: string
  shippingCity: string
  shippingState: string
  shippingZip: string
  shippingCountry?: string
  paymentMethod: TerminalOrderPaymentMethod
  /**
   * Origin of the purchase — affects Stripe Checkout success/cancel URLs.
   * - `'tpv'` (default): land at `/venues/:slug/tpv/orders/:id` after payment.
   * - `'setup'`: round-trip back to the V2 onboarding wizard Step 9.
   * Spec: avoqado-server/docs/superpowers/specs/2026-05-29-onboarding-tpv-purchase-design.md
   */
  from?: 'tpv' | 'setup'
}

export interface CreateOrderResponse {
  orderId: string
  orderNumber: string
  redirectUrl: string | null
}

export interface TerminalOrderItem {
  id: string
  brand: string
  model: string
  productName: string
  quantity: number
  unitPriceCents: number
  namePrefix: string
}

export interface TerminalOrder {
  id: string
  orderNumber: string
  venueId: string
  contactName: string
  contactEmail: string
  contactPhone: string
  shippingAddress: string
  shippingAddress2: string | null
  shippingCity: string
  shippingState: string
  shippingZip: string
  shippingCountry: string
  paymentMethod: TerminalOrderPaymentMethod
  paymentStatus: TerminalOrderPaymentStatus
  fulfillmentStatus: TerminalOrderFulfillmentStatus
  subtotalCents: number
  taxCents: number
  totalCents: number
  currency: string
  stripeReceiptUrl: string | null
  speiProofUrl?: string | null
  speiRejectionReason?: string | null
  items: TerminalOrderItem[]
  terminals?: Array<{
    id: string
    name: string
    serialNumber: string | null
    activationCode: string | null
    status: string
  }>
  speiRecipient?: {
    beneficiary: string
    clabe: string
    rfc: string
    bank: string
  } | null
  createdAt: string
  updatedAt: string
}

export const tpvOrderService = {
  async create(venueId: string, payload: CreateOrderPayload): Promise<CreateOrderResponse> {
    const { data } = await api.post(`/api/v1/dashboard/venues/${venueId}/tpv-orders`, payload)
    return data.data
  },

  async listForVenue(venueId: string): Promise<TerminalOrder[]> {
    const { data } = await api.get(`/api/v1/dashboard/venues/${venueId}/tpv-orders`)
    return data.data
  },

  async getById(venueId: string, orderId: string): Promise<TerminalOrder> {
    const { data } = await api.get(`/api/v1/dashboard/venues/${venueId}/tpv-orders/${orderId}`)
    return data.data
  },

  async uploadProof(venueId: string, orderId: string, file: File): Promise<TerminalOrder> {
    const formData = new FormData()
    formData.append('proof', file)
    const { data } = await api.post(
      `/api/v1/dashboard/venues/${venueId}/tpv-orders/${orderId}/upload-proof`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )
    return data.data
  },
}

export const tpvOrderPublicService = {
  async approve(orderId: string, token: string) {
    const { data } = await api.get(
      `/api/v1/public/tpv-orders/${orderId}/approve?token=${encodeURIComponent(token)}`,
    )
    return data.data
  },
  async checkApproveToken(orderId: string, token: string) {
    const { data } = await api.get(
      `/api/v1/public/tpv-orders/${orderId}/approve/check?token=${encodeURIComponent(token)}`,
    )
    return data.data
  },
  async reject(orderId: string, token: string, reason: string) {
    const { data } = await api.post(
      `/api/v1/public/tpv-orders/${orderId}/reject?token=${encodeURIComponent(token)}`,
      { reason },
    )
    return data.data
  },
  async checkAssignSerialsToken(orderId: string, token: string) {
    const { data } = await api.get(
      `/api/v1/public/tpv-orders/${orderId}/assign-serials/check?token=${encodeURIComponent(token)}`,
    )
    return data.data
  },
  async submitAssignSerials(
    orderId: string,
    token: string,
    items: { orderItemId: string; units: { name: string; serial: string }[] }[],
  ) {
    const { data } = await api.post(
      `/api/v1/public/tpv-orders/${orderId}/assign-serials?token=${encodeURIComponent(token)}`,
      { items },
    )
    return data.data
  },
}
