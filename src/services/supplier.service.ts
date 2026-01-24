import api from '@/api'

// ============================================================================
// TYPES - Matching Backend EXACTLY
// ============================================================================

export interface Supplier {
  id: string
  venueId: string
  name: string
  contactName?: string | null
  email?: string | null
  phone?: string | null
  website?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  zipCode?: string | null
  taxId?: string | null
  leadTimeDays?: number | null
  minimumOrder?: number | null
  rating: number
  reliabilityScore: number
  active: boolean
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateSupplierDto {
  name: string
  contactName?: string
  email?: string
  phone?: string
  website?: string
  address?: string
  city?: string
  state?: string
  country?: string
  zipCode?: string
  taxId?: string
  leadTimeDays?: number
  minimumOrder?: number
  rating?: number
  reliabilityScore?: number
  active?: boolean
  notes?: string
}

export type UpdateSupplierDto = Partial<CreateSupplierDto>

export interface SupplierPricingDto {
  rawMaterialId: string
  unitPrice: number
  minimumQuantity?: number
  discountRate?: number
  effectiveFrom?: string
  effectiveTo?: string
}

export interface SupplierPerformance {
  totalOrders: number
  completedOrders: number
  cancelledOrders: number
  totalSpent: number
  averageLeadTime: number
  onTimeDeliveryRate: number
  lastOrderDate: string | null
}

// ============================================================================
// API CLIENT
// ============================================================================

export const supplierService = {
  /**
   * Get all suppliers for a venue
   */
  getSuppliers: async (venueId: string, filters?: { active?: boolean; search?: string }) => {
    const { data } = await api.get(`/api/v1/dashboard/venues/${venueId}/inventory/suppliers`, { params: filters })
    return data
  },

  /**
   * Get a single supplier by ID
   */
  getSupplier: async (venueId: string, supplierId: string) => {
    const { data } = await api.get(`/api/v1/dashboard/venues/${venueId}/inventory/suppliers/${supplierId}`)
    return data
  },

  /**
   * Create a new supplier
   */
  createSupplier: async (venueId: string, dto: CreateSupplierDto) => {
    const { data } = await api.post(`/api/v1/dashboard/venues/${venueId}/inventory/suppliers`, dto)
    return data
  },

  /**
   * Update an existing supplier
   */
  updateSupplier: async (venueId: string, supplierId: string, dto: UpdateSupplierDto) => {
    const { data } = await api.put(`/api/v1/dashboard/venues/${venueId}/inventory/suppliers/${supplierId}`, dto)
    return data
  },

  /**
   * Delete a supplier
   */
  deleteSupplier: async (venueId: string, supplierId: string) => {
    const { data } = await api.delete(`/api/v1/dashboard/venues/${venueId}/inventory/suppliers/${supplierId}`)
    return data
  },

  /**
   * Add pricing for a raw material from this supplier
   */
  addPricing: async (venueId: string, supplierId: string, dto: SupplierPricingDto) => {
    const { data } = await api.post(`/api/v1/dashboard/venues/${venueId}/inventory/suppliers/${supplierId}/pricing`, dto)
    return data
  },

  /**
   * Get supplier performance metrics
   */
  getPerformance: async (venueId: string, supplierId: string) => {
    const { data } = await api.get(`/api/v1/dashboard/venues/${venueId}/inventory/suppliers/${supplierId}/performance`)
    return data
  },
}
