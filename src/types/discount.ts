// Discount types
export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'COMP'
export type DiscountScope =
	| 'ORDER'
	| 'ITEM'
	| 'CATEGORY'
	| 'MODIFIER'
	| 'MODIFIER_GROUP'
	| 'CUSTOMER_GROUP'
	| 'QUANTITY'

export interface Discount {
	id: string
	venueId: string
	name: string
	description?: string
	type: DiscountType
	value: number
	scope: DiscountScope

	// Targets
	targetItemIds?: string[]
	targetCategoryIds?: string[]
	targetModifierIds?: string[]
	targetModifierGroupIds?: string[]
	customerGroupId?: string

	// Automatic application
	isAutomatic: boolean
	priority: number

	// Rules
	minPurchaseAmount?: number
	maxDiscountAmount?: number
	minQuantity?: number

	// BOGO (Buy One Get One)
	buyQuantity?: number
	getQuantity?: number
	getDiscountPercent?: number
	buyItemIds?: string[]
	getItemIds?: string[]

	// Time-based restrictions
	validFrom?: string
	validUntil?: string
	daysOfWeek?: number[]
	timeFrom?: string
	timeUntil?: string

	// Usage limits
	maxTotalUses?: number
	maxUsesPerCustomer?: number
	currentUses: number

	// Comp-specific
	requiresApproval?: boolean
	compReason?: string

	// Tax handling
	applyBeforeTax: boolean
	modifyTaxBasis: boolean

	// Stacking
	isStackable: boolean
	stackPriority: number

	active: boolean
	createdAt: string
	updatedAt: string
}

export interface Coupon {
	id: string
	venueId: string
	discountId: string
	discount?: Discount
	code: string
	maxUses?: number
	maxUsesPerCustomer?: number
	minPurchaseAmount?: number
	currentUses: number
	validFrom?: string
	validUntil?: string
	active: boolean
	createdAt: string
	updatedAt: string
}

export interface CouponRedemption {
	id: string
	couponId: string
	coupon?: Coupon
	orderId: string
	customerId?: string
	amountSaved: number
	createdAt: string
}

export interface CouponValidationResult {
	valid: boolean
	coupon?: Coupon
	discount?: Discount
	error?: string
	errorCode?:
		| 'NOT_FOUND'
		| 'INACTIVE'
		| 'EXPIRED'
		| 'NOT_STARTED'
		| 'USAGE_LIMIT'
		| 'MIN_PURCHASE'
		| 'CUSTOMER_LIMIT'
}

// Stats types
export interface DiscountStats {
	totalDiscounts: number
	activeDiscounts: number
	automaticDiscounts: number
	totalRedemptions: number
	totalSaved: number
	byType: {
		PERCENTAGE: number
		FIXED_AMOUNT: number
		COMP: number
	}
	byScope: {
		ORDER: number
		ITEM: number
		CATEGORY: number
		MODIFIER: number
		MODIFIER_GROUP: number
		CUSTOMER_GROUP: number
		QUANTITY: number
	}
}

export interface CouponStats {
	totalCoupons: number
	activeCoupons: number
	totalRedemptions: number
	totalSaved: number
	averageSaved: number
	redemptionRate: number
}

// Request types
export interface CreateDiscountRequest {
	name: string
	description?: string
	type: DiscountType
	value: number
	scope: DiscountScope
	targetItemIds?: string[]
	targetCategoryIds?: string[]
	targetModifierIds?: string[]
	targetModifierGroupIds?: string[]
	customerGroupId?: string
	isAutomatic?: boolean
	priority?: number
	minPurchaseAmount?: number
	maxDiscountAmount?: number
	minQuantity?: number
	buyQuantity?: number
	getQuantity?: number
	getDiscountPercent?: number
	buyItemIds?: string[]
	getItemIds?: string[]
	validFrom?: string
	validUntil?: string
	daysOfWeek?: number[]
	timeFrom?: string
	timeUntil?: string
	maxTotalUses?: number
	maxUsesPerCustomer?: number
	requiresApproval?: boolean
	compReason?: string
	applyBeforeTax?: boolean
	modifyTaxBasis?: boolean
	isStackable?: boolean
	stackPriority?: number
	active?: boolean
}

export type UpdateDiscountRequest = Partial<CreateDiscountRequest>

export interface CreateCouponRequest {
	discountId: string
	code: string
	maxUses?: number
	maxUsesPerCustomer?: number
	minPurchaseAmount?: number
	validFrom?: string
	validUntil?: string
	active?: boolean
}

export type UpdateCouponRequest = Partial<Omit<CreateCouponRequest, 'discountId'>>

export interface BulkGenerateCouponsRequest {
	discountId: string
	prefix?: string
	quantity: number
	codeLength?: number
	maxUsesPerCode?: number
	maxUsesPerCustomer?: number
	validFrom?: string
	validUntil?: string
}

export interface BulkGenerateCouponsResponse {
	codes: string[]
	count: number
}

export interface ValidateCouponRequest {
	code: string
	orderTotal?: number
	customerId?: string
}

export interface RedeemCouponRequest {
	orderId: string
	amountSaved: number
	customerId?: string
}

export interface AssignDiscountToCustomerRequest {
	customerId: string
	validFrom?: string
	validUntil?: string
	maxUses?: number
}

// Paginated response types
export interface PaginationMeta {
	page: number
	pageSize: number
	totalCount: number
	totalPages: number
}

export interface PaginatedDiscountsResponse {
	data: Discount[]
	meta: PaginationMeta
}

export interface PaginatedCouponsResponse {
	data: Coupon[]
	meta: PaginationMeta
}

export interface PaginatedRedemptionsResponse {
	data: CouponRedemption[]
	meta: PaginationMeta
}

// Query parameters
export interface DiscountQueryParams {
	page?: number
	pageSize?: number
	search?: string
	type?: DiscountType
	scope?: DiscountScope
	isAutomatic?: boolean
	active?: boolean
}

export interface CouponQueryParams {
	page?: number
	pageSize?: number
	search?: string
	discountId?: string
	active?: boolean
}

export interface RedemptionQueryParams {
	page?: number
	pageSize?: number
	couponId?: string
	customerId?: string
	startDate?: string
	endDate?: string
}
