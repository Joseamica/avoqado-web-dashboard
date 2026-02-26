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
export const getStorePerformance = async (orgId: string, params?: { limit?: number }): Promise<StorePerformanceResponse> => {
  const response = await api.get(`/api/v1/dashboard/organizations/${orgId}/store-performance`, {
    params,
  })
  return response.data.data
}

/**
 * Get cross-store anomalies
 */
export const getCrossStoreAnomalies = async (orgId: string): Promise<CrossStoreAnomaliesResponse> => {
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
export const getManagerDashboard = async (orgId: string, managerId: string): Promise<ManagerDashboard> => {
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
  data: { status: 'APPROVED' | 'REJECTED'; note?: string },
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

export const getClosingReportData = async (orgId: string, params?: { date?: string; venueId?: string }): Promise<ClosingReportData> => {
  const response = await api.get(`/api/v1/dashboard/organizations/${orgId}/reports/closing-report`, { params })
  return response.data.data
}

export const downloadClosingReportXlsx = async (orgId: string, params?: { date?: string; venueId?: string }): Promise<Blob> => {
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
  params?: { period?: string; venueId?: string; status?: string },
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

// ===========================================
// TERMINALS (Org-Level Fleet View)
// ===========================================

export interface OrgTerminal {
  id: string
  name: string
  serialNumber: string | null
  type: string
  status: string
  brand: string | null
  model: string | null
  version: string | null
  lastHeartbeat: string | null
  ipAddress: string | null
  healthScore: number | null
  isLocked: boolean
  assignedMerchantIds: string[]
  activatedAt: string | null
  activationCode: string | null
  activationCodeExpiry: string | null
  venue: { id: string; name: string; slug: string }
}

export interface OrgTerminalsSummary {
  total: number
  online: number
  offline: number
  byStatus: Record<string, number>
  byType: Record<string, number>
}

export interface OrgTerminalsResponse {
  terminals: OrgTerminal[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
  summary: OrgTerminalsSummary
}

export interface OrgTerminalsFilters {
  page?: number
  pageSize?: number
  venueId?: string
  status?: string
  type?: string
  search?: string
}

export function isTerminalOnline(lastHeartbeat?: string | null, thresholdMinutes = 5): boolean {
  if (!lastHeartbeat) return false
  const diffMs = Date.now() - new Date(lastHeartbeat).getTime()
  return diffMs / (1000 * 60) < thresholdMinutes
}

export async function getOrgTerminals(orgId: string, filters?: OrgTerminalsFilters): Promise<OrgTerminalsResponse> {
  const response = await api.get(`/api/v1/dashboard/organizations/${orgId}/terminals`, { params: filters })
  return response.data.data
}

// ===========================================
// TERMINAL MANAGEMENT (CRUD + Commands)
// ===========================================

export interface CreateOrgTerminalRequest {
  venueId: string
  serialNumber: string
  name: string
  type: string
  brand?: string
  model?: string
  assignedMerchantIds?: string[]
  generateActivationCode?: boolean
}

export interface UpdateOrgTerminalRequest {
  name?: string
  status?: string
  brand?: string
  model?: string
  assignedMerchantIds?: string[]
}

export interface OrgActivationCodeResponse {
  activationCode: string
  expiresAt: string
  terminalId: string
}

export interface OrgMerchantAccount {
  id: string
  displayName: string | null
  alias: string | null
  externalMerchantId: string | null
  provider: { name: string } | null
  blumonSerialNumber: string | null
}

export interface OrgCommandResult {
  commandId: string
  correlationId: string
  status: string
  queued: boolean
  terminalOnline: boolean
  message: string
}

export type OrgTerminalCommand =
  | 'LOCK'
  | 'UNLOCK'
  | 'MAINTENANCE_MODE'
  | 'EXIT_MAINTENANCE'
  | 'RESTART'
  | 'CLEAR_CACHE'
  | 'EXPORT_LOGS'

export async function getOrgTerminalById(orgId: string, terminalId: string): Promise<OrgTerminal> {
  const response = await api.get(`/api/v1/dashboard/organizations/${orgId}/terminals/${terminalId}`)
  return response.data.data
}

export async function createOrgTerminal(orgId: string, data: CreateOrgTerminalRequest) {
  const response = await api.post(`/api/v1/dashboard/organizations/${orgId}/terminals`, data)
  return response.data.data
}

export async function updateOrgTerminal(orgId: string, terminalId: string, data: UpdateOrgTerminalRequest) {
  const response = await api.patch(`/api/v1/dashboard/organizations/${orgId}/terminals/${terminalId}`, data)
  return response.data.data
}

export async function deleteOrgTerminal(orgId: string, terminalId: string) {
  const response = await api.delete(`/api/v1/dashboard/organizations/${orgId}/terminals/${terminalId}`)
  return response.data.data
}

export async function generateOrgTerminalActivationCode(
  orgId: string,
  terminalId: string,
): Promise<OrgActivationCodeResponse> {
  const response = await api.post(
    `/api/v1/dashboard/organizations/${orgId}/terminals/${terminalId}/generate-activation-code`,
  )
  return response.data.data
}

export async function sendOrgTerminalRemoteActivation(orgId: string, terminalId: string) {
  const response = await api.post(
    `/api/v1/dashboard/organizations/${orgId}/terminals/${terminalId}/remote-activate`,
  )
  return response.data.data
}

export async function sendOrgTerminalCommand(
  orgId: string,
  terminalId: string,
  command: OrgTerminalCommand,
): Promise<OrgCommandResult> {
  const response = await api.post(
    `/api/v1/dashboard/organizations/${orgId}/terminals/${terminalId}/command`,
    { command },
  )
  return response.data.data
}

export async function assignOrgTerminalMerchants(orgId: string, terminalId: string, merchantIds: string[]) {
  const response = await api.put(
    `/api/v1/dashboard/organizations/${orgId}/terminals/${terminalId}/merchants`,
    { merchantIds },
  )
  return response.data.data
}

export async function getOrgMerchantAccounts(orgId: string): Promise<OrgMerchantAccount[]> {
  const response = await api.get(`/api/v1/dashboard/organizations/${orgId}/merchant-accounts`)
  return response.data.data.merchants
}

// ===========================================
// ACTIVITY LOG
// ===========================================

export interface OrgActivityLogEntry {
  id: string
  action: string
  entity: string | null
  entityId: string | null
  data: Record<string, unknown> | null
  ipAddress: string | null
  createdAt: string
  staff: { id: string; firstName: string; lastName: string } | null
  venueName: string
}

export interface OrgActivityLogResponse {
  logs: OrgActivityLogEntry[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}

export interface OrgActivityLogFilters {
  page?: number
  pageSize?: number
  venueId?: string
  staffId?: string
  action?: string
  search?: string
  startDate?: string
  endDate?: string
}

export async function getOrgActivityLog(orgId: string, filters?: OrgActivityLogFilters): Promise<OrgActivityLogResponse> {
  const params = new URLSearchParams()
  if (filters?.page) params.set('page', String(filters.page))
  if (filters?.pageSize) params.set('pageSize', String(filters.pageSize))
  if (filters?.venueId) params.set('venueId', filters.venueId)
  if (filters?.staffId) params.set('staffId', filters.staffId)
  if (filters?.action) params.set('action', filters.action)
  if (filters?.search) params.set('search', filters.search)
  if (filters?.startDate) params.set('startDate', filters.startDate)
  if (filters?.endDate) params.set('endDate', filters.endDate)

  const response = await api.get(`/api/v1/dashboard/organizations/${orgId}/activity-log?${params.toString()}`)
  return response.data.data
}

export async function getOrgActivityLogActions(orgId: string): Promise<string[]> {
  const response = await api.get(`/api/v1/dashboard/organizations/${orgId}/activity-log/actions`)
  return response.data.data
}
