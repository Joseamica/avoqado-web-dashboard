/**
 * Organization Dashboard API Service
 * Provides organization-level aggregate metrics and vision global
 * for PlayTelecom/White-Label dashboard.
 */
import api from '@/api'

// ===========================================
// TYPES
// ===========================================

export interface VisionGlobalSummary {
  sales: {
    today: number
    week: number
    month: number
    todayChange: number
    weekChange: number
  }
  units: {
    today: number
    week: number
    month: number
  }
  stores: {
    total: number
    active: number
    withAnomalies: number
  }
  promoters: {
    total: number
    activeToday: number
    attendanceRate: number
  }
  inventory: {
    totalPieces: number
    totalValue: number
    lowStockAlerts: number
    criticalAlerts: number
  }
  topStores: Array<{
    id: string
    name: string
    todaySales: number
    todayUnits: number
    trend: 'UP' | 'DOWN' | 'STABLE'
  }>
  recentActivity: Array<{
    id: string
    type: string
    description: string
    storeName: string
    timestamp: string
  }>
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
  stores: StorePerformance[]
}

export interface CrossStoreAnomaly {
  id: string
  type: 'LOW_SALES' | 'HIGH_RETURNS' | 'ATTENDANCE_ISSUE' | 'STOCK_ALERT' | 'DEPOSIT_PENDING'
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

export interface ManagerInfo {
  id: string
  name: string
  email: string
  storeCount: number
  activeStores: number
  todaySales: number
}

export interface ManagersResponse {
  managers: ManagerInfo[]
}

export interface ManagerDashboard {
  manager: {
    id: string
    name: string
    email: string
    phone: string | null
    photoUrl: string | null
  }
  stores: Array<{
    id: string
    name: string
    todaySales: number
    weekSales: number
    activePromoters: number
    totalPromoters: number
    performance: number
  }>
  metrics: {
    totalSalesToday: number
    totalSalesWeek: number
    totalSalesMonth: number
    avgStorePerformance: number
    totalPromoters: number
    activePromoters: number
  }
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

// ===========================================
// API FUNCTIONS
// ===========================================

/**
 * Get vision global summary for organization
 */
export const getVisionGlobalSummary = async (orgId: string): Promise<VisionGlobalSummary> => {
  const response = await api.get(`/api/v1/dashboard/organizations/${orgId}/vision-global`)
  return response.data.data
}

/**
 * Get store performance ranking
 */
export const getStorePerformance = async (
  orgId: string,
  params?: { limit?: number }
): Promise<StorePerformanceResponse> => {
  const response = await api.get(`/api/v1/dashboard/organizations/${orgId}/store-performance`, {
    params,
  })
  return response.data.data
}

/**
 * Get cross-store anomalies
 */
export const getCrossStoreAnomalies = async (
  orgId: string
): Promise<CrossStoreAnomaliesResponse> => {
  const response = await api.get(`/api/v1/dashboard/organizations/${orgId}/anomalies`)
  return response.data.data
}

/**
 * Get list of managers in organization
 */
export const getOrgManagers = async (orgId: string): Promise<ManagersResponse> => {
  const response = await api.get(`/api/v1/dashboard/organizations/${orgId}/managers`)
  return response.data.data
}

/**
 * Get manager dashboard with assigned stores
 */
export const getManagerDashboard = async (
  orgId: string,
  managerId: string
): Promise<ManagerDashboard> => {
  const response = await api.get(`/api/v1/dashboard/organizations/${orgId}/managers/${managerId}`)
  return response.data.data
}

/**
 * Get organization-wide stock summary
 */
export const getOrgStockSummary = async (orgId: string): Promise<OrgStockSummary> => {
  const response = await api.get(`/api/v1/dashboard/organizations/${orgId}/stock-summary`)
  return response.data.data
}

// ===========================================
// ZONES
// ===========================================

export interface OrgZone {
  id: string
  name: string
  slug: string
  venues: Array<{ id: string; name: string }>
  createdAt: string
  updatedAt: string
}

export const getOrgZones = async (orgId: string): Promise<OrgZone[]> => {
  const response = await api.get(`/api/v1/dashboard/organizations/${orgId}/zones`)
  return response.data.data.zones
}

export const createOrgZone = async (orgId: string, data: { name: string; slug: string }): Promise<OrgZone> => {
  const response = await api.post(`/api/v1/dashboard/organizations/${orgId}/zones`, data)
  return response.data.data.zone
}

export const updateOrgZone = async (orgId: string, zoneId: string, data: { name?: string; slug?: string }): Promise<OrgZone> => {
  const response = await api.put(`/api/v1/dashboard/organizations/${orgId}/zones/${zoneId}`, data)
  return response.data.data.zone
}

export const deleteOrgZone = async (orgId: string, zoneId: string): Promise<void> => {
  await api.delete(`/api/v1/dashboard/organizations/${orgId}/zones/${zoneId}`)
}

// ===========================================
// ADMIN RESET PASSWORD
// ===========================================

export interface ResetPasswordResult {
  temporaryPassword: string
}

export const adminResetPassword = async (orgId: string, userId: string): Promise<ResetPasswordResult> => {
  const response = await api.post(`/api/v1/dashboard/organizations/${orgId}/users/${userId}/reset-password`)
  return response.data.data
}

// ===========================================
// TIME ENTRY VALIDATION
// ===========================================

export const validateTimeEntry = async (
  orgId: string,
  timeEntryId: string,
  data: { status: 'APPROVED' | 'REJECTED'; note?: string }
): Promise<void> => {
  await api.patch(`/api/v1/dashboard/organizations/${orgId}/time-entries/${timeEntryId}/validate`, data)
}

// ===========================================
// CLOSING REPORT
// ===========================================

export interface ClosingReportRow {
  rowNumber: number
  city: string
  storeName: string
  iccid: string | null
  saleType: string
  promoter: string
  date: string
  amount: number
}

export interface ClosingReportData {
  rows: ClosingReportRow[]
  totalAmount: number
}

export const getClosingReportData = async (
  orgId: string,
  params?: { date?: string; venueId?: string }
): Promise<ClosingReportData> => {
  const response = await api.get(`/api/v1/dashboard/organizations/${orgId}/reports/closing-report`, { params })
  return response.data.data
}

export const downloadClosingReportXlsx = async (
  orgId: string,
  params?: { date?: string; venueId?: string }
): Promise<Blob> => {
  const response = await api.get(`/api/v1/dashboard/organizations/${orgId}/reports/closing-report/export`, {
    params,
    responseType: 'blob',
  })
  return response.data
}

// ===========================================
// STAFF ATTENDANCE (with filters)
// ===========================================

export interface StaffAttendanceEntry {
  id: string | null
  staffId: string
  staffName: string
  venueName: string
  clockIn: string | null
  clockOut: string | null
  clockInPhotoUrl: string | null
  clockInLatitude: number | null
  clockInLongitude: number | null
  validationStatus: 'PENDING' | 'APPROVED' | 'REJECTED'
  status: 'ACTIVE' | 'INACTIVE'
  sales: number
}

export const getStaffAttendance = async (
  orgId: string,
  params?: { period?: string; venueId?: string; status?: string }
): Promise<{ entries: StaffAttendanceEntry[] }> => {
  // Backend expects `date` param, not `period`. Convert period to date.
  const queryParams: Record<string, string> = {}
  if (params?.venueId) queryParams.venueId = params.venueId
  if (params?.status) queryParams.status = params.status
  if (params?.period) {
    const now = new Date()
    if (params.period === 'today') {
      queryParams.date = now.toISOString().split('T')[0]
    } else if (params.period === 'week') {
      // Send today's date — backend only supports single-day attendance
      queryParams.date = now.toISOString().split('T')[0]
    } else if (params.period === 'month') {
      queryParams.date = now.toISOString().split('T')[0]
    }
  }

  const response = await api.get(`/api/v1/dashboard/organizations/${orgId}/staff/attendance`, { params: queryParams })
  const data = response.data.data

  // Backend returns { staff: [...] }, map to our StaffAttendanceEntry format
  const staff = data.staff ?? data.entries ?? []
  const entries: StaffAttendanceEntry[] = staff.map((s: any) => ({
    id: s.timeEntryId ?? null,
    staffId: s.id,
    staffName: s.name || `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim(),
    venueName: s.venueName,
    clockIn: s.checkInTime ?? null,
    clockOut: s.checkOutTime ?? null,
    clockInPhotoUrl: s.checkInPhotoUrl ?? null,
    clockInLatitude: s.checkInLocation?.lat ?? null,
    clockInLongitude: s.checkInLocation?.lng ?? null,
    validationStatus: s.validationStatus ?? (s.status === 'ACTIVE' ? 'PENDING' : 'PENDING'),
    status: s.status ?? 'INACTIVE',
    sales: s.sales ?? 0,
  }))

  return { entries }
}
