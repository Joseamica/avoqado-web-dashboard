import api from '@/api'

// ============================================================================
// TYPES — match server responses in
// /dashboard/venues/:venueId/inventory/transfers
// ============================================================================

export type TransferStatus = 'DRAFT' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED'

export interface TransferItem {
  productId: string
  productName: string
  quantity: number
}

/** Row returned by the list endpoint */
export interface InventoryTransferRow {
  id: string
  venueId: string
  fromLocationName: string
  toLocationName: string
  status: TransferStatus
  notes: string | null
  items: TransferItem[]
  itemCount: number
  createdById: string | null
  createdByName: string
  createdAt: string
  updatedAt: string
}

/** Full transfer detail */
export interface InventoryTransferDetail {
  id: string
  venueId: string
  fromLocationName: string
  toLocationName: string
  status: TransferStatus
  notes: string | null
  items: TransferItem[]
  createdById: string | null
  createdByName: string
  createdAt: string
  updatedAt: string
}

export interface TransferFilters {
  status?: TransferStatus
  search?: string
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

export const inventoryTransferService = {
  /**
   * List inventory transfers for a venue (read-only audit).
   */
  list: async (
    venueId: string,
    filters?: TransferFilters,
  ): Promise<{ success: boolean; data: InventoryTransferRow[]; pagination: Pagination }> => {
    const { data } = await api.get(
      `/api/v1/dashboard/venues/${venueId}/inventory/transfers`,
      { params: filters },
    )
    return data
  },

  /**
   * Get a single inventory transfer with full item list.
   */
  get: async (
    venueId: string,
    transferId: string,
  ): Promise<{ success: boolean; data: InventoryTransferDetail }> => {
    const { data } = await api.get(
      `/api/v1/dashboard/venues/${venueId}/inventory/transfers/${transferId}`,
    )
    return data
  },
}

// ============================================================================
// UI HELPERS
// ============================================================================

export function getTransferStatusBadge(status: TransferStatus): {
  variant: 'default' | 'secondary' | 'outline' | 'destructive'
  className: string
  label: string
} {
  switch (status) {
    case 'DRAFT':
      return {
        variant: 'secondary',
        className: 'bg-muted text-muted-foreground',
        label: 'Borrador',
      }
    case 'IN_TRANSIT':
      return {
        variant: 'default',
        className: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
        label: 'En tránsito',
      }
    case 'COMPLETED':
      return {
        variant: 'default',
        className: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200',
        label: 'Completada',
      }
    case 'CANCELLED':
      return {
        variant: 'destructive',
        className: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
        label: 'Cancelada',
      }
    default:
      return { variant: 'secondary', className: '', label: status }
  }
}
