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
 * Change venue status
 */
export async function changeVenueStatus(venueId: string, status: string, reason?: string): Promise<void> {
  await api.patch(`/api/v1/dashboard/superadmin/venues/${venueId}/status`, { status, reason })
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
export async function grantTrialForVenue(venueId: string, featureCode: string, trialDays: number): Promise<{ endDate: string }> {
  const response = await api.post(`/api/v1/dashboard/superadmin/venues/${venueId}/features/${featureCode}/grant-trial`, { trialDays })
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

// ===== MASTER TOTP SETUP =====

export interface MasterTotpSetup {
  uri: string
  issuer: string
  label: string
  digits: number
  period: number
  algorithm: string
}

/**
 * Get Master TOTP setup data for Google Authenticator QR code
 * Used by superadmins to configure emergency access to any TPV terminal
 */
export async function getMasterTotpSetup(): Promise<MasterTotpSetup> {
  const response = await api.get('/api/v1/dashboard/superadmin/master-totp/setup')
  return response.data.data
}

/**
 * Reject KYC for a venue
 */
export async function rejectKYC(venueId: string, reason: string, rejectedDocuments?: string[]): Promise<void> {
  await api.post(`/api/v1/superadmin/kyc/${venueId}/reject`, {
    rejectionReason: reason,
    rejectedDocuments: rejectedDocuments,
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
  },
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

// ===== SERVER METRICS TYPES =====

export interface MetricsSnapshot {
  timestamp: string
  uptime: number
  memory: {
    rss: number
    rssMb: number
    heapUsed: number
    heapTotal: number
    heapUsedMb: number
    external: number
    arrayBuffers: number
    rssPercent: number
    limitMb: number
  }
  cpu: {
    percent: number
    limitCores: number
  }
  eventLoop: {
    lagMs: number
    lagP99Ms: number
    lagMaxMs: number
  }
  connections: {
    active: number
  }
}

export interface ServerMetricsAlert {
  type: 'memory' | 'eventLoop' | 'cpu'
  severity: 'warning' | 'critical'
  message: string
  value: number
  threshold: number
  timestamp: string
}

export interface ServerMetricsResponse {
  current: MetricsSnapshot
  history: MetricsSnapshot[]
  alerts: ServerMetricsAlert[]
}

// ===== SERVER METRICS API FUNCTIONS =====

export async function getServerMetrics(): Promise<ServerMetricsResponse> {
  const response = await api.get('/api/v1/dashboard/superadmin/server-metrics')
  return response.data
}

// ===== VENUE MODULE MANAGEMENT TYPES =====

/**
 * Backend response type for module status
 */
interface ModuleFromBackend {
  id: string
  code: string
  name: string
  description: string | null
  defaultConfig: Record<string, any> | null
  presets: Record<string, any> | null
  enabled: boolean
  config: Record<string, any> | null
  enabledAt: string | null
}

/**
 * Frontend type for module display (with inheritance support)
 */
export interface ModuleForVenue {
  id: string
  code: string
  name: string
  description: string | null
  category: string
  isCore: boolean
  // Module status for this venue
  isEnabled: boolean
  isInherited: boolean // true if enabled at org level, inherited by venue
  inheritedFrom: 'organization' | 'venue' | null
  // Configuration
  config: Record<string, any> | null
  organizationConfig: Record<string, any> | null // Config at org level (if inherited)
  defaultConfig: Record<string, any> | null // Default config from Module definition
  // Venue-specific override (for display purposes)
  venueModule: {
    id: string
    isEnabled: boolean
    config: Record<string, any> | null
    enabledAt: string
  } | null
}

// ===== VENUE MODULE MANAGEMENT API FUNCTIONS =====

/**
 * Get all modules for a venue with their status (enabled/disabled, inherited)
 * Transforms backend response to frontend expected format
 */
export async function getModulesForVenue(venueId: string): Promise<ModuleForVenue[]> {
  const response = await api.get(`/api/v1/dashboard/superadmin/modules/venues/${venueId}`)
  const backendModules: ModuleFromBackend[] = response.data.modules

  // Transform backend response to frontend format
  // Note: Organization-level inheritance not yet implemented in backend
  // Once implemented, this transformation can be enhanced
  return backendModules.map(
    (module): ModuleForVenue => ({
      id: module.id,
      code: module.code,
      name: module.name,
      description: module.description,
      category: 'custom', // TODO: Add category to backend Module model
      isCore: false, // TODO: Add isCore to backend Module model
      isEnabled: module.enabled,
      isInherited: false, // TODO: Backend should return this based on OrganizationModule
      inheritedFrom: module.enabled ? 'venue' : null,
      config: module.config,
      organizationConfig: null, // TODO: Backend should return OrganizationModule.config
      defaultConfig: module.defaultConfig,
      venueModule: module.enabled
        ? {
            id: module.id, // VenueModule ID would be different, but we use module ID for now
            isEnabled: module.enabled,
            config: module.config,
            enabledAt: module.enabledAt || new Date().toISOString(),
          }
        : null,
    }),
  )
}

/**
 * Enable a module for a venue
 */
export async function enableModuleForVenue(venueId: string, moduleCode: string, preset?: string): Promise<void> {
  await api.post('/api/v1/dashboard/superadmin/modules/enable', {
    venueId,
    moduleCode,
    preset,
  })
}

/**
 * Disable a module for a venue
 */
export async function disableModuleForVenue(venueId: string, moduleCode: string): Promise<void> {
  await api.post('/api/v1/dashboard/superadmin/modules/disable', {
    venueId,
    moduleCode,
  })
}

/**
 * Update module config for a venue
 */
export async function updateVenueModuleConfig(venueId: string, moduleCode: string, config: Record<string, any>): Promise<void> {
  await api.patch('/api/v1/dashboard/superadmin/modules/config', {
    venueId,
    moduleCode,
    config,
  })
}

// ===== APP UPDATES TYPES =====

export type AppEnvironment = 'SANDBOX' | 'PRODUCTION'
export type UpdateMode = 'NONE' | 'BANNER' | 'FORCE'

export interface AppUpdate {
  id: string
  versionName: string
  versionCode: number
  environment: AppEnvironment
  releaseNotes: string | null
  updateMode: UpdateMode
  downloadUrl: string
  fileSize: string // BigInt as string
  checksum: string
  minAndroidSdk: number
  isActive: boolean
  uploadedById: string
  uploadedBy: {
    firstName: string
    lastName: string
    email: string
  }
  createdAt: string
  updatedAt: string
}

export interface AppUpdateCreateInput {
  versionName?: string // Optional - auto-detected from APK if not provided
  versionCode?: number // Optional - auto-detected from APK if not provided
  environment: AppEnvironment
  releaseNotes?: string
  updateMode?: UpdateMode // NONE=silent, BANNER=recommended, FORCE=blocking
  minAndroidSdk?: number // Optional - auto-detected from APK if not provided
  apkBase64: string
}

// Response includes auto-detection info
export interface AppUpdateCreateResponse {
  data: AppUpdate
  autoDetected: {
    versionCode: boolean
    versionName: boolean
    minAndroidSdk: boolean
    apkMetadata: {
      versionCode: number
      versionName: string
      packageName: string
      minSdkVersion: number
    }
  }
  warnings?: string[]
}

export interface AppUpdateUpdateInput {
  releaseNotes?: string
  updateMode?: UpdateMode
  isActive?: boolean
  minAndroidSdk?: number
}

// ===== APP UPDATES API FUNCTIONS =====

/**
 * Get all app updates
 */
export async function getAppUpdates(params?: { environment?: AppEnvironment; isActive?: boolean }): Promise<AppUpdate[]> {
  const response = await api.get('/api/v1/superadmin/app-updates', { params })
  return response.data.data
}

/**
 * Get app update by ID
 */
export async function getAppUpdateById(id: string): Promise<AppUpdate> {
  const response = await api.get(`/api/v1/superadmin/app-updates/${id}`)
  return response.data.data
}

/**
 * Get latest app update for an environment
 */
export async function getLatestAppUpdate(environment: AppEnvironment): Promise<AppUpdate | null> {
  const response = await api.get(`/api/v1/superadmin/app-updates/latest/${environment}`)
  return response.data.data
}

/**
 * Create a new app update (upload APK)
 * versionName and versionCode are optional - they will be auto-detected from the APK if not provided
 */
export async function createAppUpdate(data: AppUpdateCreateInput): Promise<AppUpdateCreateResponse> {
  const payload: Record<string, unknown> = {
    environment: data.environment,
    apkBase64: data.apkBase64,
  }

  // Only include optional fields if provided
  if (data.versionName !== undefined) payload.versionName = data.versionName
  if (data.versionCode !== undefined) payload.versionCode = data.versionCode
  if (data.releaseNotes !== undefined) payload.releaseNotes = data.releaseNotes
  if (data.updateMode !== undefined) payload.updateMode = data.updateMode
  if (data.minAndroidSdk !== undefined) payload.minAndroidSdk = data.minAndroidSdk

  const response = await api.post('/api/v1/superadmin/app-updates', payload)
  return {
    data: response.data.data,
    autoDetected: response.data.autoDetected,
    warnings: response.data.warnings,
  }
}

/**
 * Preview APK metadata without uploading
 * Returns version info extracted from AndroidManifest.xml
 */
export interface ApkPreviewResponse {
  versionCode: number
  versionName: string
  packageName: string
  minSdkVersion: number
  detectedEnvironment: 'SANDBOX' | 'PRODUCTION' | null
}

export async function previewApkMetadata(apkBase64: string): Promise<ApkPreviewResponse> {
  const response = await api.post('/api/v1/superadmin/app-updates/preview', { apkBase64 })
  return response.data.data
}

/**
 * Update an app update
 */
export async function updateAppUpdate(id: string, data: AppUpdateUpdateInput): Promise<AppUpdate> {
  const response = await api.patch(`/api/v1/superadmin/app-updates/${id}`, data)
  return response.data.data
}

/**
 * Delete an app update
 */
export async function deleteAppUpdate(id: string): Promise<void> {
  await api.delete(`/api/v1/superadmin/app-updates/${id}`)
}

// ===== VENUE TRANSFER API =====

export interface TransferVenueResponse {
  success: boolean
  message: string
  venue: any
  staffMembersUpdated: number
}

export async function transferVenue(venueId: string, targetOrganizationId: string): Promise<TransferVenueResponse> {
  const response = await api.patch(`/api/v1/dashboard/superadmin/venues/${venueId}/transfer`, {
    targetOrganizationId,
  })
  return response.data
}

// ===== BULK VENUE CREATION API =====

export interface BulkVenuePricingInput {
  debitRate: number
  creditRate: number
  amexRate: number
  internationalRate: number
  fixedFeePerTransaction?: number
  monthlyServiceFee?: number
}

export interface BulkVenueSettlementInput {
  debitDays: number
  creditDays: number
  amexDays: number
  internationalDays: number
  otherDays: number
  dayType: 'BUSINESS_DAYS' | 'CALENDAR_DAYS'
  cutoffTime?: string
  cutoffTimezone?: string
}

export interface BulkVenueInput {
  name: string
  type?: string
  address?: string
  city?: string
  state?: string
  country?: string
  zipCode?: string
  phone?: string
  email?: string
  timezone?: string
  currency?: string
  feeType?: string
  feeValue?: number
  latitude?: number
  longitude?: number
  entityType?: string
  rfc?: string
  legalName?: string
  website?: string
  settings?: Record<string, any>
  terminals?: { serialNumber: string; name: string; type: string; brand?: string; model?: string }[]
  merchantAccountId?: string
  pricing?: BulkVenuePricingInput
  settlement?: BulkVenueSettlementInput
}

export interface BulkCreateVenuesPayload {
  organizationId?: string
  organizationSlug?: string
  defaults?: {
    type?: string
    timezone?: string
    currency?: string
    country?: string
    feeType?: string
    feeValue?: number
    entityType?: string
    settings?: Record<string, any>
  }
  defaultMerchantAccountId?: string
  defaultPricing?: BulkVenuePricingInput
  defaultSettlement?: BulkVenueSettlementInput
  venues: BulkVenueInput[]
}

export interface BulkCreateVenuesResponse {
  success: boolean
  summary: {
    venuesCreated: number
    venuesFailed: number
    terminalsCreated: number
    terminalsFailed: number
    paymentConfigsCreated: number
    pricingStructuresCreated: number
    settlementConfigsCreated: number
  }
  venues: {
    index: number
    name: string
    venueId: string
    slug: string
    status: string
    terminals: { id: string; serialNumber: string | null; status: string }[]
    paymentConfigured: boolean
    pricingConfigured: boolean
    settlementConfigured: boolean
  }[]
  errors: { index: number; field: string; error: string }[]
}

export async function bulkCreateVenues(payload: BulkCreateVenuesPayload): Promise<BulkCreateVenuesResponse> {
  const response = await api.post('/api/v1/dashboard/superadmin/venues/bulk', payload)
  return response.data
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
  changeVenueStatus: async (venueId: string, status: string, reason?: string): Promise<void> => {
    await changeVenueStatus(venueId, status, reason)
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
  // Venue Module Management
  getModulesForVenue: async (venueId: string): Promise<ModuleForVenue[]> => {
    return await getModulesForVenue(venueId)
  },
  enableModuleForVenue: async (venueId: string, moduleCode: string, preset?: string): Promise<void> => {
    await enableModuleForVenue(venueId, moduleCode, preset)
  },
  disableModuleForVenue: async (venueId: string, moduleCode: string): Promise<void> => {
    await disableModuleForVenue(venueId, moduleCode)
  },
  updateVenueModuleConfig: async (venueId: string, moduleCode: string, config: Record<string, any>): Promise<void> => {
    await updateVenueModuleConfig(venueId, moduleCode, config)
  },
  // Master TOTP Setup
  getMasterTotpSetup: async (): Promise<MasterTotpSetup> => {
    return await getMasterTotpSetup()
  },
  // App Updates
  getAppUpdates: async (params?: { environment?: AppEnvironment; isActive?: boolean }): Promise<AppUpdate[]> => {
    return await getAppUpdates(params)
  },
  getAppUpdateById: async (id: string): Promise<AppUpdate> => {
    return await getAppUpdateById(id)
  },
  getLatestAppUpdate: async (environment: AppEnvironment): Promise<AppUpdate | null> => {
    return await getLatestAppUpdate(environment)
  },
  previewApkMetadata: async (apkBase64: string): Promise<ApkPreviewResponse> => {
    return await previewApkMetadata(apkBase64)
  },
  createAppUpdate: async (data: AppUpdateCreateInput): Promise<AppUpdateCreateResponse> => {
    return await createAppUpdate(data)
  },
  updateAppUpdate: async (id: string, data: AppUpdateUpdateInput): Promise<AppUpdate> => {
    return await updateAppUpdate(id, data)
  },
  deleteAppUpdate: async (id: string): Promise<void> => {
    await deleteAppUpdate(id)
  },
  // Venue Transfer
  transferVenue: async (venueId: string, targetOrganizationId: string): Promise<TransferVenueResponse> => {
    return await transferVenue(venueId, targetOrganizationId)
  },
  // Bulk Venue Creation
  bulkCreateVenues: async (payload: BulkCreateVenuesPayload): Promise<BulkCreateVenuesResponse> => {
    return await bulkCreateVenues(payload)
  },
}
