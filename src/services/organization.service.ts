import api from '@/api'
import { VenueStatus } from '@/types'

// Types matching backend response

export interface VenueMetrics {
  id: string
  name: string
  slug: string
  logo: string | null
  city: string | null
  status: VenueStatus
  revenue: number
  orderCount: number
  paymentCount: number
  staffCount: number
}

export interface OrganizationOverview {
  id: string
  name: string
  email: string
  phone: string
  totalRevenue: number
  totalOrders: number
  totalPayments: number
  totalStaff: number
  venueCount: number
  venues: VenueMetrics[]
  period: {
    from: string
    to: string
  }
}

export interface OrganizationVenue {
  id: string
  name: string
  slug: string
  logo: string | null
  address: string | null
  city: string | null
  state: string | null
  status: VenueStatus
  createdAt: string
  metrics: {
    revenue: number
    orderCount: number
    paymentCount: number
    staffCount: number
    growth: number
  }
}

export interface OrganizationTeamMember {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  venues: Array<{
    venueId: string
    venueName: string
    venueSlug: string
    role: string
  }>
  createdAt: string
}

export interface OrganizationStats {
  id: string
  name: string
  venueCount: number
  staffCount: number
}

export interface OrganizationInfo {
  id: string
  name: string
  email: string
  phone: string
  taxId: string | null
  type: string
  billingEmail: string | null
  billingAddress: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export type TimeRange = '7d' | '30d' | '90d' | 'ytd' | 'all'

export interface DateRangeFilter {
  timeRange?: TimeRange
  from?: string
  to?: string
}

// Enhanced Overview Types
export interface TopVenue {
  id: string
  name: string
  slug: string
  logo: string | null
  revenue: number
  rank: number
  trend: 'up' | 'down' | 'stable'
}

export interface PeriodComparison {
  totalRevenue: number
  totalOrders: number
  totalPayments: number
  averageTicketSize: number
}

export interface PercentageChanges {
  revenueChange: number
  ordersChange: number
  paymentsChange: number
  ticketSizeChange: number
}

export interface EnhancedOrganizationOverview extends OrganizationOverview {
  averageTicketSize: number
  previousPeriod: PeriodComparison
  changes: PercentageChanges
  topVenues: TopVenue[]
}

// Revenue Trends Types
export interface TrendDataPoint {
  date: string
  revenue: number
  orders: number
}

export interface RevenueTrendsResponse {
  currentPeriod: {
    from: string
    to: string
    dataPoints: TrendDataPoint[]
    totals: {
      revenue: number
      orders: number
    }
  }
  previousPeriod: {
    from: string
    to: string
    dataPoints: TrendDataPoint[]
    totals: {
      revenue: number
      orders: number
    }
  }
  comparison: {
    revenueChange: number
    ordersChange: number
  }
}

// Top Items Types
export interface TopItem {
  productId: string
  productName: string
  categoryName: string
  quantitySold: number
  totalRevenue: number
  averagePrice: number
  rank: number
}

// Venue Benchmarks Types
export interface VenueBenchmark {
  id: string
  name: string
  slug: string
  logo: string | null
  metrics: {
    revenue: number
    orders: number
    averageTicketSize: number
    payments: number
  }
  benchmarks: {
    revenueVsAverage: number
    ordersVsAverage: number
    ticketSizeVsAverage: number
  }
  rank: {
    byRevenue: number
    byOrders: number
    byTicketSize: number
  }
}

export interface VenueBenchmarksResponse {
  averages: {
    revenue: number
    orders: number
    averageTicketSize: number
    payments: number
  }
  venues: VenueBenchmark[]
}

/**
 * Get organization basic info
 */
export async function getOrganization(orgId: string): Promise<OrganizationInfo> {
  const response = await api.get(`/api/v1/organizations/${orgId}`)
  return response.data
}

/**
 * Get organization overview with aggregated metrics from all venues
 */
export async function getOrganizationOverview(
  orgId: string,
  filter?: DateRangeFilter
): Promise<OrganizationOverview> {
  const params = new URLSearchParams()
  if (filter?.timeRange) params.append('timeRange', filter.timeRange)
  if (filter?.from) params.append('from', filter.from)
  if (filter?.to) params.append('to', filter.to)

  const queryString = params.toString()
  const url = `/api/v1/organizations/${orgId}/overview${queryString ? `?${queryString}` : ''}`

  const response = await api.get(url)
  return response.data
}

/**
 * Get all venues with detailed metrics
 */
export async function getOrganizationVenues(
  orgId: string,
  filter?: DateRangeFilter
): Promise<OrganizationVenue[]> {
  const params = new URLSearchParams()
  if (filter?.timeRange) params.append('timeRange', filter.timeRange)
  if (filter?.from) params.append('from', filter.from)
  if (filter?.to) params.append('to', filter.to)

  const queryString = params.toString()
  const url = `/api/v1/organizations/${orgId}/venues${queryString ? `?${queryString}` : ''}`

  const response = await api.get(url)
  return response.data
}

/**
 * Get all team members across all venues
 */
export async function getOrganizationTeam(orgId: string): Promise<OrganizationTeamMember[]> {
  const response = await api.get(`/api/v1/organizations/${orgId}/team`)
  return response.data
}

/**
 * Get lightweight organization stats (for header/nav)
 */
export async function getOrganizationStats(orgId: string): Promise<OrganizationStats> {
  const response = await api.get(`/api/v1/organizations/${orgId}/stats`)
  return response.data
}

/**
 * Update organization details
 */
export async function updateOrganization(
  orgId: string,
  data: {
    name?: string
    email?: string
    phone?: string
    taxId?: string | null
    billingEmail?: string | null
    billingAddress?: Record<string, unknown> | null
  }
): Promise<OrganizationInfo> {
  const response = await api.put(`/api/v1/organizations/${orgId}`, data)
  return response.data
}

// =============================================================================
// Analytics Endpoints
// =============================================================================

/**
 * Get enhanced organization overview with comparisons and rankings
 */
export async function getEnhancedOverview(
  orgId: string,
  filter?: DateRangeFilter
): Promise<EnhancedOrganizationOverview> {
  const params = new URLSearchParams()
  if (filter?.timeRange) params.append('timeRange', filter.timeRange)
  if (filter?.from) params.append('from', filter.from)
  if (filter?.to) params.append('to', filter.to)

  const queryString = params.toString()
  const url = `/api/v1/organizations/${orgId}/analytics/enhanced-overview${queryString ? `?${queryString}` : ''}`

  const response = await api.get(url)
  return response.data
}

/**
 * Get revenue trends with time series data
 */
export async function getRevenueTrends(
  orgId: string,
  filter?: DateRangeFilter
): Promise<RevenueTrendsResponse> {
  const params = new URLSearchParams()
  if (filter?.timeRange) params.append('timeRange', filter.timeRange)
  if (filter?.from) params.append('from', filter.from)
  if (filter?.to) params.append('to', filter.to)

  const queryString = params.toString()
  const url = `/api/v1/organizations/${orgId}/analytics/revenue-trends${queryString ? `?${queryString}` : ''}`

  const response = await api.get(url)
  return response.data
}

/**
 * Get top selling items across organization
 */
export async function getTopItems(
  orgId: string,
  filter?: DateRangeFilter,
  limit: number = 10
): Promise<TopItem[]> {
  const params = new URLSearchParams()
  if (filter?.timeRange) params.append('timeRange', filter.timeRange)
  if (filter?.from) params.append('from', filter.from)
  if (filter?.to) params.append('to', filter.to)
  params.append('limit', limit.toString())

  const queryString = params.toString()
  const url = `/api/v1/organizations/${orgId}/analytics/top-items${queryString ? `?${queryString}` : ''}`

  const response = await api.get(url)
  return response.data
}

/**
 * Get venue benchmarks comparing against organization averages
 */
export async function getVenueBenchmarks(
  orgId: string,
  filter?: DateRangeFilter
): Promise<VenueBenchmarksResponse> {
  const params = new URLSearchParams()
  if (filter?.timeRange) params.append('timeRange', filter.timeRange)
  if (filter?.from) params.append('from', filter.from)
  if (filter?.to) params.append('to', filter.to)

  const queryString = params.toString()
  const url = `/api/v1/organizations/${orgId}/analytics/venue-benchmarks${queryString ? `?${queryString}` : ''}`

  const response = await api.get(url)
  return response.data
}

// =============================================================================
// Organization Dashboard (PlayTelecom) Endpoints
// =============================================================================

export interface OnlineStaffMember {
  staffId: string
  staffName: string
  venueId: string
  venueName: string
  clockInTime: string
  role: string
}

export interface OnlineStaffResponse {
  onlineCount: number
  totalCount: number
  percentageOnline: number
  byVenue: Array<{
    venueId: string
    venueName: string
    onlineCount: number
    totalCount: number
  }>
  onlineStaff: OnlineStaffMember[]
}

/**
 * Get online staff count and details (staff with active TimeEntry)
 */
export async function getOnlineStaff(orgId: string): Promise<OnlineStaffResponse> {
  const response = await api.get(`/api/v1/dashboard/organizations/${orgId}/staff/online`)
  return response.data.data
}

export type ActivityType = 'sale' | 'checkin' | 'checkout' | 'gps_error' | 'alert' | 'other'
export type ActivitySeverity = 'normal' | 'warning' | 'error'

export interface ActivityEvent {
  id: string
  type: ActivityType
  title: string
  subtitle: string
  timestamp: string
  severity: ActivitySeverity
  venueId: string
  venueName: string
  staffId?: string
  staffName?: string
  metadata?: Record<string, any>
}

export interface ActivityFeedResponse {
  events: ActivityEvent[]
  total: number
}

/**
 * Get organization-wide activity feed (sales, check-ins, alerts)
 */
export async function getActivityFeed(orgId: string, limit: number = 50): Promise<ActivityFeedResponse> {
  const response = await api.get(`/api/v1/dashboard/organizations/${orgId}/activity-feed`, {
    params: { limit },
  })
  return response.data.data
}

export interface StockStoreBreakdown {
  storeId: string
  storeName: string
  available: number
  value: number
  alertLevel: 'OK' | 'WARNING' | 'CRITICAL'
}

export interface StockSummaryResponse {
  totalPieces: number
  totalValue: number
  lowStockAlerts: number
  criticalAlerts: number
  storeBreakdown: StockStoreBreakdown[]
}

/**
 * Get organization-wide stock summary
 */
export async function getStockSummary(orgId: string): Promise<StockSummaryResponse> {
  const response = await api.get(`/api/v1/dashboard/organizations/${orgId}/stock-summary`)
  return response.data.data
}

export type AnomalyType = 'LOW_PERFORMANCE' | 'NO_CHECKINS' | 'LOW_STOCK' | 'PENDING_DEPOSITS'
export type AnomalySeverity = 'CRITICAL' | 'WARNING' | 'INFO'

export interface Anomaly {
  id: string
  type: AnomalyType
  severity: AnomalySeverity
  storeId: string
  storeName: string
  title: string
  description: string
}

export interface AnomaliesResponse {
  anomalies: Anomaly[]
}

/**
 * Get cross-store operational anomalies
 */
export async function getAnomalies(orgId: string): Promise<AnomaliesResponse> {
  const response = await api.get(`/api/v1/dashboard/organizations/${orgId}/anomalies`)
  return response.data.data
}

/**
 * Chart data types
 */
export interface DayMetric {
  day: string // e.g., "Lun", "Mar", "Mié"
  date: string // ISO date
  actual: number
  target: number
}

export interface RevenueVsTargetResponse {
  days: DayMetric[]
  weekTotal: {
    actual: number
    target: number
  }
}

export interface VolumeVsTargetResponse {
  days: DayMetric[]
  weekTotal: {
    actual: number
    target: number
  }
}

/**
 * Get revenue vs target chart data for current week
 */
export async function getRevenueVsTarget(orgId: string, venueId?: string): Promise<RevenueVsTargetResponse> {
  const response = await api.get(
    `/api/v1/dashboard/organizations/${orgId}/charts/revenue-vs-target`,
    venueId ? { params: { venueId } } : undefined,
  )
  return response.data.data
}

/**
 * Get volume vs target chart data for current week
 */
export async function getVolumeVsTarget(orgId: string, venueId?: string): Promise<VolumeVsTargetResponse> {
  const response = await api.get(
    `/api/v1/dashboard/organizations/${orgId}/charts/volume-vs-target`,
    venueId ? { params: { venueId } } : undefined,
  )
  return response.data.data
}

/**
 * Insights types
 */
export interface TopPromoterResponse {
  staffId: string
  staffName: string
  venueId: string
  venueName: string
  salesCount: number
}

export interface WorstAttendanceResponse {
  venueId: string
  venueName: string
  totalStaff: number
  activeStaff: number
  absences: number
  attendanceRate: number
}

/**
 * Get top promoter by sales count today
 */
export async function getTopPromoter(orgId: string): Promise<TopPromoterResponse | null> {
  const response = await api.get(`/api/v1/dashboard/organizations/${orgId}/insights/top-promoter`)
  return response.data.data
}

/**
 * Get worst attendance (store with lowest percentage of active staff)
 */
export async function getWorstAttendance(orgId: string): Promise<WorstAttendanceResponse | null> {
  const response = await api.get(`/api/v1/dashboard/organizations/${orgId}/insights/worst-attendance`)
  return response.data.data
}
