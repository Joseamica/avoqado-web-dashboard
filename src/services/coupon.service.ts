import api from '@/api'
import type {
	Coupon,
	CouponStats,
	CouponValidationResult,
	PaginatedCouponsResponse,
	PaginatedRedemptionsResponse,
	CreateCouponRequest,
	UpdateCouponRequest,
	BulkGenerateCouponsRequest,
	BulkGenerateCouponsResponse,
	ValidateCouponRequest,
	RedeemCouponRequest,
	CouponQueryParams,
	RedemptionQueryParams,
} from '@/types/discount'

// Coupon query parameters builder
const buildCouponQueryString = (params: CouponQueryParams): string => {
	const searchParams = new URLSearchParams()

	if (params.page) searchParams.append('page', params.page.toString())
	if (params.pageSize) searchParams.append('pageSize', params.pageSize.toString())
	if (params.search) searchParams.append('search', params.search)
	if (params.discountId) searchParams.append('discountId', params.discountId)
	if (params.active !== undefined) searchParams.append('active', params.active.toString())

	const queryString = searchParams.toString()
	return queryString ? `?${queryString}` : ''
}

// Redemption query parameters builder
const buildRedemptionQueryString = (params: RedemptionQueryParams): string => {
	const searchParams = new URLSearchParams()

	if (params.page) searchParams.append('page', params.page.toString())
	if (params.pageSize) searchParams.append('pageSize', params.pageSize.toString())
	if (params.couponId) searchParams.append('couponId', params.couponId)
	if (params.customerId) searchParams.append('customerId', params.customerId)
	if (params.startDate) searchParams.append('startDate', params.startDate)
	if (params.endDate) searchParams.append('endDate', params.endDate)

	const queryString = searchParams.toString()
	return queryString ? `?${queryString}` : ''
}

// Coupon Service
export const couponService = {
	// ==================== COUPONS ====================

	// Get coupons with pagination and filters
	async getCoupons(venueId: string, params: CouponQueryParams = {}): Promise<PaginatedCouponsResponse> {
		const queryString = buildCouponQueryString(params)
		const response = await api.get(`/api/v1/dashboard/venues/${venueId}/coupons${queryString}`)
		return response.data
	},

	// Get coupon statistics
	async getCouponStats(venueId: string): Promise<CouponStats> {
		const response = await api.get(`/api/v1/dashboard/venues/${venueId}/coupons/stats`)
		return response.data
	},

	// Get redemption history
	async getRedemptions(venueId: string, params: RedemptionQueryParams = {}): Promise<PaginatedRedemptionsResponse> {
		const queryString = buildRedemptionQueryString(params)
		const response = await api.get(`/api/v1/dashboard/venues/${venueId}/coupons/redemptions${queryString}`)
		return response.data
	},

	// Get specific coupon
	async getCoupon(venueId: string, couponId: string): Promise<Coupon> {
		const response = await api.get(`/api/v1/dashboard/venues/${venueId}/coupons/${couponId}`)
		return response.data
	},

	// Create new coupon
	async createCoupon(venueId: string, data: CreateCouponRequest): Promise<Coupon> {
		const response = await api.post(`/api/v1/dashboard/venues/${venueId}/coupons`, data)
		return response.data
	},

	// Update coupon
	async updateCoupon(venueId: string, couponId: string, data: UpdateCouponRequest): Promise<Coupon> {
		const response = await api.put(`/api/v1/dashboard/venues/${venueId}/coupons/${couponId}`, data)
		return response.data
	},

	// Delete coupon
	async deleteCoupon(venueId: string, couponId: string): Promise<void> {
		await api.delete(`/api/v1/dashboard/venues/${venueId}/coupons/${couponId}`)
	},

	// ==================== VALIDATION & REDEMPTION ====================

	// Validate a coupon code
	async validateCoupon(venueId: string, data: ValidateCouponRequest): Promise<CouponValidationResult> {
		const response = await api.post(`/api/v1/dashboard/venues/${venueId}/coupons/validate`, data)
		return response.data
	},

	// Record a coupon redemption
	async redeemCoupon(venueId: string, couponId: string, data: RedeemCouponRequest): Promise<void> {
		await api.post(`/api/v1/dashboard/venues/${venueId}/coupons/${couponId}/redeem`, data)
	},

	// ==================== BULK GENERATION ====================

	// Bulk generate coupon codes
	async bulkGenerate(venueId: string, data: BulkGenerateCouponsRequest): Promise<BulkGenerateCouponsResponse> {
		const response = await api.post(`/api/v1/dashboard/venues/${venueId}/coupons/bulk-generate`, data)
		return response.data
	},
}

export default couponService
