import api from '@/api'
import type {
  PlatformFeature as SAPlatformFeature,
  SuperadminVenue as SASuperadminVenue,
  SuperadminDashboardData as SASuperadminDashboardData,
} from '@/types/superadmin'

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

// VenueStatus enum values from backend
export type VenueStatus =
  | 'ACTIVE'
  | 'ONBOARDING'
  | 'TRIAL'
  | 'PENDING_ACTIVATION'
  | 'SUSPENDED'
  | 'ADMIN_SUSPENDED'
  | 'CLOSED'
  | 'LIVE_DEMO'

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
  status: VenueStatus
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
 * @param includeDemos - Include TRIAL and LIVE_DEMO venues (default: false)
 */
export async function getAllVenues(includeDemos = false): Promise<SuperadminVenue[]> {
  const response = await api.get('/api/v1/dashboard/superadmin/venues', {
    params: includeDemos ? { includeDemos: 'true' } : undefined,
  })
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
 * Grant a DB-only trial for a venue (no Stripe subscription)
 * The trial will automatically expire after the specified number of days
 */
export async function grantTrialForVenue(
  venueId: string,
  featureCode: string,
  trialDays: number
): Promise<{ endDate: string }> {
  const response = await api.post(
    `/api/v1/dashboard/superadmin/venues/${venueId}/features/${featureCode}/grant-trial`,
    { trialDays }
  )
  return response.data.data
}

/**
 * Get revenue metrics
 */
export async function getRevenueMetrics(params?: { startDate?: string; endDate?: string }): Promise<RevenueMetrics> {
  const response = await api.get('/api/v1/dashboard/superadmin/revenue/metrics', { params })
  return response.data.data
}

/**
 * Get revenue breakdown
 */
export async function getRevenueBreakdown(params?: { startDate?: string; endDate?: string }): Promise<RevenueBreakdown> {
  const response = await api.get('/api/v1/dashboard/superadmin/revenue/breakdown', { params })
  return response.data.data
}

/**
 * Get KYC review data for a venue
 */
export async function getKYCReview(venueId: string): Promise<any> {
  const response = await api.get(`/api/v1/superadmin/kyc/${venueId}`)
  return response.data.data
}

/**
 * Approve KYC for a venue
 */
export async function approveKYC(venueId: string): Promise<void> {
  await api.post(`/api/v1/superadmin/kyc/${venueId}/approve`)
}

/**
 * Reject KYC for a venue
 */
export async function rejectKYC(venueId: string, reason: string, rejectedDocuments?: string[]): Promise<void> {
  await api.post(`/api/v1/superadmin/kyc/${venueId}/reject`, {
    rejectionReason: reason,
    rejectedDocuments: rejectedDocuments
  })
}

// ===== CREDIT ASSESSMENT TYPES =====

export type CreditGrade = 'A' | 'B' | 'C' | 'D'
export type CreditEligibility = 'ELIGIBLE' | 'REVIEW_REQUIRED' | 'INELIGIBLE' | 'OFFER_PENDING' | 'ACTIVE_LOAN'
export type TrendDirection = 'GROWING' | 'FLAT' | 'DECLINING'
export type CreditOfferStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'WITHDRAWN'

export interface CreditScoreBreakdown {
  volumeScore: number
  growthScore: number
  stabilityScore: number
  riskScore: number
  totalScore: number
}

export interface VenueMetrics {
  annualVolume: number
  monthlyAverage: number
  currentMonthVolume: number
  transactionCount12m: number
  yoyGrowthPercent: number
  momGrowthPercent: number
  trendDirection: TrendDirection
  revenueVariance: number
  consistencyScore: number
  daysSinceLastTx: number
  operatingDaysRatio: number
  averageTicket: number
  chargebackRate: number
  refundRate: number
  chargebackCount: number
  paymentMethodMix: Record<string, number>
}

export interface CreditRecommendation {
  recommendedCreditLimit: number
  suggestedFactorRate: number
  maxRepaymentPercent: number
  estimatedTermDays: number
}

export interface CreditAssessment {
  id: string
  venueId: string
  creditScore: number
  creditGrade: CreditGrade
  eligibilityStatus: CreditEligibility
  annualVolume: number
  monthlyAverage: number
  currentMonthVolume: number
  transactionCount12m: number
  yoyGrowthPercent: number
  momGrowthPercent: number
  trendDirection: TrendDirection
  revenueVariance: number
  consistencyScore: number
  daysSinceLastTx: number
  operatingDaysRatio: number
  averageTicket: number
  chargebackRate: number
  refundRate: number
  chargebackCount: number
  paymentMethodMix: Record<string, number> | null
  recommendedCreditLimit: number
  suggestedFactorRate: number
  maxRepaymentPercent: number
  alerts: string[]
  calculatedAt: string
  dataAsOf: string
  venue: {
    id: string
    name: string
    slug: string
    status: string
    organization: {
      name: string
    }
  }
  offers: CreditOffer[]
}

export interface CreditOffer {
  id: string
  venueId: string
  offerAmount: number
  factorRate: number
  totalRepayment: number
  repaymentPercent: number
  estimatedTermDays: number
  status: CreditOfferStatus
  expiresAt: string
  acceptedAt: string | null
  rejectedAt: string | null
  rejectionReason: string | null
  notes: string | null
  createdAt: string
  createdBy?: { firstName: string; lastName: string }
  acceptedBy?: { firstName: string; lastName: string }
}

export interface CreditAssessmentSummary {
  totalAssessments: number
  gradeDistribution: Record<CreditGrade, number>
  eligibilityDistribution: Record<string, number>
  totalEligibleCredit: number
  pendingOffers: number
}

export interface CreditAssessmentListResponse {
  data: CreditAssessment[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

// ===== CREDIT ASSESSMENT API FUNCTIONS =====

export async function getCreditAssessments(params?: {
  page?: number
  pageSize?: number
  eligibility?: CreditEligibility[]
  grade?: CreditGrade[]
  minScore?: number
  maxScore?: number
  sortBy?: 'creditScore' | 'annualVolume' | 'calculatedAt'
  sortOrder?: 'asc' | 'desc'
}): Promise<CreditAssessmentListResponse> {
  const queryParams = new URLSearchParams()

  if (params?.page) queryParams.set('page', String(params.page))
  if (params?.pageSize) queryParams.set('pageSize', String(params.pageSize))
  if (params?.eligibility?.length) queryParams.set('eligibility', params.eligibility.join(','))
  if (params?.grade?.length) queryParams.set('grade', params.grade.join(','))
  if (params?.minScore !== undefined) queryParams.set('minScore', String(params.minScore))
  if (params?.maxScore !== undefined) queryParams.set('maxScore', String(params.maxScore))
  if (params?.sortBy) queryParams.set('sortBy', params.sortBy)
  if (params?.sortOrder) queryParams.set('sortOrder', params.sortOrder)

  const response = await api.get(`/api/v1/superadmin/credit/assessments?${queryParams.toString()}`)
  return response.data
}

export async function getCreditAssessmentSummary(): Promise<CreditAssessmentSummary> {
  const response = await api.get('/api/v1/superadmin/credit/summary')
  return response.data.data
}

export async function getVenueCreditAssessment(venueId: string): Promise<CreditAssessment> {
  const response = await api.get(`/api/v1/superadmin/credit/venues/${venueId}`)
  return response.data.data
}

export async function refreshVenueCreditAssessment(venueId: string): Promise<CreditAssessment> {
  const response = await api.post(`/api/v1/superadmin/credit/venues/${venueId}/refresh`)
  return response.data.data
}

export async function refreshAllCreditAssessments(): Promise<{ processed: number; errors: number; total: number }> {
  const response = await api.post('/api/v1/superadmin/credit/refresh-all')
  return response.data.data
}

export async function createCreditOffer(
  venueId: string,
  offerData: {
    offerAmount: number
    factorRate: number
    repaymentPercent: number
    expiresInDays?: number
    notes?: string
  }
): Promise<CreditOffer> {
  const response = await api.post(`/api/v1/superadmin/credit/venues/${venueId}/offers`, offerData)
  return response.data.data
}

export async function getVenueCreditOffers(venueId: string): Promise<CreditOffer[]> {
  const response = await api.get(`/api/v1/superadmin/credit/venues/${venueId}/offers`)
  return response.data.data
}

export async function acceptCreditOffer(offerId: string): Promise<CreditOffer> {
  const response = await api.patch(`/api/v1/superadmin/credit/offers/${offerId}/accept`)
  return response.data.data
}

export async function rejectCreditOffer(offerId: string, rejectionReason?: string): Promise<CreditOffer> {
  const response = await api.patch(`/api/v1/superadmin/credit/offers/${offerId}/reject`, { rejectionReason })
  return response.data.data
}

export async function withdrawCreditOffer(offerId: string): Promise<CreditOffer> {
  const response = await api.patch(`/api/v1/superadmin/credit/offers/${offerId}/withdraw`)
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
  grantTrialForVenue: async (venueId: string, featureCode: string, trialDays: number): Promise<{ endDate: string }> => {
    return await grantTrialForVenue(venueId, featureCode, trialDays)
  },
  getKYCReview: async (venueId: string): Promise<any> => {
    return await getKYCReview(venueId)
  },
  approveKYC: async (venueId: string): Promise<void> => {
    await approveKYC(venueId)
  },
  rejectKYC: async (venueId: string, reason: string, rejectedDocuments?: string[]): Promise<void> => {
    await rejectKYC(venueId, reason, rejectedDocuments)
  },
}
