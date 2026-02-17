/**
 * Stock Dashboard API Service
 * Provides stock metrics, charts, alerts, and bulk upload
 * for PlayTelecom/White-Label dashboard.
 */
import api from '@/api'

// ===========================================
// TYPES
// ===========================================

export interface StockMetrics {
  totalPieces: number
  totalValue: number
  availablePieces: number
  soldToday: number
  soldThisWeek: number
}

export interface CategoryStockInfo {
  id: string
  name: string
  color: string | null
  available: number
  sold7d: number
  suggestedPrice: number | null
  coverage: number | null
  alertLevel: 'CRITICAL' | 'WARNING' | 'OK'
  minimumStock: number | null
}

export interface CategoryStockResponse {
  categories: CategoryStockInfo[]
}

export interface StockVsSalesPoint {
  date: string
  stockLevel: number
  salesCount: number
}

export interface StockChartResponse {
  days: StockVsSalesPoint[]
}

export interface StockAlert {
  categoryId: string
  categoryName: string
  categoryColor: string | null
  currentStock: number
  minimumStock: number
  alertLevel: 'CRITICAL' | 'WARNING'
}

export interface StockAlertsResponse {
  alerts: StockAlert[]
}

export interface ConfigureAlertResult {
  success: boolean
}

export interface BulkUploadResult {
  success: boolean
  created: number
  duplicates: string[]
  errors: string[]
  total: number
}

export interface StockMovement {
  id: string
  serialNumber: string
  categoryName: string
  type: 'REGISTERED' | 'SOLD' | 'RETURNED' | 'DAMAGED'
  timestamp: string
}

export interface StockMovementsResponse {
  movements: StockMovement[]
}

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

// ===========================================
// API FUNCTIONS
// ===========================================

/**
 * Get stock metrics summary
 */
export const getStockMetrics = async (venueId: string): Promise<StockMetrics> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/stock/metrics`)
  return response.data.data
}

/**
 * Get stock by category with coverage estimation
 */
export const getCategoryStock = async (venueId: string): Promise<CategoryStockResponse> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/stock/categories`)
  return response.data.data
}

/**
 * Get stock vs sales trend for chart
 */
export const getStockChart = async (
  venueId: string,
  params?: { days?: number }
): Promise<StockChartResponse> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/stock/chart`, { params })
  return response.data.data
}

/**
 * Get low stock alerts
 */
export const getStockAlerts = async (venueId: string): Promise<StockAlertsResponse> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/stock/alerts`)
  return response.data.data
}

/**
 * Configure stock alert for a category
 */
export const configureStockAlert = async (
  venueId: string,
  data: { categoryId: string; minimumStock: number; alertEnabled: boolean }
): Promise<ConfigureAlertResult> => {
  const response = await api.post(`/api/v1/dashboard/venues/${venueId}/stock/alerts/configure`, data)
  return response.data.data
}

/**
 * Process bulk upload CSV
 */
export const processBulkUpload = async (
  venueId: string,
  data: { categoryId: string; csvContent: string }
): Promise<BulkUploadResult> => {
  const response = await api.post(`/api/v1/dashboard/venues/${venueId}/stock/bulk-upload`, data)
  return response.data.data
}

/**
 * Bulk upload items to a category
 * Accepts either csvContent or serialNumbers array (compatible with itemCategory.service)
 * For white-label routes - uses /stock/bulk-upload endpoint
 */
export const bulkUploadItems = async (
  venueId: string,
  categoryId: string,
  data: { csvContent?: string; serialNumbers?: string[] },
): Promise<BulkUploadResult> => {
  // Convert serialNumbers to csvContent if provided
  let csvContent = data.csvContent || ''
  if (data.serialNumbers && data.serialNumbers.length > 0) {
    csvContent = data.serialNumbers.join('\n')
  }

  const response = await api.post(`/api/v1/dashboard/venues/${venueId}/stock/bulk-upload`, {
    categoryId,
    csvContent,
  })
  return response.data.data
}

/**
 * Get recent stock movements
 */
export const getStockMovements = async (
  venueId: string,
  params?: { limit?: number }
): Promise<StockMovementsResponse> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/stock/movements`, { params })
  return response.data.data
}

/**
 * Get item categories for white-label stock dashboard
 * Uses the /stock/item-categories endpoint which bypasses checkPermission
 * and uses white-label role-based access instead
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
    `/api/v1/dashboard/venues/${venueId}/stock/item-categories${params.toString() ? `?${params}` : ''}`,
  )
  return response.data.data
}
