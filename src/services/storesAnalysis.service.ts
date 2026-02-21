/**
 * Stores Analysis API Service (WHITE-LABEL)
 * Provides organization-level analytics at the VENUE level.
 *
 * These endpoints use venueId instead of orgId, allowing
 * white-label role-based access control to work properly.
 */
import api from '@/api'

// ===========================================
// TYPES (same as organizationDashboard.service)
// ===========================================

export interface CategoryBreakdownItem {
  id: string
  name: string
  sales: number
  units: number
  percentage: number
}

export interface VisionGlobalSummary {
  todaySales: number
  todayCashSales: number
  weekSales: number
  monthSales: number
  unitsSold: number
  avgTicket: number
  activePromoters: number
  totalPromoters: number
  activeStores: number
  totalStores: number
  approvedDeposits: number
  categoryBreakdown?: CategoryBreakdownItem[]
}

export interface StorePerformance {
  id: string
  name: string
  slug: string
  region: string | null
  todaySales: number
  weekSales: number
  monthSales: number
  todayUnits: number
  weekUnits: number
  activePromoters: number
  totalPromoters: number
  stockAvailable: number
  alertLevel: 'OK' | 'WARNING' | 'CRITICAL'
  performance: number
}

export interface StorePerformanceResponse {
  venues: StorePerformance[]
}

export interface CrossStoreAnomaly {
  id: string
  type: 'LOW_PERFORMANCE' | 'NO_CHECKINS' | 'LOW_STOCK' | 'PENDING_DEPOSITS' | 'GPS_VIOLATION'
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
  title: string
  description: string
  storeId: string
  storeName: string
  timestamp: string
  actionRequired: boolean
}

export interface CrossStoreAnomaliesResponse {
  anomalies: CrossStoreAnomaly[]
}

export interface OrgStockSummary {
  totalPieces: number
  totalValue: number
  lowStockAlerts: number
  criticalAlerts: number
  storeBreakdown: Array<{
    storeId: string
    storeName: string
    available: number
    value: number
    alertLevel: 'OK' | 'WARNING' | 'CRITICAL'
  }>
}

export interface OnlineStaffResponse {
  total: number
  activeCount: number
  inactiveCount: number
  staff: Array<{
    id: string
    name: string
    venueName: string
    role: string
    checkInTime: string
    status: 'ACTIVE' | 'INACTIVE'
  }>
}

export interface ActivityFeedEvent {
  id: string
  type: 'sale' | 'checkin' | 'checkout' | 'gps_error' | 'alert' | 'other'
  title: string
  subtitle: string
  timestamp: string
  severity: 'normal' | 'warning' | 'error'
  venueId: string
  venueName: string
  staffId?: string
  staffName?: string
  metadata?: Record<string, unknown>
}

export interface ActivityFeedResponse {
  events: ActivityFeedEvent[]
  total: number
}

export interface ChartDataPoint {
  day: string
  date: string
  target: number
  actual: number
  percentage: number
}

export interface ChartResponse {
  days: ChartDataPoint[]
  weekTotal: {
    actual: number
    target: number
  }
}

export interface TopPromoterResponse {
  promoter: {
    id: string
    name: string
    venueName: string
    salesCount: number
    salesAmount: number
  } | null
}

export interface WorstAttendanceResponse {
  venue: {
    id: string
    name: string
    attendanceRate: number
    activeStaff: number
    totalStaff: number
  } | null
}

// ===========================================
// API FUNCTIONS (venue-level endpoints)
// ===========================================

/**
 * Get overview/vision global summary
 * Uses venue-level endpoint for white-label access control
 */
export const getOverview = async (
  venueId: string,
  startDate?: string,
  endDate?: string,
  filterVenueId?: string,
): Promise<VisionGlobalSummary> => {
  const params: Record<string, string> = {}
  if (startDate) params.startDate = startDate
  if (endDate) params.endDate = endDate
  if (filterVenueId) params.filterVenueId = filterVenueId
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/stores-analysis/overview`, { params })
  return response.data.data
}

/**
 * Get all venues in the organization
 */
export const getVenues = async (venueId: string): Promise<StorePerformanceResponse> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/stores-analysis/venues`)
  return response.data.data
}

/**
 * Get organization-wide stock summary
 */
export const getStockSummary = async (venueId: string): Promise<OrgStockSummary> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/stores-analysis/stock-summary`)
  return response.data.data
}

/**
 * Get cross-store anomalies
 */
export const getAnomalies = async (venueId: string): Promise<CrossStoreAnomaliesResponse> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/stores-analysis/anomalies`)
  return response.data.data
}

/**
 * Get revenue vs target chart data
 */
export const getRevenueVsTarget = async (venueId: string, filterVenueId?: string): Promise<ChartResponse> => {
  const params = filterVenueId ? { venueId: filterVenueId } : undefined
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/stores-analysis/charts/revenue-vs-target`, { params })
  return response.data.data
}

/**
 * Get volume vs target chart data
 */
export const getVolumeVsTarget = async (venueId: string, filterVenueId?: string): Promise<ChartResponse> => {
  const params = filterVenueId ? { venueId: filterVenueId } : undefined
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/stores-analysis/charts/volume-vs-target`, { params })
  return response.data.data
}

/**
 * Get top promoter insight
 */
export const getTopPromoter = async (venueId: string): Promise<TopPromoterResponse> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/stores-analysis/insights/top-promoter`)
  return response.data.data
}

/**
 * Get worst attendance insight
 */
export const getWorstAttendance = async (venueId: string): Promise<WorstAttendanceResponse> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/stores-analysis/insights/worst-attendance`)
  return response.data.data
}

/**
 * Get online staff
 */
export const getOnlineStaff = async (venueId: string): Promise<OnlineStaffResponse> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/stores-analysis/staff/online`)
  return response.data.data
}

/**
 * Get activity feed
 */
export const getActivityFeed = async (
  venueId: string,
  params?: { limit?: number; startDate?: string; endDate?: string; filterVenueId?: string },
): Promise<ActivityFeedResponse> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/stores-analysis/activity-feed`, { params })
  return response.data.data
}

// ===========================================
// STORE PERFORMANCE RANKING & STAFF ATTENDANCE
// ===========================================

export interface StorePerformanceRanking {
  id: string
  name: string
  slug: string
  logo: string | null
  todaySales: number
  weekSales: number
  unitsSold: number
  promoterCount: number
  activePromoters: number
  trend: 'up' | 'down' | 'stable'
  rank: number
  performance?: number
  goalAmount?: number
  goalType?: SalesGoalType
  goalPeriod?: 'DAILY' | 'WEEKLY' | 'MONTHLY'
  goalId?: string
  goalSource?: GoalSource
}

export interface StorePerformanceRankingResponse {
  stores: StorePerformanceRanking[]
}

export interface StaffAttendanceEntry {
  id: string
  timeEntryId: string | null
  name: string
  email: string
  avatar?: string | null
  venueId: string
  venueName: string
  status: 'ACTIVE' | 'INACTIVE'
  validationStatus: 'PENDING' | 'APPROVED' | 'REJECTED'
  checkInTime?: string | null
  checkInLocation?: { lat: number; lng: number } | null
  checkInPhotoUrl?: string | null
  checkOutTime?: string | null
  checkOutLocation?: { lat: number; lng: number } | null
  checkOutPhotoUrl?: string | null
  break: boolean
  breakMinutes: number
  sales: number
  attendancePercent: number
}

export interface StaffAttendanceResponse {
  staff: StaffAttendanceEntry[]
}

/**
 * Get store performance ranking
 */
export const getStorePerformance = async (
  venueId: string,
  params?: { limit?: number; startDate?: string; endDate?: string },
): Promise<StorePerformanceRankingResponse> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/stores-analysis/store-performance`, { params })
  return response.data.data
}

/**
 * Get staff attendance
 */
export const getStaffAttendance = async (
  venueId: string,
  params?: { date?: string; venueId?: string; status?: string; startDate?: string; endDate?: string },
): Promise<StaffAttendanceResponse> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/stores-analysis/staff-attendance`, { params })
  return response.data.data
}

/**
 * Validate a time entry (approve/reject)
 */
export const validateTimeEntry = async (
  venueId: string,
  timeEntryId: string,
  data: { status: 'APPROVED' | 'REJECTED'; note?: string; depositAmount?: number },
): Promise<{ id: string; validationStatus: string }> => {
  const response = await api.post(`/api/v1/dashboard/venues/${venueId}/stores-analysis/time-entry/${timeEntryId}/validate`, data)
  return response.data.data
}

/**
 * Reset a time entry validation back to PENDING
 */
export const resetTimeEntryValidation = async (venueId: string, timeEntryId: string): Promise<{ id: string; validationStatus: string }> => {
  const response = await api.post(`/api/v1/dashboard/venues/${venueId}/stores-analysis/time-entry/${timeEntryId}/reset-validation`)
  return response.data.data
}

// ===========================================
// CLOSING REPORT & ZONES
// ===========================================

export interface ClosingReportRow {
  row: number
  city: string
  store: string
  iccid: string
  saleType: string
  promoter: string
  date: string
  amount: number
}

export interface ClosingReportResponse {
  rows: ClosingReportRow[]
  totalAmount: number
  date: string
}

export interface ZoneWithVenues {
  id: string
  name: string
  slug: string
  venues: Array<{
    id: string
    name: string
    slug: string
  }>
}

/**
 * Get closing report data
 */
export const getClosingReportData = async (
  venueId: string,
  params?: { date?: string; venueId?: string },
): Promise<ClosingReportResponse> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/stores-analysis/closing-report`, { params })
  return response.data.data
}

/**
 * Download closing report as Excel
 */
export const downloadClosingReportXlsx = async (venueId: string, params?: { date?: string; venueId?: string }): Promise<Blob> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/stores-analysis/closing-report/download`, {
    params,
    responseType: 'blob',
  })
  return response.data
}

/**
 * Get organization zones
 */
export const getZones = async (venueId: string): Promise<ZoneWithVenues[]> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/stores-analysis/zones`)
  return response.data.data
}

// ===========================================
// TEAM MANAGEMENT
// ===========================================

export interface TeamMember {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  photoUrl: string | null
  status: string
  orgRole: string
  venues: Array<{
    id: string
    staffVenueId: string
    name: string
    slug: string
    role: string
    active: boolean
  }>
}

/**
 * Get organization team members
 */
export const getTeam = async (venueId: string): Promise<TeamMember[]> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/stores-analysis/team`)
  return response.data.data
}

/**
 * Admin reset password for a user
 */
export const adminResetPassword = async (venueId: string, userId: string): Promise<{ temporaryPassword: string; message: string }> => {
  const response = await api.post(`/api/v1/dashboard/venues/${venueId}/stores-analysis/admin/reset-password/${userId}`)
  return response.data.data
}

export interface ActivityLogEntry {
  id: string
  action: string
  performedBy: string
  data: Record<string, unknown> | null
  createdAt: string
}

/**
 * Get activity logs for a staff member
 */
export const getStaffActivityLog = async (venueId: string, staffId: string): Promise<ActivityLogEntry[]> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/stores-analysis/team/${staffId}/activity`)
  return response.data.data
}

/**
 * Sync venue assignments for a staff member
 */
export const syncStaffVenues = async (
  venueId: string,
  staffId: string,
  venueIds: string[],
): Promise<{ added: number; removed: number }> => {
  const response = await api.patch(`/api/v1/dashboard/venues/${venueId}/stores-analysis/team/${staffId}/venues`, { venueIds })
  return response.data.data
}

// ===========================================
// STORE-SPECIFIC ENDPOINTS (CENTRALIZED DATA)
// These endpoints provide data for a specific store within the organization.
// All data needed for STORES_ANALYSIS page comes from these endpoints,
// eliminating the need for access to COMMAND_CENTER or SERIALIZED_STOCK.
// ===========================================

/**
 * Store summary response - same structure as CommandCenterSummary
 */
export interface StoreSummary {
  todaySales: number
  todayUnits: number
  avgTicket: number
  weekSales: number
  weekUnits: number
  monthSales: number
  monthUnits: number
  activePromoters: number
  totalPromoters: number
  activeStores: number
  totalStores: number
  topSellers: Array<{
    id: string
    name: string
    photoUrl: string | null
    sales: number
    units: number
    rank: number
  }>
  categoryBreakdown: Array<{
    id: string
    name: string
    sales: number
    units: number
    percentage: number
  }>
}

/**
 * Sales trend response - same structure as SalesTrendResponse
 */
export interface StoreSalesTrendPoint {
  date: string
  sales: number
  units: number
  transactions: number
}

export interface StoreSalesTrendResponse {
  trend: StoreSalesTrendPoint[]
  comparison: {
    salesChange: number
    unitsChange: number
    transactionsChange: number
  }
}

/**
 * Store inventory summary response
 */
export interface StoreInventoryCategory {
  id: string
  name: string
  available: number
  sold: number
  returned: number
  damaged: number
  total: number
}

export interface StoreInventorySummary {
  categories: StoreInventoryCategory[]
  totals: {
    available: number
    sold: number
    returned: number
    damaged: number
    total: number
  }
}

/**
 * Get summary for a specific store (KPIs, top sellers, category breakdown)
 * This endpoint provides the same data as /command-center/summary but under STORES_ANALYSIS access.
 */
export const getStoreSummary = async (venueId: string, storeId: string): Promise<StoreSummary> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/stores-analysis/store/${storeId}/summary`)
  return response.data.data
}

/**
 * Get sales trend for a specific store
 * This endpoint provides the same data as /command-center/stock-vs-sales but under STORES_ANALYSIS access.
 */
export const getStoreSalesTrend = async (
  venueId: string,
  storeId: string,
  params?: { days?: number; startDate?: string; endDate?: string },
): Promise<StoreSalesTrendResponse> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/stores-analysis/store/${storeId}/sales-trend`, { params })
  return response.data.data
}

/**
 * Get inventory summary for a specific store (categories with stock counts)
 * This endpoint provides the same data as /serialized-inventory/summary but under STORES_ANALYSIS access.
 */
export const getStoreInventorySummary = async (venueId: string, storeId: string): Promise<StoreInventorySummary> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/stores-analysis/store/${storeId}/inventory-summary`)
  return response.data.data
}

// ===========================================
// STORE GOAL MANAGEMENT
// ===========================================

export type SalesGoalType = 'AMOUNT' | 'QUANTITY'

export type GoalSource = 'venue' | 'organization'

export interface StoreGoal {
  id: string
  venueId: string
  staffId: string | null
  goal: number
  goalType: SalesGoalType
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY'
  currentSales: number
  active: boolean
  createdAt: string
  updatedAt: string
  staff?: { id: string; firstName: string; lastName: string } | null
  source?: GoalSource
}

export interface CreateStoreGoalInput {
  staffId?: string | null
  goal: number
  goalType?: SalesGoalType
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY'
}

export interface UpdateStoreGoalInput {
  goal?: number
  goalType?: SalesGoalType
  period?: 'DAILY' | 'WEEKLY' | 'MONTHLY'
  active?: boolean
}

/**
 * Get all sales goals for a specific store
 */
export const getStoreGoals = async (venueId: string, storeId: string): Promise<StoreGoal[]> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/stores-analysis/store/${storeId}/goals`)
  return response.data.data
}

/**
 * Create a new sales goal for a specific store
 */
export const createStoreGoal = async (venueId: string, storeId: string, data: CreateStoreGoalInput): Promise<StoreGoal> => {
  const response = await api.post(`/api/v1/dashboard/venues/${venueId}/stores-analysis/store/${storeId}/goals`, data)
  return response.data.data
}

/**
 * Update an existing sales goal for a specific store
 */
export const updateStoreGoal = async (venueId: string, storeId: string, goalId: string, data: UpdateStoreGoalInput): Promise<StoreGoal> => {
  const response = await api.patch(`/api/v1/dashboard/venues/${venueId}/stores-analysis/store/${storeId}/goals/${goalId}`, data)
  return response.data.data
}

/**
 * Delete a sales goal for a specific store
 */
export const deleteStoreGoal = async (venueId: string, storeId: string, goalId: string): Promise<void> => {
  await api.delete(`/api/v1/dashboard/venues/${venueId}/stores-analysis/store/${storeId}/goals/${goalId}`)
}

// ===========================================
// ORG-LEVEL GOAL MANAGEMENT
// ===========================================

export interface OrgGoal extends StoreGoal {
  source: 'organization'
}

export interface CreateOrgGoalInput {
  goal: number
  goalType?: SalesGoalType
  period?: 'DAILY' | 'WEEKLY' | 'MONTHLY'
}

export interface UpdateOrgGoalInput {
  goal?: number
  goalType?: SalesGoalType
  period?: 'DAILY' | 'WEEKLY' | 'MONTHLY'
  active?: boolean
}

/**
 * Get all org-level sales goals
 */
export const getOrgGoals = async (venueId: string): Promise<OrgGoal[]> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/stores-analysis/org-goals`)
  return response.data.data
}

/**
 * Create a new org-level sales goal
 */
export const createOrgGoal = async (venueId: string, data: CreateOrgGoalInput): Promise<OrgGoal> => {
  const response = await api.post(`/api/v1/dashboard/venues/${venueId}/stores-analysis/org-goals`, data)
  return response.data.data
}

/**
 * Update an existing org-level sales goal
 */
export const updateOrgGoal = async (venueId: string, goalId: string, data: UpdateOrgGoalInput): Promise<OrgGoal> => {
  const response = await api.patch(`/api/v1/dashboard/venues/${venueId}/stores-analysis/org-goals/${goalId}`, data)
  return response.data.data
}

/**
 * Delete an org-level sales goal
 */
export const deleteOrgGoal = async (venueId: string, goalId: string): Promise<void> => {
  await api.delete(`/api/v1/dashboard/venues/${venueId}/stores-analysis/org-goals/${goalId}`)
}

// =============================================================================
// HEATMAP TYPES & API FUNCTIONS
// =============================================================================

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'future'

export interface AttendanceHeatmapDay {
  date: string
  status: AttendanceStatus
  clockInTime: string | null
  clockOutTime: string | null
}

export interface AttendanceHeatmapStaff {
  staffId: string
  staffName: string
  venueId: string
  venueName: string
  venueState: string
  days: AttendanceHeatmapDay[]
}

export interface AttendanceHeatmapSummaryDay {
  date: string
  present: number
  late: number
  absent: number
}

export interface AttendanceHeatmapResult {
  staff: AttendanceHeatmapStaff[]
  summary: { byDay: AttendanceHeatmapSummaryDay[] }
}

export interface SalesHeatmapDay {
  date: string
  salesCount: number
  salesAmount: number
}

export interface SalesHeatmapStaff {
  staffId: string
  staffName: string
  venueId: string
  venueName: string
  venueState: string
  days: SalesHeatmapDay[]
  totalSales: number
  totalCount: number
  avgDailySales: number
}

export interface SalesHeatmapSummaryDay {
  date: string
  totalCount: number
  totalAmount: number
}

export interface SalesHeatmapVenueSummary {
  venueId: string
  venueName: string
  total: number
  byDay: SalesHeatmapSummaryDay[]
}

export interface SalesHeatmapResult {
  staff: SalesHeatmapStaff[]
  summary: {
    byDay: SalesHeatmapSummaryDay[]
    byVenue: SalesHeatmapVenueSummary[]
  }
}

// =============================================================================
// ORG ATTENDANCE CONFIG
// =============================================================================

export interface OrgAttendanceConfig {
  id: string
  organizationId: string
  expectedCheckInTime: string
  latenessThresholdMinutes: number
  geofenceRadiusMeters: number
  // Module defaults
  attendanceTracking: boolean
  requireFacadePhoto: boolean
  requireDepositPhoto: boolean
  enableCashPayments: boolean
  enableCardPayments: boolean
  enableBarcodeScanner: boolean
  createdAt: string
  updatedAt: string
}

export interface UpsertOrgAttendanceConfigInput {
  expectedCheckInTime?: string
  latenessThresholdMinutes?: number
  geofenceRadiusMeters?: number
  attendanceTracking?: boolean
  requireFacadePhoto?: boolean
  requireDepositPhoto?: boolean
  enableCashPayments?: boolean
  enableCardPayments?: boolean
  enableBarcodeScanner?: boolean
}

export const getOrgAttendanceConfig = async (venueId: string): Promise<OrgAttendanceConfig | null> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/stores-analysis/org-attendance-config`)
  return response.data.data
}

export const upsertOrgAttendanceConfig = async (venueId: string, data: UpsertOrgAttendanceConfigInput): Promise<OrgAttendanceConfig> => {
  const response = await api.put(`/api/v1/dashboard/venues/${venueId}/stores-analysis/org-attendance-config`, data)
  return response.data.data
}

export const deleteOrgAttendanceConfig = async (venueId: string): Promise<void> => {
  await api.delete(`/api/v1/dashboard/venues/${venueId}/stores-analysis/org-attendance-config`)
}

// =============================================================================
// ORG TPV DEFAULTS (full TpvSettings JSON)
// =============================================================================

export interface OrgTpvStats {
  totalTerminals: number
  venues: { id: string; name: string; slug: string; terminalCount: number }[]
}

export const getOrgTpvDefaults = async (venueId: string): Promise<Record<string, any> | null> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/stores-analysis/org-tpv-defaults`)
  return response.data.data
}

export const upsertOrgTpvDefaults = async (
  venueId: string,
  settings: Record<string, any>,
): Promise<{ config: Record<string, any>; terminalsUpdated: number }> => {
  const response = await api.put(`/api/v1/dashboard/venues/${venueId}/stores-analysis/org-tpv-defaults`, { settings })
  return response.data.data
}

export const getOrgTpvStats = async (venueId: string): Promise<OrgTpvStats> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/stores-analysis/org-tpv-defaults/stats`)
  return response.data.data
}

// =============================================================================
// HEATMAP
// =============================================================================

export interface HeatmapDateParams {
  startDate: string
  endDate: string
  filterVenueId?: string
}

/**
 * Get attendance heatmap (staff × day matrix)
 */
export const getAttendanceHeatmap = async (venueId: string, params: HeatmapDateParams): Promise<AttendanceHeatmapResult> => {
  const query = new URLSearchParams({ startDate: params.startDate, endDate: params.endDate })
  if (params.filterVenueId) query.set('filterVenueId', params.filterVenueId)
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/stores-analysis/attendance-heatmap?${query}`)
  return response.data.data
}

/**
 * Get sales heatmap (staff × day matrix)
 */
export const getSalesHeatmap = async (venueId: string, params: HeatmapDateParams): Promise<SalesHeatmapResult> => {
  const query = new URLSearchParams({ startDate: params.startDate, endDate: params.endDate })
  if (params.filterVenueId) query.set('filterVenueId', params.filterVenueId)
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/stores-analysis/sales-heatmap?${query}`)
  return response.data.data
}
