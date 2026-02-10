/**
 * Command Center API Service
 * Provides dashboard KPIs, activity feed, and operational insights
 * for PlayTelecom/White-Label dashboard.
 */
import api from '@/api'

// ===========================================
// TYPES
// ===========================================

export interface CommandCenterSummary {
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
  topSellers: TopSeller[]
  categoryBreakdown: CategoryBreakdown[]
}

export interface TopSeller {
  id: string
  name: string
  photoUrl: string | null
  sales: number
  units: number
  rank: number
}

export interface CategoryBreakdown {
  id: string
  name: string
  units: number
  percentage: number
}

export interface ActivityItem {
  id: string
  type: 'SALE' | 'REGISTRATION' | 'CLOCK_IN' | 'CLOCK_OUT' | 'DEPOSIT' | 'ALERT'
  description: string
  timestamp: string
  promoterName: string | null
  promoterPhoto: string | null
  storeName: string | null
  amount: number | null
  metadata: Record<string, unknown>
}

export interface ActivityFeedResponse {
  activities: ActivityItem[]
  hasMore: boolean
}

export interface Anomaly {
  id: string
  type: 'LOW_PERFORMANCE' | 'NO_CHECKINS' | 'LOW_STOCK' | 'PENDING_DEPOSITS' | 'GPS_VIOLATION'
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
  title: string
  description: string
  timestamp: string
  storeName: string | null
  storeId: string | null
  actionRequired: boolean
  metadata: Record<string, unknown>
}

export interface AnomaliesResponse {
  anomalies: Anomaly[]
}

export interface SalesTrendPoint {
  date: string
  sales: number
  units: number
  transactions: number
}

export interface SalesTrendResponse {
  trend: SalesTrendPoint[]
  comparison: {
    salesChange: number
    unitsChange: number
    transactionsChange: number
  }
}

// ===========================================
// API FUNCTIONS
// ===========================================

/**
 * Get command center summary with KPIs
 */
export const getCommandCenterSummary = async (venueId: string): Promise<CommandCenterSummary> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/command-center/summary`)
  return response.data.data
}

/**
 * Get activity feed for the venue
 */
export const getActivityFeed = async (
  venueId: string,
  params?: { limit?: number; offset?: number }
): Promise<ActivityFeedResponse> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/command-center/activity`, { params })
  return response.data.data
}

/**
 * Get operational anomalies and alerts
 */
export const getAnomalies = async (venueId: string): Promise<AnomaliesResponse> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/command-center/insights`)
  return response.data.data
}

/**
 * Get sales trend for charts
 * @param days - Number of days to fetch (default: 7)
 * @param startDate - Start date in YYYY-MM-DD format (overrides days if provided with endDate)
 * @param endDate - End date in YYYY-MM-DD format (overrides days if provided with startDate)
 */
export const getSalesTrend = async (
  venueId: string,
  params?: { days?: number; startDate?: string; endDate?: string }
): Promise<SalesTrendResponse> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/command-center/stock-vs-sales`, { params })
  return response.data.data
}
