// Commission Types
// Based on backend models in avoqado-server/src/services/dashboard/commission/

// ============================================
// Enums
// ============================================

export type CommissionRecipient = 'CREATOR' | 'SERVER' | 'PROCESSOR'
export type CommissionCalcType = 'PERCENTAGE' | 'FIXED' | 'TIERED' | 'MILESTONE' | 'MANUAL'
export type TierType = 'BY_QUANTITY' | 'BY_AMOUNT'
export type TierPeriod = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY'
export type CommissionCalculationStatus = 'PENDING' | 'CALCULATED' | 'APPROVED' | 'PAID' | 'VOIDED'
export type CommissionSummaryStatus = 'DRAFT' | 'CALCULATED' | 'PENDING_APPROVAL' | 'APPROVED' | 'DISPUTED' | 'PAID'
export type CommissionPayoutStatus = 'PENDING' | 'APPROVED' | 'PROCESSING' | 'PAID' | 'FAILED' | 'CANCELLED'

// ============================================
// Core Data Types
// ============================================

export type CommissionConfigSource = 'venue' | 'organization'

export interface EffectiveCommissionConfig {
	config: CommissionConfig
	source: CommissionConfigSource
}

export interface CommissionConfig {
	id: string
	venueId: string
	name: string
	priority: number
	recipient: CommissionRecipient
	calcType: CommissionCalcType
	defaultRate: number
	minAmount: number | null
	maxAmount: number | null
	includeTips: boolean
	includeDiscount: boolean
	includeTax: boolean
	roleRates: Record<string, number> | null
	effectiveFrom: string
	effectiveTo: string | null
	aggregationPeriod: TierPeriod // Period for grouping commissions into summaries (payroll alignment)
	active: boolean
	createdAt: string
	updatedAt: string
	tiers?: CommissionTier[]
	overrides?: CommissionOverride[]
	_count?: {
		tiers: number
		overrides: number
		calculations: number
	}
}

export interface CommissionTier {
	id: string
	configId: string
	tierLevel: number
	tierName: string
	tierType: TierType
	minThreshold: number
	maxThreshold: number | null
	rate: number
	tierPeriod: TierPeriod
	active: boolean
	createdAt: string
	updatedAt: string
}

export interface CommissionOverride {
	id: string
	configId: string
	staffId: string
	customRate: number | null
	excludeFromCommissions: boolean
	notes: string | null
	effectiveFrom: string
	effectiveTo: string | null
	active: boolean
	createdAt: string
	updatedAt: string
	staff: StaffBasic
}

export interface CommissionCalculation {
	id: string
	venueId: string
	configId: string
	staffId: string
	orderId: string | null
	paymentId: string | null
	baseAmount: number
	commissionAmount: number
	rate: number
	tierId: string | null
	overrideId: string | null
	summaryId: string | null
	status: CommissionCalculationStatus
	calculatedAt: string
	approvedAt: string | null
	approvedById: string | null
	order?: OrderBasic | null
	payment?: PaymentBasic | null
	staff: StaffBasic
	tier?: CommissionTier | null
	override?: CommissionOverride | null
}

export interface CommissionSummary {
	id: string
	venueId: string
	staffId: string
	configId: string
	periodStart: string
	periodEnd: string
	totalCommissions: number
	totalBonuses: number
	totalAdjustments: number
	netAmount: number
	calculationCount: number
	status: CommissionSummaryStatus
	approvedAt: string | null
	approvedById: string | null
	disputeReason: string | null
	notes: string | null
	version: number
	createdAt: string
	updatedAt: string
	staff: StaffBasic
	config?: CommissionConfigBasic
	calculations?: CommissionCalculation[]
	payout?: CommissionPayout | null
}

export interface CommissionPayout {
	id: string
	venueId: string
	staffId: string
	summaryId: string
	amount: number
	paymentMethod: string
	paymentReference: string | null
	status: CommissionPayoutStatus
	processedById: string | null
	processedAt: string | null
	paidAt: string | null
	failureReason: string | null
	retryCount: number
	notes: string | null
	createdAt: string
	updatedAt: string
	staff: StaffBasic
	processedBy?: StaffBasic | null
	summary?: CommissionSummaryBasic
}

// ============================================
// Basic/Nested Types (for relations)
// ============================================

export interface StaffBasic {
	id: string
	firstName: string
	lastName: string
	email?: string
	phone?: string
	staffVenueId?: string | null // The StaffVenue ID for navigation to team member page
}

export interface OrderBasic {
	id: string
	orderNumber: string
	total: number
	createdAt: string
}

export interface PaymentBasic {
	id: string
	amount: number
	paymentMethod: string
	createdAt: string
}

export interface CommissionConfigBasic {
	id: string
	name: string
	calcType: CommissionCalcType
	defaultRate: number
}

export interface CommissionSummaryBasic {
	id: string
	periodStart: string
	periodEnd: string
	netAmount: number
	status: CommissionSummaryStatus
}

// Commission info for a specific payment (used in PaymentId.tsx)
export interface PaymentCommission {
	id: string
	staffId: string
	staffName: string
	netCommission: number
	effectiveRate: number
	baseAmount: number
	status: string
	calculatedAt: string
	configName: string
}

// ============================================
// Tier Progress Types
// ============================================

export interface StaffTierProgress {
	staffId: string
	currentValue: number
	currentTier: number | null
	nextTier: number | null
	progressToNext: number
	tiers: Array<{
		level: number
		name: string
		minThreshold: number
		rate: number
		achieved: boolean
	}>
}

// ============================================
// Stats Types
// ============================================

export interface CommissionStats {
	totalPaid: number
	totalPending: number
	totalApproved: number
	staffWithCommissions: number
	averageCommission: number
	topEarners: Array<{
		staffId: string
		staffName: string
		totalEarned: number
		calculationCount: number
	}>
}

export interface PayoutStats {
	totalPaid: number
	totalPending: number
	payoutCount: number
	averagePayout: number
}

// Stats returned by getStaffCommissions endpoint
// Note: This is the actual shape from the backend, not the shape in StaffCommissionsResponse docs
export interface StaffCommissionStats {
	thisMonth: number
	lastMonth: number
	total: number
}

// ============================================
// Request DTOs (Create/Update Inputs)
// ============================================

export interface CreateCommissionConfigInput {
	name: string
	recipient: CommissionRecipient
	calcType: CommissionCalcType
	defaultRate: number
	minAmount?: number | null
	maxAmount?: number | null
	includeTips?: boolean
	includeDiscount?: boolean
	includeTax?: boolean
	roleRates?: Record<string, number> | null
	effectiveFrom?: string
	effectiveTo?: string | null
	priority?: number
	aggregationPeriod?: TierPeriod // Period for grouping commissions into summaries (payroll alignment)
}

export interface UpdateCommissionConfigInput {
	name?: string
	recipient?: CommissionRecipient
	calcType?: CommissionCalcType
	defaultRate?: number
	minAmount?: number | null
	maxAmount?: number | null
	includeTips?: boolean
	includeDiscount?: boolean
	includeTax?: boolean
	roleRates?: Record<string, number> | null
	effectiveFrom?: string
	effectiveTo?: string | null
	priority?: number
	active?: boolean
	aggregationPeriod?: TierPeriod // Period for grouping commissions into summaries (payroll alignment)
}

export interface CreateCommissionTierInput {
	tierLevel: number
	name: string
	tierType?: TierType
	minThreshold: number
	maxThreshold?: number | null
	rate: number
	period?: TierPeriod
}

export interface UpdateCommissionTierInput {
	name?: string
	tierType?: TierType
	minThreshold?: number
	maxThreshold?: number | null
	rate?: number
	period?: TierPeriod
	active?: boolean
}

export interface CreateCommissionOverrideInput {
	staffId: string
	customRate?: number | null
	excludeFromCommissions?: boolean
	notes?: string | null
	effectiveFrom?: string
	effectiveTo?: string | null
}

export interface UpdateCommissionOverrideInput {
	customRate?: number | null
	excludeFromCommissions?: boolean
	notes?: string | null
	effectiveFrom?: string
	effectiveTo?: string | null
	active?: boolean
}

export interface CreatePayoutInput {
	summaryIds: string[]
	paymentMethod?: string
	paymentReference?: string
	notes?: string
}

export interface AdjustSummaryInput {
	adjustmentAmount: number
	reason: string
}

export interface AddBonusInput {
	bonusAmount: number
	reason: string
}

// ============================================
// Filter Types
// ============================================

export interface CommissionFilters {
	startDate?: string
	endDate?: string
	staffId?: string
	status?: CommissionCalculationStatus
	configId?: string
}

export interface SummaryFilters {
	staffId?: string
	status?: CommissionSummaryStatus
	periodStart?: string
	periodEnd?: string
}

export interface PayoutFilters {
	staffId?: string
	status?: CommissionPayoutStatus
	startDate?: string
	endDate?: string
}

// ============================================
// Response Types
// ============================================

export interface PaginationMeta {
	totalCount: number
	pageSize: number
	currentPage: number
	totalPages: number
	hasNextPage: boolean
	hasPrevPage: boolean
}

export interface PaginatedCommissionConfigsResponse {
	data: CommissionConfig[]
	meta: PaginationMeta
}

export interface PaginatedCommissionCalculationsResponse {
	data: CommissionCalculation[]
	meta: PaginationMeta
}

export interface PaginatedCommissionSummariesResponse {
	data: CommissionSummary[]
	meta: PaginationMeta
}

export interface PaginatedCommissionPayoutsResponse {
	data: CommissionPayout[]
	meta: PaginationMeta
}

// ============================================
// Staff Commissions Response
// ============================================

export interface StaffCommissionsResponse {
	calculations: CommissionCalculation[]
	summaries: CommissionSummary[]
	stats: StaffCommissionStats
	tierProgress: StaffTierProgress | null
}

export interface MyCommissionsResponse {
	calculations: CommissionCalculation[]
	summaries: CommissionSummary[]
	stats: StaffCommissionStats
	tierProgress: StaffTierProgress | null
}

// ============================================
// Sales Goal Types
// ============================================

export type SalesGoalPeriod = 'DAILY' | 'WEEKLY' | 'MONTHLY'

export interface SalesGoal {
	id: string
	venueId: string
	staffId: string | null // null = venue-wide goal
	goal: number
	period: SalesGoalPeriod
	currentSales: number
	active: boolean
	createdAt: string
	updatedAt: string
	staff?: StaffBasic | null
}

export interface CreateSalesGoalInput {
	staffId?: string | null
	goal: number
	period: SalesGoalPeriod
}

export interface UpdateSalesGoalInput {
	goal?: number
	period?: SalesGoalPeriod
	active?: boolean
}

// ============================================
// Org Payout Config Types
// ============================================

export interface OrgPayoutConfig {
	id: string
	organizationId: string
	aggregationPeriod: string
	requireApproval: boolean
	paymentMethods: string[]
	createdAt: string
	updatedAt: string
}

export interface OrgPayoutConfigInput {
	aggregationPeriod?: string
	requireApproval?: boolean
	paymentMethods?: string[]
}

export interface ResolvedPayoutConfig {
	config: {
		aggregationPeriod: string
		requireApproval: boolean
		paymentMethods: string[]
	}
	source: 'venue' | 'organization'
}
