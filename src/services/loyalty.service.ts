import api from '@/api'
import type {
	LoyaltyConfig,
	LoyaltyTransactionType,
	PaginatedLoyaltyTransactionsResponse,
	UpdateLoyaltyConfigRequest,
	RedeemPointsRequest,
	RedeemPointsResponse,
	AdjustPointsRequest,
	AdjustPointsResponse,
	CalculatePointsRequest,
	CalculatePointsResponse,
	CalculateDiscountRequest,
	CalculateDiscountResponse,
	LoyaltyBalanceResponse,
} from '@/types/customer'

// Loyalty transaction query parameters
export interface LoyaltyTransactionQueryParams {
	page?: number
	pageSize?: number
	type?: LoyaltyTransactionType
}

// Loyalty Service
export const loyaltyService = {
	// ==================== LOYALTY CONFIG ====================

	// Get loyalty configuration for venue
	async getConfig(venueId: string): Promise<LoyaltyConfig> {
		const response = await api.get(`/api/v1/dashboard/venues/${venueId}/loyalty/config`)
		return response.data
	},

	// Update loyalty configuration
	async updateConfig(venueId: string, data: UpdateLoyaltyConfigRequest): Promise<LoyaltyConfig> {
		const response = await api.put(`/api/v1/dashboard/venues/${venueId}/loyalty/config`, data)
		return response.data
	},

	// ==================== CUSTOMER LOYALTY ====================

	// Get customer loyalty balance
	async getCustomerBalance(venueId: string, customerId: string): Promise<LoyaltyBalanceResponse> {
		const response = await api.get(`/api/v1/dashboard/venues/${venueId}/customers/${customerId}/loyalty/balance`)
		return response.data
	},

	// Get customer loyalty transactions
	async getCustomerTransactions(
		venueId: string,
		customerId: string,
		params: LoyaltyTransactionQueryParams = {},
	): Promise<PaginatedLoyaltyTransactionsResponse> {
		const searchParams = new URLSearchParams()

		if (params.page) searchParams.append('page', params.page.toString())
		if (params.pageSize) searchParams.append('pageSize', params.pageSize.toString())
		if (params.type) searchParams.append('type', params.type)

		const queryString = searchParams.toString()
		const url = `/api/v1/dashboard/venues/${venueId}/customers/${customerId}/loyalty/transactions${queryString ? `?${queryString}` : ''}`

		const response = await api.get(url)
		return response.data
	},

	// Redeem points for discount
	async redeemPoints(venueId: string, customerId: string, data: RedeemPointsRequest): Promise<RedeemPointsResponse> {
		const response = await api.post(`/api/v1/dashboard/venues/${venueId}/customers/${customerId}/loyalty/redeem`, data)
		return response.data
	},

	// Adjust points manually
	async adjustPoints(venueId: string, customerId: string, data: AdjustPointsRequest): Promise<AdjustPointsResponse> {
		const response = await api.post(`/api/v1/dashboard/venues/${venueId}/customers/${customerId}/loyalty/adjust`, data)
		return response.data
	},

	// ==================== CALCULATIONS ====================

	// Calculate points for an amount
	async calculatePoints(venueId: string, data: CalculatePointsRequest): Promise<CalculatePointsResponse> {
		const response = await api.post(`/api/v1/dashboard/venues/${venueId}/loyalty/calculate-points`, data)
		return response.data
	},

	// Calculate discount for points
	async calculateDiscount(venueId: string, data: CalculateDiscountRequest): Promise<CalculateDiscountResponse> {
		const response = await api.post(`/api/v1/dashboard/venues/${venueId}/loyalty/calculate-discount`, data)
		return response.data
	},

	// ==================== ADMIN ====================

	// Expire points (admin job)
	async expirePoints(venueId: string): Promise<{ customersAffected: number; pointsExpired: number }> {
		const response = await api.post(`/api/v1/dashboard/venues/${venueId}/loyalty/expire-old-points`)
		return response.data
	},
}

export default loyaltyService
