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
