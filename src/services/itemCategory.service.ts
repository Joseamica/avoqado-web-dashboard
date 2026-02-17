/**
 * Item Category Service
 *
 * API functions for managing serialized inventory categories.
 * Used by PlayTelecom (SIMs), jewelry stores, electronics, etc.
 */
import api from '@/api'

// ===========================================
// TYPES
// ===========================================

export interface ItemCategory {
  id: string
  name: string
  description: string | null
  color: string | null
  sortOrder: number
  requiresPreRegistration: boolean
  suggestedPrice: number | null
  barcodePattern: string | null
  active: boolean
  createdAt: string
  updatedAt: string
  source?: 'venue' | 'organization'
  // Stats (when includeStats=true)
  totalItems?: number
  availableItems?: number
  soldItems?: number
}

export interface CreateItemCategoryDto {
  name: string
  description?: string
  color?: string
  sortOrder?: number
  requiresPreRegistration?: boolean
  suggestedPrice?: number
  barcodePattern?: string
}

export interface UpdateItemCategoryDto {
  name?: string
  description?: string
  color?: string
  sortOrder?: number
  requiresPreRegistration?: boolean
  suggestedPrice?: number
  barcodePattern?: string
  active?: boolean
}

export interface BulkUploadResult {
  success: boolean
  created: number
  duplicates: string[]
  errors: string[]
  total: number
}

export interface SerializedItem {
  id: string
  serialNumber: string
  status: 'AVAILABLE' | 'SOLD' | 'RETURNED' | 'DAMAGED'
  createdAt: string
  soldAt: string | null
  registeredBy: string | null
}

export interface PaginatedItems {
  items: SerializedItem[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

// ===========================================
// API FUNCTIONS
// ===========================================

/**
 * Get all item categories for a venue
 */
export const getItemCategories = async (
  venueId: string,
  options: { includeStats?: boolean } = {},
): Promise<{ categories: ItemCategory[] }> => {
  const params = new URLSearchParams()
  if (options.includeStats) {
    params.append('includeStats', 'true')
  }

  const response = await api.get(
    `/api/v1/dashboard/venues/${venueId}/item-categories${params.toString() ? `?${params}` : ''}`,
  )
  return response.data.data
}

/**
 * Get a single item category by ID
 */
export const getItemCategoryById = async (
  venueId: string,
  categoryId: string,
): Promise<ItemCategory> => {
  const response = await api.get(
    `/api/v1/dashboard/venues/${venueId}/item-categories/${categoryId}`,
  )
  return response.data.data
}

/**
 * Create a new item category
 */
export const createItemCategory = async (
  venueId: string,
  data: CreateItemCategoryDto,
): Promise<ItemCategory> => {
  const response = await api.post(
    `/api/v1/dashboard/venues/${venueId}/item-categories`,
    data,
  )
  return response.data.data
}

/**
 * Update an item category
 */
export const updateItemCategory = async (
  venueId: string,
  categoryId: string,
  data: UpdateItemCategoryDto,
): Promise<ItemCategory> => {
  const response = await api.put(
    `/api/v1/dashboard/venues/${venueId}/item-categories/${categoryId}`,
    data,
  )
  return response.data.data
}

/**
 * Delete an item category
 */
export const deleteItemCategory = async (
  venueId: string,
  categoryId: string,
): Promise<{ deleted: boolean; message: string }> => {
  const response = await api.delete(
    `/api/v1/dashboard/venues/${venueId}/item-categories/${categoryId}`,
  )
  return response.data.data
}

/**
 * Bulk upload items to a category via CSV content
 */
export const bulkUploadItems = async (
  venueId: string,
  categoryId: string,
  data: { csvContent?: string; serialNumbers?: string[] },
): Promise<BulkUploadResult> => {
  const response = await api.post(
    `/api/v1/dashboard/venues/${venueId}/item-categories/${categoryId}/items/bulk`,
    data,
  )
  return response.data.data
}

/**
 * Get items in a category with pagination
 */
export const getCategoryItems = async (
  venueId: string,
  categoryId: string,
  options: {
    status?: string
    page?: number
    pageSize?: number
    search?: string
  } = {},
): Promise<PaginatedItems> => {
  const params = new URLSearchParams()
  if (options.status) params.append('status', options.status)
  if (options.page) params.append('page', options.page.toString())
  if (options.pageSize) params.append('pageSize', options.pageSize.toString())
  if (options.search) params.append('search', options.search)

  const response = await api.get(
    `/api/v1/dashboard/venues/${venueId}/item-categories/${categoryId}/items${params.toString() ? `?${params}` : ''}`,
  )
  return response.data.data
}
