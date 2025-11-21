/**
 * E-commerce Merchant Service
 *
 * API client for managing e-commerce merchant accounts (card-not-present payments).
 * Handles communication with backend endpoints for creating, updating, and managing
 * online payment channels for venues.
 *
 * @module services/ecommerceMerchant
 */

import api from '@/api'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface EcommerceMerchant {
  id: string
  venueId: string
  channelName: string
  businessName: string
  rfc?: string
  contactEmail: string
  contactPhone?: string
  website?: string
  publicKey: string
  providerId: string
  active: boolean
  sandboxMode: boolean
  createdAt: string
  updatedAt: string

  // Relations
  venue?: {
    id: string
    name: string
    slug: string
  }
  provider?: {
    id: string
    code: string
    name: string
  }
  costStructure?: {
    id: string
    debitRate: number
    creditRate: number
  }
  pricingStructure?: {
    id: string
  }
  _count?: {
    checkoutSessions: number
  }
}

export interface CreateEcommerceMerchantData {
  channelName: string
  businessName: string
  rfc?: string
  contactEmail: string
  contactPhone?: string
  website?: string
  providerId: string
  providerCredentials: Record<string, any>
  costStructureId?: string
  pricingStructureId?: string
  webhookUrl?: string
  webhookEvents?: string[]
  dashboardUserId?: string
  active?: boolean
  sandboxMode?: boolean
}

export interface UpdateEcommerceMerchantData {
  channelName?: string
  businessName?: string
  rfc?: string
  contactEmail?: string
  contactPhone?: string
  website?: string
  providerId?: string
  providerCredentials?: Record<string, any>
  costStructureId?: string
  pricingStructureId?: string
  webhookUrl?: string
  webhookEvents?: string[]
  dashboardUserId?: string
  active?: boolean
  sandboxMode?: boolean
}

export interface ListEcommerceMerchantsResponse {
  success: boolean
  data: {
    merchants: EcommerceMerchant[]
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}

export interface CreateEcommerceMerchantResponse {
  success: boolean
  data: EcommerceMerchant & {
    secretKey: string // ⚠️ Only returned on creation!
  }
  message: string
  warning: string
}

export interface APIKeysResponse {
  success: boolean
  data: {
    publicKey: string
    secretKey: string // Masked: sk_live_••••••••
    sandboxMode: boolean
    channelName: string
  }
}

export interface RegenerateKeysResponse {
  success: boolean
  data: {
    id: string
    publicKey: string
    secretKey: string // ⚠️ New secret key (unmasked)
    channelName: string
    sandboxMode: boolean
  }
  message: string
  warning: string
}

// ═══════════════════════════════════════════════════════════════════════════
// API CLIENT
// ═══════════════════════════════════════════════════════════════════════════

export const ecommerceMerchantAPI = {
  /**
   * Lists e-commerce merchants for a venue
   */
  async listByVenue(
    venueId: string,
    params?: {
      active?: boolean
      sandboxMode?: boolean
      providerId?: string
      limit?: number
      offset?: number
    },
  ): Promise<EcommerceMerchant[]> {
    const response = await api.get<ListEcommerceMerchantsResponse>(
      `/api/v1/dashboard/venues/${venueId}/ecommerce-merchants`,
      { params },
    )
    return response.data.data.merchants
  },

  /**
   * Gets a single e-commerce merchant by ID
   */
  async getById(venueId: string, merchantId: string): Promise<EcommerceMerchant> {
    const response = await api.get<{ success: boolean; data: EcommerceMerchant }>(
      `/api/v1/dashboard/venues/${venueId}/ecommerce-merchants/${merchantId}`,
    )
    return response.data.data
  },

  /**
   * Creates a new e-commerce merchant
   * ⚠️ Response includes secret key - save it immediately!
   */
  async create(venueId: string, data: CreateEcommerceMerchantData): Promise<CreateEcommerceMerchantResponse['data']> {
    const response = await api.post<CreateEcommerceMerchantResponse>(
      `/api/v1/dashboard/venues/${venueId}/ecommerce-merchants`,
      data,
    )
    return response.data.data
  },

  /**
   * Updates an e-commerce merchant
   */
  async update(venueId: string, merchantId: string, data: UpdateEcommerceMerchantData): Promise<EcommerceMerchant> {
    const response = await api.put<{ success: boolean; data: EcommerceMerchant }>(
      `/api/v1/dashboard/venues/${venueId}/ecommerce-merchants/${merchantId}`,
      data,
    )
    return response.data.data
  },

  /**
   * Toggles e-commerce merchant active status
   */
  async toggleStatus(
    venueId: string,
    merchantId: string,
    active: boolean,
  ): Promise<{ id: string; active: boolean; channelName: string }> {
    const response = await api.patch<{ success: boolean; data: { id: string; active: boolean; channelName: string } }>(
      `/api/v1/dashboard/venues/${venueId}/ecommerce-merchants/${merchantId}/toggle`,
      { active },
    )
    return response.data.data
  },

  /**
   * Gets API keys for an e-commerce merchant
   * Note: Secret key is masked (sk_live_••••••••)
   */
  async getAPIKeys(venueId: string, merchantId: string): Promise<APIKeysResponse['data']> {
    const response = await api.get<APIKeysResponse>(
      `/api/v1/dashboard/venues/${venueId}/ecommerce-merchants/${merchantId}/keys`,
    )
    return response.data.data
  },

  /**
   * Regenerates API keys for an e-commerce merchant
   * ⚠️ WARNING: This invalidates old keys!
   */
  async regenerateKeys(venueId: string, merchantId: string): Promise<RegenerateKeysResponse['data']> {
    const response = await api.post<RegenerateKeysResponse>(
      `/api/v1/dashboard/venues/${venueId}/ecommerce-merchants/${merchantId}/regenerate-keys`,
      {},
    )
    return response.data.data
  },

  /**
   * Deletes an e-commerce merchant
   * ⚠️ CASCADE: Also deletes all checkout sessions
   */
  async delete(venueId: string, merchantId: string): Promise<void> {
    await api.delete(`/api/v1/dashboard/venues/${venueId}/ecommerce-merchants/${merchantId}`)
  },
}
