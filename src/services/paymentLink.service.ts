import api from '@/api'

export interface PaymentLink {
  id: string
  shortCode: string
  venueId: string
  ecommerceMerchantId: string
  createdById: string
  title: string
  description?: string
  imageUrl?: string
  amountType: 'FIXED' | 'OPEN'
  amount?: number
  currency: string
  isReusable: boolean
  expiresAt?: string
  redirectUrl?: string
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
}

export const paymentLinkService = {
  async getPaymentLinks(
    venueId: string,
    params?: { page?: number; pageSize?: number; status?: string; search?: string }
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
    data: UpdatePaymentLinkRequest
  ): Promise<{ success: boolean; data: PaymentLink }> {
    const response = await api.put(`/api/v1/dashboard/venues/${venueId}/payment-links/${linkId}`, data)
    return response.data
  },

  async archivePaymentLink(venueId: string, linkId: string): Promise<{ success: boolean }> {
    const response = await api.delete(`/api/v1/dashboard/venues/${venueId}/payment-links/${linkId}`)
    return response.data
  },
}

export default paymentLinkService
