import api from '@/api'
import type {
	Discount,
	DiscountStats,
	PaginatedDiscountsResponse,
	CreateDiscountRequest,
	UpdateDiscountRequest,
	DiscountQueryParams,
	AssignDiscountToCustomerRequest,
} from '@/types/discount'

// Discount query parameters builder
const buildQueryString = (params: DiscountQueryParams): string => {
	const searchParams = new URLSearchParams()

	if (params.page) searchParams.append('page', params.page.toString())
	if (params.pageSize) searchParams.append('pageSize', params.pageSize.toString())
	if (params.search) searchParams.append('search', params.search)
	if (params.type) searchParams.append('type', params.type)
	if (params.scope) searchParams.append('scope', params.scope)
	if (params.isAutomatic !== undefined) searchParams.append('isAutomatic', params.isAutomatic.toString())
	if (params.active !== undefined) searchParams.append('active', params.active.toString())

	const queryString = searchParams.toString()
	return queryString ? `?${queryString}` : ''
}

// Discount Service
export const discountService = {
	// ==================== DISCOUNTS ====================

	// Get discounts with pagination and filters
	async getDiscounts(venueId: string, params: DiscountQueryParams = {}): Promise<PaginatedDiscountsResponse> {
		const queryString = buildQueryString(params)
		const response = await api.get(`/api/v1/dashboard/venues/${venueId}/discounts${queryString}`)
		return response.data
	},

	// Get discount statistics
	async getDiscountStats(venueId: string): Promise<DiscountStats> {
		const response = await api.get(`/api/v1/dashboard/venues/${venueId}/discounts/stats`)
		return response.data
	},

	// Get active automatic discounts
	async getAutomaticDiscounts(venueId: string): Promise<Discount[]> {
		const response = await api.get(`/api/v1/dashboard/venues/${venueId}/discounts/automatic`)
		return response.data
	},

	// Get specific discount
	async getDiscount(venueId: string, discountId: string): Promise<Discount> {
		const response = await api.get(`/api/v1/dashboard/venues/${venueId}/discounts/${discountId}`)
		return response.data
	},

	// Create new discount
	async createDiscount(venueId: string, data: CreateDiscountRequest): Promise<Discount> {
		const response = await api.post(`/api/v1/dashboard/venues/${venueId}/discounts`, data)
		return response.data
	},

	// Update discount
	async updateDiscount(venueId: string, discountId: string, data: UpdateDiscountRequest): Promise<Discount> {
		const response = await api.put(`/api/v1/dashboard/venues/${venueId}/discounts/${discountId}`, data)
		return response.data
	},

	// Delete discount
	async deleteDiscount(venueId: string, discountId: string): Promise<void> {
		await api.delete(`/api/v1/dashboard/venues/${venueId}/discounts/${discountId}`)
	},

	// Clone discount
	async cloneDiscount(venueId: string, discountId: string): Promise<Discount> {
		const response = await api.post(`/api/v1/dashboard/venues/${venueId}/discounts/${discountId}/clone`)
		return response.data
	},

	// ==================== CUSTOMER ASSIGNMENTS ====================

	// Assign discount to customer
	async assignToCustomer(
		venueId: string,
		discountId: string,
		data: AssignDiscountToCustomerRequest
	): Promise<void> {
		await api.post(`/api/v1/dashboard/venues/${venueId}/discounts/${discountId}/customers`, data)
	},

	// Remove discount from customer
	async removeFromCustomer(venueId: string, discountId: string, customerId: string): Promise<void> {
		await api.delete(`/api/v1/dashboard/venues/${venueId}/discounts/${discountId}/customers/${customerId}`)
	},

	// Get customer's assigned discounts
	async getCustomerDiscounts(venueId: string, customerId: string): Promise<Discount[]> {
		const response = await api.get(`/api/v1/dashboard/venues/${venueId}/customers/${customerId}/discounts`)
		return response.data
	},
}

export default discountService
