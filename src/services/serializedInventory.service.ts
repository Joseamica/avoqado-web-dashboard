/**
 * @temporary
 * @pending-implementation
 * TEMPORARY: Serialized Inventory API service for demo page.
 * TODO: Delete this file when the final implementation is complete.
 * Created for PlayTelecom demo visualization.
 */
import api from '@/api'

// ===========================================
// TYPES
// ===========================================

export interface SerializedInventorySummary {
  categories: CategorySummary[]
  totals: {
    available: number
    sold: number
    returned: number
    damaged: number
    total: number
  }
}

export interface CategorySummary {
  id: string
  name: string
  description: string | null
  suggestedPrice: number | null
  available: number
  sold: number
  returned: number
  damaged: number
  total: number
}

export interface SerializedItem {
  id: string
  serialNumber: string
  status: 'AVAILABLE' | 'SOLD' | 'RETURNED' | 'DAMAGED'
  category: {
    id: string
    name: string
  }
  createdAt: string
  soldAt: string | null
  orderItemId: string | null
}

export interface SerializedItemsResponse {
  items: SerializedItem[]
  total: number
  limit: number
  offset: number
}

export interface RecentSale {
  id: string
  serialNumber: string
  category: {
    id: string
    name: string
  }
  soldAt: string | null
  orderItemId: string | null
  salePrice: number | null
  seller: {
    id: string
    name: string
  } | null
}

export interface RecentSalesResponse {
  sales: RecentSale[]
}

// ===========================================
// API FUNCTIONS
// ===========================================

/**
 * @temporary
 * Get summary stats for serialized inventory (categories with counts)
 */
export const getSerializedInventorySummary = async (venueId: string): Promise<SerializedInventorySummary> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/serialized-inventory/summary`)
  return response.data.data
}

/**
 * @temporary
 * Get serialized items with pagination and filtering
 */
export const getSerializedItems = async (
  venueId: string,
  params?: {
    categoryId?: string
    status?: string
    limit?: number
    offset?: number
  }
): Promise<SerializedItemsResponse> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/serialized-inventory/items`, {
    params,
  })
  return response.data.data
}

/**
 * @temporary
 * Get recent serialized item sales
 */
export const getRecentSales = async (venueId: string, limit?: number): Promise<RecentSalesResponse> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/serialized-inventory/recent-sales`, {
    params: { limit },
  })
  return response.data.data
}
