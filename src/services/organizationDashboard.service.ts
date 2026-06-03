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

/**
 * In-flight venue migration carried by each terminal in the org list response.
 * Non-null while a FACTORY RESET command is in flight and the device hasn't
 * reappeared under the new venue yet — lets the row show a "Migrando…" badge
 * and resume the wizard.
 *
 * The backend's org `getOrgTerminals` service populates this via the same
 * `computeTerminalMigration` helper as the superadmin terminals list. The field
 * stays optional so the badge / resume logic degrades gracefully if absent.
 */
export interface OrgTerminalMigrationInfo {
  inProgress: boolean
  commandId: string
  fromVenueId: string
  toVenueId: string
}

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
  /** In-flight venue migration, or null/undefined when none is pending. */
  migration?: OrgTerminalMigrationInfo | null
}

export interface OrgTerminalsSummary {
  total: number
  online: number
  offline: number
  byStatus: Record<string, number>
  byType: Record<string, number>
  /** Highest app version present across the org's terminal fleet. */
  latestVersion: string | null
}

export type OrgTerminalVersionStatus = 'upToDate' | 'outdated' | 'unknown'

export interface OrgTerminalsResponse {
  terminals: OrgTerminal[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
  summary: OrgTerminalsSummary
}

export type OrgTerminalSortBy =
  | 'name'
  | 'lastHeartbeat'
  | 'status'
  | 'type'
  | 'brand'
  | 'createdAt'
  | 'latestHealthScore'
  | 'venue.name'

export interface OrgTerminalsFilters {
  page?: number
  pageSize?: number
  venueIds?: string[]
  statuses?: string[]
  types?: string[]
  versionStatuses?: OrgTerminalVersionStatus[]
  search?: string
  sortBy?: OrgTerminalSortBy
  sortOrder?: 'asc' | 'desc'
}

export function isTerminalOnline(lastHeartbeat?: string | null, thresholdMinutes = 5): boolean {
  if (!lastHeartbeat) return false
  const diffMs = Date.now() - new Date(lastHeartbeat).getTime()
  return diffMs / (1000 * 60) < thresholdMinutes
}

function arrayToCsv(values?: string[]): string | undefined {
  if (!values || values.length === 0) return undefined
  return values.join(',')
}

export async function getOrgTerminals(orgId: string, filters?: OrgTerminalsFilters): Promise<OrgTerminalsResponse> {
  const params: Record<string, string | number> = {}
  if (filters?.page) params.page = filters.page
  if (filters?.pageSize) params.pageSize = filters.pageSize
  if (filters?.search) params.search = filters.search
  const venueCsv = arrayToCsv(filters?.venueIds)
  if (venueCsv) params.venueId = venueCsv
  const statusCsv = arrayToCsv(filters?.statuses)
  if (statusCsv) params.status = statusCsv
  const typeCsv = arrayToCsv(filters?.types)
  if (typeCsv) params.type = typeCsv
  const versionCsv = arrayToCsv(filters?.versionStatuses)
  if (versionCsv) params.versionStatus = versionCsv
  if (filters?.sortBy) params.sortBy = filters.sortBy
  if (filters?.sortOrder) params.sortOrder = filters.sortOrder

  const response = await api.get(`/api/v1/dashboard/organizations/${orgId}/terminals`, { params })
  return response.data.data
}

// ===========================================
// BULK COMMANDS
// ===========================================

export type OrgTerminalBulkCommand = 'RESTART' | 'SYNC_DATA' | 'REFRESH_MENU' | 'FORCE_UPDATE' | 'LOCK' | 'UNLOCK'

export const ORG_TERMINAL_BULK_COMMANDS: OrgTerminalBulkCommand[] = [
  'RESTART',
  'SYNC_DATA',
  'REFRESH_MENU',
  'FORCE_UPDATE',
  'LOCK',
  'UNLOCK',
]

export const ORG_TERMINAL_BULK_COMMAND_MAX = 100

export interface OrgBulkCommandRowResult {
  terminalId: string
  success: boolean
  error?: string
}

export interface OrgBulkCommandResponse {
  command: OrgTerminalBulkCommand
  total: number
  succeeded: number
  failed: number
  results: OrgBulkCommandRowResult[]
}

export async function bulkCommandOrgTerminals(
  orgId: string,
  terminalIds: string[],
  command: OrgTerminalBulkCommand,
): Promise<OrgBulkCommandResponse> {
  const response = await api.post(
    `/api/v1/dashboard/organizations/${orgId}/terminals/bulk-command`,
    { terminalIds, command },
    // Accept 207 Multi-Status as a non-error response
    { validateStatus: status => status === 200 || status === 207 },
  )
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
  | 'REMOTE_ACTIVATE'
  | 'FACTORY_RESET'
  | 'SYNC_DATA'
  | 'REFRESH_MENU'
  | 'FORCE_UPDATE'
  | 'REQUEST_UPDATE'
  | 'UPDATE_CONFIG'
  | 'UPDATE_MERCHANT'

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
  /** Target app version (AppUpdate.versionCode) — only meaningful for REQUEST_UPDATE. */
  versionCode?: number,
): Promise<OrgCommandResult> {
  const response = await api.post(`/api/v1/dashboard/organizations/${orgId}/terminals/${terminalId}/command`, {
    command,
    ...(typeof versionCode === 'number' ? { versionCode } : {}),
  })
  return response.data.data
}

export type OrgAppEnvironment = 'SANDBOX' | 'PRODUCTION'

export interface OrgAppVersion {
  versionName: string
  versionCode: number
  environment: OrgAppEnvironment
  releaseNotes: string | null
  isLatest: boolean
  createdAt: string
}

/**
 * List TPV app versions available to push to a terminal, newest first.
 * `environment` should match the terminal's build (inferred from its version
 * string suffix — "-sandbox" → SANDBOX, else PRODUCTION).
 */
export async function getOrgAppVersions(orgId: string, environment: OrgAppEnvironment): Promise<OrgAppVersion[]> {
  const response = await api.get(`/api/v1/dashboard/organizations/${orgId}/terminals/app-versions`, {
    params: { environment },
  })
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

// ===========================================
// TERMINAL MIGRATION (Org-Scoped, OWNER-gated)
// ===========================================
//
// Mirror of the superadmin terminal-migration flow, but org-scoped. The backend
// enforces that the OWNER owns the org and that BOTH the terminal and the
// destination venue belong to that org — the UI mirrors this by only letting the
// operator pick destination venues WITHIN the org.

export interface OrgMigrationPreflight {
  canProceed: boolean
  fromVenueId: string
  toVenueId: string
  blockers: Array<{ code: string; message: string }>
  warnings: Array<{ code: string; message: string }>
}

export interface OrgMigrateExecuteResult {
  commandId: string
  fromVenueId: string
  toVenueId: string
  startedAt: string
}

export interface OrgMigrateStatus {
  commandStatus: string
  commandDelivered: boolean
  reboundAfterWipe: boolean
  currentlyOnline: boolean
  onlineUnderNewVenue: boolean
  confirmed: boolean
  elapsedMs: number
}

/**
 * Run pre-migration checks before moving a terminal to another venue in the org.
 */
export async function migratePreflightForOrg(
  orgId: string,
  terminalId: string,
  toVenueId: string,
): Promise<OrgMigrationPreflight> {
  const response = await api.post(
    `/api/v1/dashboard/organizations/${orgId}/terminals/${terminalId}/migrate-preflight`,
    { toVenueId },
  )
  return response.data.data
}

/**
 * Execute the terminal venue migration (re-parent + FACTORY RESET).
 *
 * @param assignedMerchantIds Optional merchant account ids to assign on the
 *   destination venue. Omit (or pass empty) to let the backend use the
 *   destination venue's default merchant.
 */
export async function migrateExecuteForOrg(
  orgId: string,
  terminalId: string,
  toVenueId: string,
  assignedMerchantIds?: string[],
): Promise<OrgMigrateExecuteResult> {
  const response = await api.post(
    `/api/v1/dashboard/organizations/${orgId}/terminals/${terminalId}/migrate-execute`,
    {
      toVenueId,
      ...(assignedMerchantIds?.length ? { assignedMerchantIds } : {}),
    },
  )
  return response.data.data
}

/**
 * Poll the status of an in-progress terminal migration.
 */
export async function migrateStatusForOrg(
  orgId: string,
  terminalId: string,
  commandId: string,
): Promise<OrgMigrateStatus> {
  const response = await api.get(
    `/api/v1/dashboard/organizations/${orgId}/terminals/${terminalId}/migrate-status`,
    { params: { commandId } },
  )
  return response.data.data
}

/**
 * Cancel an in-progress terminal migration.
 *
 * Only succeeds while the device hasn't received the wipe yet. Once the TPV has
 * pulled the FACTORY RESET, the backend returns an error with a message —
 * surface it as a toast.
 */
export async function migrateCancelForOrg(
  orgId: string,
  terminalId: string,
): Promise<{ cancelled: boolean; restoredVenueId: string }> {
  const response = await api.post(
    `/api/v1/dashboard/organizations/${orgId}/terminals/${terminalId}/migrate-cancel`,
  )
  return response.data.data
}

// ===========================================
// VENUE STAFF ACCESS (Org-Scoped, OWNER-gated)
// ===========================================
//
// "Staff carry-over": when a terminal moves from venue A to venue B, the people
// who logged in (per-venue PIN) at A lose access at B. These endpoints let the
// OWNER grant the right people access (role + PIN) at the destination venue —
// both as a step inside the migration wizard (before the terminal moves, so the
// destination's NO_STAFF_PIN blocker passes) and as a standalone action.

/** Assignable staff role on a venue. Excludes SUPERADMIN/OWNER (not offered as grants). */
export type OrgAssignableStaffRole =
  | 'ADMIN'
  | 'MANAGER'
  | 'CASHIER'
  | 'WAITER'
  | 'KITCHEN'
  | 'HOST'
  | 'VIEWER'

/** Any staff role the backend may report (for current-role pre-selection). */
export type OrgStaffRole = OrgAssignableStaffRole | 'OWNER' | 'SUPERADMIN'

export interface OrgVenueAccessCandidate {
  staffId: string
  name: string
  email: string
  /** Was at the venue the terminal is moving FROM. */
  inSourceVenue: boolean
  /** Role at the source venue — pre-select this when granting. */
  currentRoleAtSource: OrgStaffRole | null
  alreadyAtDestination: boolean
  currentRoleAtDestination: OrgStaffRole | null
  /** Backend-suggested PIN — pre-fill this. */
  suggestedPin: string | null
  rolesHeld: OrgStaffRole[]
}

export interface OrgVenueAccessGrant {
  staffId: string
  role: OrgAssignableStaffRole
  /** 4-6 digits. Omit to let the backend keep / generate one. */
  pin?: string
}

export interface OrgVenueAccessGrantResult {
  staffId: string
  name: string
  role: OrgStaffRole
  pin: string | null
  created: boolean
}

/**
 * List the people the OWNER can grant access to at the destination venue.
 * Pass `sourceVenueId` (the terminal's current venue) so the backend can flag
 * who was using the terminal there and pre-select their role + suggest a PIN.
 */
export async function fetchOrgVenueAccessCandidates(
  orgId: string,
  venueId: string,
  sourceVenueId?: string,
): Promise<OrgVenueAccessCandidate[]> {
  const response = await api.get(
    `/api/v1/dashboard/organizations/${orgId}/venues/${venueId}/staff-access/candidates`,
    { params: sourceVenueId ? { sourceVenueId } : undefined },
  )
  return response.data.data
}

/**
 * Grant venue access (role + PIN) to one or more people at the destination venue.
 * Backend returns Spanish error messages (e.g. duplicate PIN) — surface verbatim.
 */
export async function grantOrgVenueAccess(
  orgId: string,
  venueId: string,
  grants: OrgVenueAccessGrant[],
): Promise<OrgVenueAccessGrantResult[]> {
  const response = await api.post(
    `/api/v1/dashboard/organizations/${orgId}/venues/${venueId}/staff-access`,
    { grants },
  )
  return response.data.data
}
