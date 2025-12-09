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
