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
