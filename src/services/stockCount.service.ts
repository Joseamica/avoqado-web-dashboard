import api from '@/api'

// ============================================================================
// TYPES — match the server responses in
// /dashboard/venues/:venueId/inventory/stock-counts
// ============================================================================

export type StockCountType = 'CYCLE' | 'FULL'
export type StockCountStatus = 'IN_PROGRESS' | 'COMPLETED'

/** Row returned by the list endpoint (no items) */
export interface StockCountRow {
  id: string
  type: StockCountType
  status: StockCountStatus
  note: string | null
  createdAt: string
  createdBy: string | null
  itemCount: number
  /** Sum of (counted - expected) across all items */
  totalDifference: number
}

export interface StockCountItem {
  id: string
  productId: string
  productName: string
  sku: string | null
  gtin: string | null
  imageUrl: string | null
  expected: number
  counted: number
  difference: number
}

/** Full stock count with items (detail endpoint) */
export interface StockCountDetail {
  id: string
  type: StockCountType
  status: StockCountStatus
  note: string | null
  createdAt: string
  createdBy: string | null
  itemCount: number
  items: StockCountItem[]
}

export interface StockCountFilters {
  status?: StockCountStatus
  type?: StockCountType
  startDate?: string
  endDate?: string
  page?: number
  pageSize?: number
}

export interface Pagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

// ============================================================================
// API CLIENT
// ============================================================================

export const stockCountService = {
  /**
   * List stock counts for a venue (read-only audit).
   */
  list: async (
    venueId: string,
    filters?: StockCountFilters,
  ): Promise<{ success: boolean; data: StockCountRow[]; pagination: Pagination }> => {
    const { data } = await api.get(
      `/api/v1/dashboard/venues/${venueId}/inventory/stock-counts`,
      { params: filters },
    )
    return data
  },

  /**
   * Get a single stock count with its full item list.
   */
  get: async (
    venueId: string,
    countId: string,
  ): Promise<{ success: boolean; data: StockCountDetail }> => {
    const { data } = await api.get(
      `/api/v1/dashboard/venues/${venueId}/inventory/stock-counts/${countId}`,
    )
    return data
  },
}

// ============================================================================
// UI HELPERS
// ============================================================================

export function getStockCountStatusBadge(status: StockCountStatus): {
  variant: 'default' | 'secondary' | 'outline' | 'destructive'
  className: string
  label: string
} {
  switch (status) {
    case 'IN_PROGRESS':
      return {
        variant: 'secondary',
        className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200',
        label: 'En progreso',
      }
    case 'COMPLETED':
      return {
        variant: 'default',
        className: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200',
        label: 'Completado',
      }
    default:
      return { variant: 'secondary', className: '', label: status }
  }
}

export function getStockCountTypeLabel(type: StockCountType): string {
  switch (type) {
    case 'CYCLE':
      return 'Cíclico'
    case 'FULL':
      return 'Completo'
    default:
      return type
  }
}
