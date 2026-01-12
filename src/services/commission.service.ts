import api from '@/api'
import type {
	CommissionConfig,
	CommissionTier,
	CommissionOverride,
	CommissionSummary,
	CommissionPayout,
	CommissionCalculation,
	CommissionStats,
	PayoutStats,
	StaffCommissionsResponse,
	MyCommissionsResponse,
	StaffTierProgress,
	CreateCommissionConfigInput,
	UpdateCommissionConfigInput,
	CreateCommissionTierInput,
	UpdateCommissionTierInput,
	CreateCommissionOverrideInput,
	UpdateCommissionOverrideInput,
	CreatePayoutInput,
	AdjustSummaryInput,
	AddBonusInput,
	CommissionFilters,
	SummaryFilters,
	PayoutFilters,
	CommissionSummaryStatus,
	CommissionPayoutStatus,
} from '@/types/commission'

const BASE_URL = '/api/v1/dashboard/commissions'

const normalizeArrayResponse = <T>(payload: unknown): T[] => {
	if (Array.isArray(payload)) return (payload as T[]).filter(item => item != null)
	if (payload && typeof payload === 'object') {
		const maybe = payload as Record<string, unknown>
		const data = (maybe.data ?? maybe.items ?? maybe.summaries) as unknown
		if (Array.isArray(data)) return (data as T[]).filter(item => item != null)
	}
	return []
}

// Commission Service
export const commissionService = {
	// ============================================
	// CONFIG OPERATIONS
	// ============================================

	// Get all commission configs for a venue
	async getConfigs(venueId: string, includeInactive: boolean = false): Promise<CommissionConfig[]> {
		const params = new URLSearchParams()
		if (includeInactive) {
			params.append('includeInactive', 'true')
		}
		const response = await api.get(`${BASE_URL}/venues/${venueId}/configs?${params}`)
		return normalizeArrayResponse<CommissionConfig>(response.data)
	},

	// Get a single commission config by ID
	async getConfig(venueId: string, configId: string): Promise<CommissionConfig> {
		const response = await api.get(`${BASE_URL}/venues/${venueId}/configs/${configId}`)
		return response.data
	},

	// Create a new commission config
	async createConfig(venueId: string, data: CreateCommissionConfigInput): Promise<CommissionConfig> {
		const response = await api.post(`${BASE_URL}/venues/${venueId}/configs`, data)
		return response.data
	},

	// Update a commission config
	async updateConfig(venueId: string, configId: string, data: UpdateCommissionConfigInput): Promise<CommissionConfig> {
		const response = await api.patch(`${BASE_URL}/venues/${venueId}/configs/${configId}`, data)
		return response.data
	},

	// Delete a commission config (soft delete)
	async deleteConfig(venueId: string, configId: string): Promise<{ message: string }> {
		const response = await api.delete(`${BASE_URL}/venues/${venueId}/configs/${configId}`)
		return response.data
	},

	// ============================================
	// TIER OPERATIONS
	// ============================================

	// Get all tiers for a config
	async getTiers(venueId: string, configId: string, includeInactive: boolean = false): Promise<CommissionTier[]> {
		const params = new URLSearchParams()
		if (includeInactive) {
			params.append('includeInactive', 'true')
		}
		const response = await api.get(`${BASE_URL}/venues/${venueId}/configs/${configId}/tiers?${params}`)
		return normalizeArrayResponse<CommissionTier>(response.data)
	},

	// Get a single tier by ID
	async getTier(venueId: string, tierId: string): Promise<CommissionTier> {
		const response = await api.get(`${BASE_URL}/venues/${venueId}/tiers/${tierId}`)
		return response.data
	},

	// Create a new tier
	async createTier(venueId: string, configId: string, data: CreateCommissionTierInput): Promise<CommissionTier> {
		const response = await api.post(`${BASE_URL}/venues/${venueId}/configs/${configId}/tiers`, data)
		return response.data
	},

	// Create multiple tiers at once
	async createTiersBatch(venueId: string, configId: string, tiers: CreateCommissionTierInput[]): Promise<CommissionTier[]> {
		const response = await api.post(`${BASE_URL}/venues/${venueId}/configs/${configId}/tiers/batch`, { tiers })
		return response.data
	},

	// Update a tier
	async updateTier(venueId: string, tierId: string, data: UpdateCommissionTierInput): Promise<CommissionTier> {
		const response = await api.patch(`${BASE_URL}/venues/${venueId}/tiers/${tierId}`, data)
		return response.data
	},

	// Delete a tier
	async deleteTier(venueId: string, tierId: string): Promise<{ message: string }> {
		const response = await api.delete(`${BASE_URL}/venues/${venueId}/tiers/${tierId}`)
		return response.data
	},

	// Get staff tier progress
	async getStaffTierProgress(venueId: string, configId: string, staffId: string): Promise<StaffTierProgress | null> {
		const response = await api.get(`${BASE_URL}/venues/${venueId}/configs/${configId}/staff/${staffId}/tier-progress`)
		return response.data
	},

	// ============================================
	// OVERRIDE OPERATIONS
	// ============================================

	// Get all overrides for a config
	async getOverrides(venueId: string, configId: string, includeInactive: boolean = false): Promise<CommissionOverride[]> {
		const params = new URLSearchParams()
		if (includeInactive) {
			params.append('includeInactive', 'true')
		}
		const response = await api.get(`${BASE_URL}/venues/${venueId}/configs/${configId}/overrides?${params}`)
		return normalizeArrayResponse<CommissionOverride>(response.data)
	},

	// Get a single override by ID
	async getOverride(venueId: string, overrideId: string): Promise<CommissionOverride> {
		const response = await api.get(`${BASE_URL}/venues/${venueId}/overrides/${overrideId}`)
		return response.data
	},

	// Create a new override
	async createOverride(venueId: string, configId: string, data: CreateCommissionOverrideInput): Promise<CommissionOverride> {
		const response = await api.post(`${BASE_URL}/venues/${venueId}/configs/${configId}/overrides`, data)
		return response.data
	},

	// Update an override
	async updateOverride(venueId: string, overrideId: string, data: UpdateCommissionOverrideInput): Promise<CommissionOverride> {
		const response = await api.patch(`${BASE_URL}/venues/${venueId}/overrides/${overrideId}`, data)
		return response.data
	},

	// Delete an override
	async deleteOverride(venueId: string, overrideId: string): Promise<{ message: string }> {
		const response = await api.delete(`${BASE_URL}/venues/${venueId}/overrides/${overrideId}`)
		return response.data
	},

	// ============================================
	// STAFF COMMISSIONS
	// ============================================

	// Get commissions for a specific staff member
	async getStaffCommissions(venueId: string, staffId: string, filters?: CommissionFilters): Promise<StaffCommissionsResponse> {
		const params = new URLSearchParams()
		if (filters?.startDate) params.append('startDate', filters.startDate)
		if (filters?.endDate) params.append('endDate', filters.endDate)
		if (filters?.status) params.append('status', filters.status)
		if (filters?.configId) params.append('configId', filters.configId)
		const response = await api.get(`${BASE_URL}/venues/${venueId}/staff/${staffId}/commissions?${params}`)
		return response.data.data
	},

	// Get my own commissions (for staff portal)
	async getMyCommissions(venueId: string, filters?: CommissionFilters): Promise<MyCommissionsResponse> {
		const params = new URLSearchParams()
		if (filters?.startDate) params.append('startDate', filters.startDate)
		if (filters?.endDate) params.append('endDate', filters.endDate)
		if (filters?.status) params.append('status', filters.status)
		const response = await api.get(`${BASE_URL}/venues/${venueId}/my-commissions?${params}`)
		return response.data.data
	},

	// Get all commission calculations for a venue
	async getCalculations(venueId: string, filters?: CommissionFilters): Promise<CommissionCalculation[]> {
		const params = new URLSearchParams()
		if (filters?.startDate) params.append('startDate', filters.startDate)
		if (filters?.endDate) params.append('endDate', filters.endDate)
		if (filters?.staffId) params.append('staffId', filters.staffId)
		if (filters?.status) params.append('status', filters.status)
		if (filters?.configId) params.append('configId', filters.configId)
		const response = await api.get(`${BASE_URL}/venues/${venueId}/calculations?${params}`)
		return normalizeArrayResponse<CommissionCalculation>(response.data)
	},

	// ============================================
	// SUMMARY OPERATIONS
	// ============================================

	// Get all summaries for a venue
	async getSummaries(venueId: string, filters?: SummaryFilters): Promise<CommissionSummary[]> {
		const params = new URLSearchParams()
		if (filters?.staffId) params.append('staffId', filters.staffId)
		if (filters?.status) params.append('status', filters.status)
		if (filters?.periodStart) params.append('periodStart', filters.periodStart)
		if (filters?.periodEnd) params.append('periodEnd', filters.periodEnd)
		const response = await api.get(`${BASE_URL}/venues/${venueId}/summaries?${params}`)
		return normalizeArrayResponse<CommissionSummary>(response.data)
	},

	// Get a single summary by ID
	async getSummary(venueId: string, summaryId: string): Promise<CommissionSummary> {
		const response = await api.get(`${BASE_URL}/venues/${venueId}/summaries/${summaryId}`)
		return response.data
	},

	// Get summaries pending approval
	async getPendingSummaries(venueId: string): Promise<CommissionSummary[]> {
		const response = await api.get(`${BASE_URL}/venues/${venueId}/summaries?status=PENDING_APPROVAL`)
		return normalizeArrayResponse<CommissionSummary>(response.data)
	},

	// Approve a summary
	async approveSummary(venueId: string, summaryId: string): Promise<CommissionSummary> {
		const response = await api.post(`${BASE_URL}/venues/${venueId}/summaries/${summaryId}/approve`)
		return response.data
	},

	// Batch approve summaries
	async approveSummariesBatch(venueId: string, summaryIds: string[]): Promise<{ approved: number; failed: number }> {
		const response = await api.post(`${BASE_URL}/venues/${venueId}/summaries/approve-batch`, { summaryIds })
		return response.data
	},

	// Dispute a summary
	async disputeSummary(venueId: string, summaryId: string, reason: string): Promise<CommissionSummary> {
		const response = await api.post(`${BASE_URL}/venues/${venueId}/summaries/${summaryId}/dispute`, { reason })
		return response.data
	},

	// Resolve a disputed summary
	async resolveSummaryDispute(venueId: string, summaryId: string, resolution: string): Promise<CommissionSummary> {
		const response = await api.post(`${BASE_URL}/venues/${venueId}/summaries/${summaryId}/resolve`, { resolution })
		return response.data
	},

	// Add bonus to a summary
	async addBonus(venueId: string, summaryId: string, data: AddBonusInput): Promise<CommissionSummary> {
		const response = await api.post(`${BASE_URL}/venues/${venueId}/summaries/${summaryId}/bonus`, data)
		return response.data
	},

	// Add adjustment to a summary
	async addAdjustment(venueId: string, summaryId: string, data: AdjustSummaryInput): Promise<CommissionSummary> {
		const response = await api.post(`${BASE_URL}/venues/${venueId}/summaries/${summaryId}/adjust`, data)
		return response.data
	},

	// ============================================
	// PAYOUT OPERATIONS
	// ============================================

	// Get all payouts for a venue
	async getPayouts(venueId: string, filters?: PayoutFilters): Promise<CommissionPayout[]> {
		const params = new URLSearchParams()
		if (filters?.staffId) params.append('staffId', filters.staffId)
		if (filters?.status) params.append('status', filters.status)
		if (filters?.startDate) params.append('startDate', filters.startDate)
		if (filters?.endDate) params.append('endDate', filters.endDate)
		const response = await api.get(`${BASE_URL}/venues/${venueId}/payouts?${params}`)
		return normalizeArrayResponse<CommissionPayout>(response.data)
	},

	// Get a single payout by ID
	async getPayout(venueId: string, payoutId: string): Promise<CommissionPayout> {
		const response = await api.get(`${BASE_URL}/venues/${venueId}/payouts/${payoutId}`)
		return response.data
	},

	// Get payouts for a specific staff member
	async getStaffPayouts(venueId: string, staffId: string, limit: number = 10): Promise<CommissionPayout[]> {
		const params = new URLSearchParams({
			staffId,
			limit: limit.toString(),
		})
		const response = await api.get(`${BASE_URL}/venues/${venueId}/payouts?${params}`)
		return normalizeArrayResponse<CommissionPayout>(response.data)
	},

	// Create payouts from approved summaries
	async createPayouts(venueId: string, data: CreatePayoutInput): Promise<CommissionPayout[]> {
		const response = await api.post(`${BASE_URL}/venues/${venueId}/payouts`, data)
		return response.data
	},

	// Approve a payout
	async approvePayout(venueId: string, payoutId: string): Promise<CommissionPayout> {
		const response = await api.post(`${BASE_URL}/venues/${venueId}/payouts/${payoutId}/approve`)
		return response.data
	},

	// Process a payout (mark as processing)
	async processPayout(venueId: string, payoutId: string): Promise<CommissionPayout> {
		const response = await api.post(`${BASE_URL}/venues/${venueId}/payouts/${payoutId}/process`)
		return response.data
	},

	// Complete a payout (mark as paid)
	async completePayout(venueId: string, payoutId: string, reference?: string): Promise<CommissionPayout> {
		const response = await api.post(`${BASE_URL}/venues/${venueId}/payouts/${payoutId}/complete`, { reference })
		return response.data
	},

	// Cancel a payout
	async cancelPayout(venueId: string, payoutId: string, reason?: string): Promise<CommissionPayout> {
		const response = await api.post(`${BASE_URL}/venues/${venueId}/payouts/${payoutId}/cancel`, { reason })
		return response.data
	},

	// Mark payout as failed
	async failPayout(venueId: string, payoutId: string, failureReason: string): Promise<CommissionPayout> {
		const response = await api.post(`${BASE_URL}/venues/${venueId}/payouts/${payoutId}/fail`, { failureReason })
		return response.data
	},

	// ============================================
	// STATS OPERATIONS
	// ============================================

	// Get overall commission stats for a venue
	async getStats(venueId: string): Promise<CommissionStats> {
		const response = await api.get(`${BASE_URL}/venues/${venueId}/stats`)
		return response.data
	},

	// Get payout stats for a venue
	async getPayoutStats(venueId: string): Promise<PayoutStats> {
		const response = await api.get(`${BASE_URL}/venues/${venueId}/payouts/stats`)
		return response.data
	},

	// ============================================
	// CALCULATION TRIGGER
	// ============================================

	// Trigger commission calculation for a payment
	async calculateForPayment(venueId: string, paymentId: string): Promise<CommissionCalculation> {
		const response = await api.post(`${BASE_URL}/venues/${venueId}/calculate/payment/${paymentId}`)
		return response.data
	},

	// Recalculate commissions for a period
	async recalculatePeriod(venueId: string, startDate: string, endDate: string): Promise<{ calculated: number; errors: number }> {
		const response = await api.post(`${BASE_URL}/venues/${venueId}/recalculate`, { startDate, endDate })
		return response.data
	},

	// Generate summaries for a period
	async generateSummaries(venueId: string, startDate: string, endDate: string): Promise<{ generated: number }> {
		const response = await api.post(`${BASE_URL}/venues/${venueId}/summaries/generate`, { startDate, endDate })
		return response.data
	},
}

export default commissionService
