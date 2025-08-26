import api from '@/api'
import type { PlatformFeature as SAPlatformFeature, SuperadminVenue as SASuperadminVenue, SuperadminDashboardData as SASuperadminDashboardData } from '@/types/superadmin'

// ===== TYPES =====

export interface RevenueMetrics {
  totalRevenue: number
  commissionRevenue: number
  subscriptionRevenue: number
  featureRevenue: number
  growthRate: number
  transactionCount: number
  averageOrderValue: number
}

export interface RevenueBreakdown {
  byVenue: VenueRevenue[]
  byPeriod: PeriodRevenue[]
  byFeature: FeatureRevenue[]
  commissionAnalysis: CommissionAnalysis
}

export interface VenueRevenue {
  venueId: string
  venueName: string
  revenue: number
  commission: number
  transactionCount: number
  averageOrderValue: number
  growth: number
}

export interface PeriodRevenue {
  period: string
  revenue: number
  commission: number
  transactionCount: number
  date: string
}

export interface FeatureRevenue {
  featureCode: string
  featureName: string
  activeVenues: number
  monthlyRevenue: number
  totalRevenue: number
}

export interface CommissionAnalysis {
  totalCommission: number
  averageCommissionRate: number
  commissionByVenue: { venueId: string; venueName: string; commission: number }[]
  projectedMonthlyCommission: number
}

export interface SuperadminDashboardData {
  kpis: {
    totalRevenue: number
    monthlyRecurringRevenue: number
    totalVenues: number
    activeVenues: number
    totalUsers: number
    averageRevenuePerUser: number
    churnRate: number
    growthRate: number
    systemUptime: number
    // Platform earnings
    totalCommissionRevenue: number
    subscriptionRevenue: number
    featureRevenue: number
  }
  revenueMetrics: {
    totalPlatformRevenue: number // Total money Avoqado actually earns
    totalCommissionRevenue: number // Fees from transactions
    subscriptionRevenue: number // Monthly subscription fees from venues
    featureRevenue: number // Premium feature fees
    invoicedRevenue: number // Formally billed revenue
    settledRevenue: number // Actually received revenue
    transactionCount: number
    newVenues: number
    churnedVenues: number
  }
  recentActivity: Activity[]
  alerts: SystemAlert[]
  topVenues: TopVenue[]
}

export interface Activity {
  id: string
  type: string
  description: string
  venueName?: string
  timestamp: string
}

export interface TopVenue {
  name: string
  revenue: number
  commission: number
  growth: number
}

export interface SystemAlert {
  id: string
  type: 'info' | 'warning' | 'error'
  title: string
  message: string
  isRead: boolean
}

export interface SuperadminVenue {
  id: string
  name: string
  email: string
  address: string
  phone: string
  slug: string
  active: boolean
  plan: string
  subscriptionStatus: string
  revenue: number
  commission: number
  transactionCount: number
  status: 'approved' | 'pending' | 'suspended'
  suspensionReason?: string
  recentPayment?: {
    amount: number
    paymentStatus: string
  }
  approvedAt?: string
  approvedBy?: string
  createdAt: string
  updatedAt: string
}

export interface Feature {
  id: string
  name: string
  code: string
  description: string
  category: string
  pricingModel: string
  basePrice?: number
  usagePrice?: number
  usageUnit?: string
  monthlyPrice?: number
  isCore: boolean
  active: boolean
  createdAt: string
}

// ===== API FUNCTIONS =====

/**
 * Get superadmin dashboard data
 */
export async function getDashboardData(): Promise<SuperadminDashboardData> {
  const response = await api.get('/api/v1/dashboard/superadmin/dashboard')
  return response.data.data
}

/**
 * Get all venues for superadmin management
 */
export async function getAllVenues(): Promise<SuperadminVenue[]> {
  const response = await api.get('/api/v1/dashboard/superadmin/venues')
  return response.data.data
}

/**
 * Get venue details by ID
 */
export async function getVenueDetails(venueId: string): Promise<SuperadminVenue> {
  const response = await api.get(`/api/v1/dashboard/superadmin/venues/${venueId}`)
  return response.data.data
}

/**
 * Approve a venue
 */
export async function approveVenue(venueId: string, reason?: string): Promise<void> {
  await api.post(`/api/v1/dashboard/superadmin/venues/${venueId}/approve`, { reason })
}

/**
 * Suspend a venue
 */
export async function suspendVenue(venueId: string, reason: string): Promise<void> {
  await api.post(`/api/v1/dashboard/superadmin/venues/${venueId}/suspend`, { reason })
}

/**
 * Get all features
 */
export async function getAllFeatures(): Promise<Feature[]> {
  const response = await api.get('/api/v1/dashboard/superadmin/features')
  return response.data.data
}

/**
 * Create a new feature
 */
export async function createFeature(featureData: {
  name: string
  code: string
  description: string
  category: string
  pricingModel: string
  basePrice?: number
  usagePrice?: number
  usageUnit?: string
  isCore?: boolean
}): Promise<Feature> {
  const response = await api.post('/api/v1/dashboard/superadmin/features', featureData)
  return response.data.data
}

/**
 * Enable a feature for a venue
 */
export async function enableFeatureForVenue(venueId: string, featureCode: string): Promise<void> {
  await api.post(`/api/v1/dashboard/superadmin/venues/${venueId}/features/${featureCode}/enable`)
}

/**
 * Disable a feature for a venue
 */
export async function disableFeatureForVenue(venueId: string, featureCode: string): Promise<void> {
  await api.delete(`/api/v1/dashboard/superadmin/venues/${venueId}/features/${featureCode}/disable`)
}

/**
 * Get revenue metrics
 */
export async function getRevenueMetrics(params?: {
  startDate?: string
  endDate?: string
}): Promise<RevenueMetrics> {
  const response = await api.get('/api/v1/dashboard/superadmin/revenue/metrics', { params })
  return response.data.data
}

/**
 * Get revenue breakdown
 */
export async function getRevenueBreakdown(params?: {
  startDate?: string
  endDate?: string
}): Promise<RevenueBreakdown> {
  const response = await api.get('/api/v1/dashboard/superadmin/revenue/breakdown', { params })
  return response.data.data
}

// Convenience API object (canonical import target for components expecting superadminAPI)
export const superadminAPI = {
  getDashboardData: async (): Promise<SASuperadminDashboardData> => {
    return (await getDashboardData()) as unknown as SASuperadminDashboardData
  },
  getAllVenues: async (): Promise<SASuperadminVenue[]> => {
    return (await getAllVenues()) as unknown as SASuperadminVenue[]
  },
  getVenueDetails: async (venueId: string): Promise<SASuperadminVenue> => {
    return (await getVenueDetails(venueId)) as unknown as SASuperadminVenue
  },
  approveVenue: async (venueId: string, reason?: string): Promise<void> => {
    await approveVenue(venueId, reason)
  },
  suspendVenue: async (venueId: string, reason: string): Promise<void> => {
    await suspendVenue(venueId, reason)
  },
  getAllFeatures: async (): Promise<SAPlatformFeature[]> => {
    return (await getAllFeatures()) as unknown as SAPlatformFeature[]
  },
  createFeature: async (featureData: {
    name: string
    code: string
    description: string
    category: string
    pricingModel: string
    basePrice?: number
    usagePrice?: number
    usageUnit?: string
    isCore?: boolean
  }): Promise<SAPlatformFeature> => {
    return (await createFeature(featureData)) as unknown as SAPlatformFeature
  },
  enableFeatureForVenue: async (venueId: string, featureCode: string): Promise<void> => {
    await enableFeatureForVenue(venueId, featureCode)
  },
  disableFeatureForVenue: async (venueId: string, featureCode: string): Promise<void> => {
    await disableFeatureForVenue(venueId, featureCode)
  },
}
