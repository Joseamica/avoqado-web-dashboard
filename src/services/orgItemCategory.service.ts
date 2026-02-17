/**
 * Org Item Category Service
 *
 * API functions for managing organization-level item categories.
 * These categories are shared across all venues in the organization.
 */
import api from '@/api'
import type { ItemCategory, CreateItemCategoryDto, UpdateItemCategoryDto } from './itemCategory.service'

// ===========================================
// API FUNCTIONS
// ===========================================

/**
 * Get all org-level categories for the venue's organization
 */
export async function getOrgCategories(venueId: string): Promise<ItemCategory[]> {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/org-item-categories`)
  return response.data.data.categories
}

/**
 * Create a new org-level category
 */
export async function createOrgCategory(venueId: string, data: CreateItemCategoryDto): Promise<ItemCategory> {
  const response = await api.post(`/api/v1/dashboard/venues/${venueId}/org-item-categories`, data)
  return response.data.data
}

/**
 * Update an org-level category
 */
export async function updateOrgCategory(
  venueId: string,
  categoryId: string,
  data: UpdateItemCategoryDto,
): Promise<ItemCategory> {
  const response = await api.put(`/api/v1/dashboard/venues/${venueId}/org-item-categories/${categoryId}`, data)
  return response.data.data
}

/**
 * Delete an org-level category
 */
export async function deleteOrgCategory(
  venueId: string,
  categoryId: string,
): Promise<{ deleted: boolean; message: string }> {
  const response = await api.delete(`/api/v1/dashboard/venues/${venueId}/org-item-categories/${categoryId}`)
  return response.data.data
}

/**
 * Bulk upload items at org-level
 */
export async function orgBulkUploadItems(
  venueId: string,
  categoryId: string,
  data: { csvContent?: string; serialNumbers?: string[] },
): Promise<{ success: boolean; created: number; duplicates: string[]; errors: string[]; total: number }> {
  const csvContent =
    data.csvContent || (data.serialNumbers ? data.serialNumbers.join('\n') : '')
  const response = await api.post(`/api/v1/dashboard/venues/${venueId}/stock/org-bulk-upload`, {
    categoryId,
    csvContent,
  })
  return response.data.data
}
