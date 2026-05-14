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

export type Responsible =
  | { kind: 'promoter'; staffId: string; firstName: string; lastName: string }
  | { kind: 'supervisor'; staffId: string; firstName: string; lastName: string }
  | { kind: 'admin_held' }
  | { kind: 'sold'; staffId: string; firstName: string; lastName: string; via: 'promoter' | 'supervisor' }
  | null

export interface StockMovement {
  id: string
  serialNumber: string
  categoryName: string
  type: 'REGISTERED' | 'SOLD' | 'RETURNED' | 'DAMAGED' | 'BULK_UPLOAD'
  timestamp: string
  venueName: string | null
  userName: string | null
  itemCount?: number
  registeredFromVenueName?: string | null
  serialNumbers?: string[]
  soldByName?: string | null
  soldAtVenueName?: string | null
  responsible: Responsible
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
export const getStockChart = async (venueId: string, params?: { days?: number }): Promise<StockChartResponse> => {
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
  data: { categoryId: string; minimumStock: number; alertEnabled: boolean },
): Promise<ConfigureAlertResult> => {
  const response = await api.post(`/api/v1/dashboard/venues/${venueId}/stock/alerts/configure`, data)
  return response.data.data
}

/**
 * Process bulk upload CSV
 */
export const processBulkUpload = async (venueId: string, data: { categoryId: string; csvContent: string }): Promise<BulkUploadResult> => {
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
 *
 * `dateFrom`/`dateTo` are ISO strings; pass `undefined` to skip the filter.
 */
export const getStockMovements = async (
  venueId: string,
  params?: { limit?: number; dateFrom?: string; dateTo?: string; responsibleStaffId?: string },
): Promise<StockMovementsResponse> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/stock/movements`, { params })
  return response.data.data
}

export interface StockResponsiblesResponse {
  adminHeld: { simsCount: number }
  supervisors: Array<{
    staffId: string
    firstName: string
    lastName: string
    ownSimsCount: number
    teamSimsCount: number
  }>
  promoters: Array<{
    staffId: string
    firstName: string
    lastName: string
    simsCount: number
  }>
}

export const getStockResponsibles = async (venueId: string): Promise<StockResponsiblesResponse> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/stock/responsibles`)
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

  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/stock/item-categories${params.toString() ? `?${params}` : ''}`)
  return response.data.data
}

// ===========================================
// ORG-LEVEL STOCK CONTROL TYPES
// ===========================================

export type OrgStockItemStatus = 'AVAILABLE' | 'SOLD' | 'DAMAGED' | 'RETURNED'

export interface OrgStockOverviewItem {
  id: string
  serialNumber: string
  status: OrgStockItemStatus
  categoryId: string
  categoryName: string
  createdAt: string
  soldAt: string | null
  registeredFromVenueId: string | null
  registeredFromVenueName: string | null
  sellingVenueId: string | null
  sellingVenueName: string | null
  currentVenueId: string | null
  currentVenueName: string | null
  createdById: string | null
  createdByName: string | null
  // Org-internal identifier (white-label orgs like PlayTelecom). Optional
  // because older backends won't populate it.
  createdByEmployeeCode?: string | null
  // Chain-of-custody (plan §2.2). Optional for backward-compat with older
  // backend responses (TPV rule: backend supports old clients; here we treat
  // absent fields as ADMIN_HELD + no assignments).
  custodyState?: 'ADMIN_HELD' | 'SUPERVISOR_HELD' | 'PROMOTER_PENDING' | 'PROMOTER_HELD' | 'PROMOTER_REJECTED' | 'SOLD'
  assignedSupervisorId?: string | null
  assignedSupervisorName?: string | null
  assignedSupervisorEmployeeCode?: string | null
  assignedPromoterId?: string | null
  assignedPromoterName?: string | null
  assignedPromoterEmployeeCode?: string | null
  promoterAcceptedAt?: string | null
  promoterRejectedAt?: string | null
}

export interface OrgStockBulkGroup {
  id: string
  firstCreatedAt: string
  lastCreatedAt: string
  categoryId: string
  categoryName: string
  registeredFromVenueId: string | null
  registeredFromVenueName: string | null
  createdById: string | null
  createdByName: string | null
  createdByEmployeeCode?: string | null
  itemCount: number
  serialNumberFirst: string
  serialNumberLast: string
  serialNumbers: string[]
  availableCount: number
  soldCount: number
  damagedCount: number
  returnedCount: number
}

export interface OrgStockSucursalAggregate {
  venueId: string
  venueName: string
  totalSims: number
  available: number
  sold: number
  damaged: number
  returned: number
  rotacionPct: number
  salesLast7Days: number[]
  lastActivity: string | null
}

export interface OrgStockCategoriaAggregate {
  categoryId: string
  categoryName: string
  totalSims: number
  available: number
  sold: number
  rotacionPct: number
  pctOfTotal: number
  sucursalesConStock: number
  estimatedCoverageDays: number | null
}

export interface OrgStockSummary {
  totalSims: number
  available: number
  sold: number
  damaged: number
  returned: number
  rotacionPct: number
  totalCargas: number
  sucursalesInvolucradas: number
  categoriasActivas: number
  dateRange: { from: string; to: string }
  generatedAt: string
  lastActivity: {
    timestamp: string
    venueName: string
    action: 'UPLOAD' | 'SALE'
  } | null
}

export interface OrgStockOverview {
  summary: OrgStockSummary
  items: OrgStockOverviewItem[]
  bulkGroups: OrgStockBulkGroup[]
  aggregatesBySucursal: OrgStockSucursalAggregate[]
  aggregatesByCategoria: OrgStockCategoriaAggregate[]
}

export interface OrgStockOverviewParams {
  dateFrom?: string
  dateTo?: string
}

// ===========================================
// ORG-LEVEL API FUNCTIONS
// ===========================================

export const getOrgStockOverview = async (orgId: string, params?: OrgStockOverviewParams): Promise<OrgStockOverview> => {
  const query = new URLSearchParams()
  if (params?.dateFrom) query.set('dateFrom', params.dateFrom)
  if (params?.dateTo) query.set('dateTo', params.dateTo)
  const qs = query.toString()

  const response = await api.get(`/api/v1/dashboard/organizations/${orgId}/stock-control/overview${qs ? `?${qs}` : ''}`)
  return response.data.data
}

export const downloadOrgStockExport = async (orgId: string, params?: OrgStockOverviewParams): Promise<{ blob: Blob; filename: string }> => {
  const query = new URLSearchParams()
  if (params?.dateFrom) query.set('dateFrom', params.dateFrom)
  if (params?.dateTo) query.set('dateTo', params.dateTo)
  const qs = query.toString()

  const response = await api.get(`/api/v1/dashboard/organizations/${orgId}/stock-control/export.xlsx${qs ? `?${qs}` : ''}`, {
    responseType: 'blob',
  })

  const disposition = (response.headers['content-disposition'] as string) || ''
  const match = /filename="([^"]+)"/.exec(disposition)
  const filename = match ? match[1] : `control-stock-${new Date().toISOString().split('T')[0]}.xlsx`

  return { blob: response.data, filename }
}
