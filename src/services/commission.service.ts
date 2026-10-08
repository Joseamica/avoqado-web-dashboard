import api from '@/api'
import type {
	CommissionConfig,
	CommissionTier,
	CommissionOverride,
	CommissionSummary,
	CommissionCalculation,
	CommissionStats,
	StaffCommissionsResponse,
	MyCommissionsResponse,
	StaffTierProgress,
	CreateCommissionConfigInput,
	UpdateCommissionConfigInput,
	CreateCommissionTierInput,
	UpdateCommissionTierInput,
	CreateCommissionOverrideInput,
	UpdateCommissionOverrideInput,
	CommissionFilters,
	SummaryFilters,
	PaymentCommission,
	SalesGoal,
	CreateSalesGoalInput,
	UpdateSalesGoalInput,
	OrgPayoutConfig,
	OrgPayoutConfigInput,
	ResolvedPayoutConfig,
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
		const response = await api.put(`${BASE_URL}/venues/${venueId}/configs/${configId}`, data)
		return response.data.data
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
		return (await commissionService.getSummariesPage(venueId, filters)).items
	},

	// Los mismos resúmenes con el `total` del servidor (E6a-fix3): topa la tabla a 500 renglones y dice cuántos había antes del tope.
	// Sin `total` (servidor previo) o si no es un número: `undefined`, nunca inventado.
	async getSummariesPage(venueId: string, filters?: SummaryFilters): Promise<{ items: CommissionSummary[]; total: number | undefined }> {
		const params = new URLSearchParams()
		if (filters?.staffId) params.append('staffId', filters.staffId)
		if (filters?.status) params.append('status', filters.status)
		if (filters?.periodStart) params.append('periodStart', filters.periodStart)
		if (filters?.periodEnd) params.append('periodEnd', filters.periodEnd)
		const response = await api.get(`${BASE_URL}/venues/${venueId}/summaries?${params}`)
		const total = (response.data as { total?: unknown } | null)?.total
		return { items: normalizeArrayResponse<CommissionSummary>(response.data), total: typeof total === 'number' ? total : undefined }
	},

	// Get a single summary by ID
	async getSummary(venueId: string, summaryId: string): Promise<CommissionSummary> {
		const response = await api.get(`${BASE_URL}/venues/${venueId}/summaries/${summaryId}`)
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

	// ============================================
	// PAYMENT COMMISSION
	// ============================================

	// Get commission for a specific payment
	async getCommissionByPaymentId(venueId: string, paymentId: string): Promise<PaymentCommission | null> {
		const response = await api.get(`${BASE_URL}/venues/${venueId}/payments/${paymentId}/commission`)
		return response.data.data
	},

	// Get commissions for multiple payments in a single request
	async getCommissionsByPaymentIds(venueId: string, paymentIds: string[]): Promise<Record<string, PaymentCommission>> {
		if (paymentIds.length === 0) return {}
		const response = await api.post(`${BASE_URL}/venues/${venueId}/payments/commissions/batch`, { paymentIds })
		return response.data.data
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

	// ============================================
	// SALES GOAL OPERATIONS
	// ============================================

	// Get all sales goals for a venue
	async getSalesGoals(venueId: string, includeInactive: boolean = false): Promise<SalesGoal[]> {
		const params = new URLSearchParams()
		if (includeInactive) {
			params.append('includeInactive', 'true')
		}
		const response = await api.get(`${BASE_URL}/venues/${venueId}/goals?${params}`)
		return normalizeArrayResponse<SalesGoal>(response.data)
	},

	// Get a single sales goal by ID
	async getSalesGoal(venueId: string, goalId: string): Promise<SalesGoal> {
		const response = await api.get(`${BASE_URL}/venues/${venueId}/goals/${goalId}`)
		return response.data
	},

	// Create a new sales goal
	async createSalesGoal(venueId: string, data: CreateSalesGoalInput): Promise<SalesGoal> {
		const response = await api.post(`${BASE_URL}/venues/${venueId}/goals`, data)
		return response.data
	},

	// Update a sales goal
	async updateSalesGoal(venueId: string, goalId: string, data: UpdateSalesGoalInput): Promise<SalesGoal> {
		const response = await api.patch(`${BASE_URL}/venues/${venueId}/goals/${goalId}`, data)
		return response.data
	},

	// Delete a sales goal
	async deleteSalesGoal(venueId: string, goalId: string): Promise<{ message: string }> {
		const response = await api.delete(`${BASE_URL}/venues/${venueId}/goals/${goalId}`)
		return response.data
	},

	// ==========================================
	// ORG-LEVEL COMMISSION CONFIGS
	// ==========================================

	// Get org-level commission configs
	async getOrgConfigs(venueId: string): Promise<CommissionConfig[]> {
		const response = await api.get(`${BASE_URL}/venues/${venueId}/org-configs`)
		return normalizeArrayResponse(response.data)
	},

	// Get effective configs (resolved: venue or org fallback) with source
	async getEffectiveConfigs(venueId: string): Promise<{ config: CommissionConfig; source: 'venue' | 'organization' }[]> {
		const response = await api.get(`${BASE_URL}/venues/${venueId}/effective-configs`)
		return normalizeArrayResponse(response.data)
	},

	// Create org-level commission config
	async createOrgConfig(venueId: string, data: CreateCommissionConfigInput): Promise<CommissionConfig> {
		const response = await api.post(`${BASE_URL}/venues/${venueId}/org-configs`, data)
		return response.data?.data || response.data
	},

	// Update org-level commission config
	async updateOrgConfig(venueId: string, configId: string, data: UpdateCommissionConfigInput): Promise<CommissionConfig> {
		const response = await api.put(`${BASE_URL}/venues/${venueId}/org-configs/${configId}`, data)
		return response.data?.data || response.data
	},

	// Delete org-level commission config
	async deleteOrgConfig(venueId: string, configId: string): Promise<void> {
		await api.delete(`${BASE_URL}/venues/${venueId}/org-configs/${configId}`)
	},

	// ==========================================
	// ORG-LEVEL PAYOUT CONFIG
	// ==========================================

	// Get org-level payout config
	async getOrgPayoutConfig(venueId: string): Promise<OrgPayoutConfig | null> {
		const response = await api.get(`${BASE_URL}/venues/${venueId}/org-payout-config`)
		return response.data?.data || null
	},

	// Get effective payout config (resolved: venue or org fallback)
	async getEffectivePayoutConfig(venueId: string): Promise<ResolvedPayoutConfig> {
		const response = await api.get(`${BASE_URL}/venues/${venueId}/effective-payout-config`)
		return response.data?.data
	},

	// Create or update org-level payout config (upsert)
	async upsertOrgPayoutConfig(venueId: string, data: OrgPayoutConfigInput): Promise<OrgPayoutConfig> {
		const response = await api.put(`${BASE_URL}/venues/${venueId}/org-payout-config`, data)
		return response.data?.data || response.data
	},

	// Delete org-level payout config
	async deleteOrgPayoutConfig(venueId: string): Promise<void> {
		await api.delete(`${BASE_URL}/venues/${venueId}/org-payout-config`)
	},
}

export default commissionService
