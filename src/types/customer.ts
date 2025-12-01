// Customer Types

export interface Customer {
	id: string
	venueId: string
	firstName: string
	lastName: string
	email: string
	phone: string
	totalSpent: number
	averageOrderValue: number
	visitCount: number
	lastVisit: string | null
	loyaltyPoints: number
	customerGroupId: string | null
	customerGroup: CustomerGroupBasic | null
	createdAt: string
	updatedAt: string
}

export interface CustomerGroupBasic {
	id: string
	name: string
	color: string
}

export interface CustomerGroup {
	id: string
	venueId: string
	name: string
	description: string | null
	color: string
	autoAssignRules: unknown | null
	active: boolean
	_count: {
		customers: number
	}
	createdAt: string
	updatedAt: string
}

export interface CustomerWithOrders extends Customer {
	orders: CustomerOrder[]
}

export interface CustomerOrder {
	id: string
	orderNumber: string
	total: number
	status: string
	createdAt: string
}

// Loyalty Types

export interface LoyaltyConfig {
	id: string
	venueId: string
	pointsPerDollar: number
	pointsPerVisit: number
	redemptionRate: number
	minPointsRedeem: number
	pointsExpireDays: number | null
	active: boolean
	createdAt: string
	updatedAt: string
}

export type LoyaltyTransactionType = 'EARN' | 'REDEEM' | 'EXPIRE' | 'ADJUST'

export interface LoyaltyTransaction {
	id: string
	customerId: string
	type: LoyaltyTransactionType
	points: number
	reason: string | null
	orderId: string | null
	order: {
		id: string
		orderNumber: string
		total: number
		createdAt: string
	} | null
	createdById: string | null
	createdBy: {
		id: string
		name: string
	} | null
	createdAt: string
}

// Paginated Responses

export interface PaginationMeta {
	totalCount: number
	pageSize: number
	currentPage: number
	totalPages: number
	hasNextPage: boolean
	hasPrevPage: boolean
}

export interface PaginatedCustomersResponse {
	data: Customer[]
	meta: PaginationMeta
}

export interface PaginatedCustomerGroupsResponse {
	data: CustomerGroup[]
	meta: PaginationMeta
}

export interface PaginatedLoyaltyTransactionsResponse {
	data: LoyaltyTransaction[]
	meta: PaginationMeta
	currentBalance: number
}

// Customer Stats

export interface CustomerStats {
	totalCustomers: number
	newCustomersThisMonth: number
	averageOrderValue: number
	totalLifetimeValue: number
	topCustomers: Array<{
		id: string
		firstName: string
		lastName: string
		totalSpent: number
		visitCount: number
	}>
}

export interface CustomerGroupStats {
	totalCustomers: number
	averageOrderValue: number
	totalRevenue: number
	topCustomers: Array<{
		id: string
		firstName: string
		lastName: string
		totalSpent: number
		visitCount: number
	}>
}

// Request DTOs

export interface CreateCustomerRequest {
	firstName: string
	lastName: string
	email: string
	phone: string
	customerGroupId?: string
}

export interface UpdateCustomerRequest {
	firstName?: string
	lastName?: string
	email?: string
	phone?: string
	customerGroupId?: string | null
}

export interface CreateCustomerGroupRequest {
	name: string
	description?: string
	color: string
	autoAssignRules?: unknown
	active?: boolean
}

export interface UpdateCustomerGroupRequest {
	name?: string
	description?: string
	color?: string
	autoAssignRules?: unknown
	active?: boolean
}

export interface UpdateLoyaltyConfigRequest {
	pointsPerDollar?: number
	pointsPerVisit?: number
	redemptionRate?: number
	minPointsRedeem?: number
	pointsExpireDays?: number | null
	active?: boolean
}

export interface RedeemPointsRequest {
	points: number
	orderId: string
}

export interface RedeemPointsResponse {
	pointsRedeemed: number
	discountAmount: number
	newBalance: number
}

export interface AdjustPointsRequest {
	points: number
	reason: string
}

export interface AdjustPointsResponse {
	newBalance: number
}

export interface CalculatePointsRequest {
	amount: number
}

export interface CalculatePointsResponse {
	amount: number
	points: number
}

export interface CalculateDiscountRequest {
	points: number
	orderTotal: number
}

export interface CalculateDiscountResponse {
	points: number
	discountAmount: number
}

export interface LoyaltyBalanceResponse {
	customerId: string
	loyaltyPoints: number
	config: {
		redemptionRate: number
		minPointsRedeem: number
	}
}

export interface AssignCustomersRequest {
	customerIds: string[]
}

export interface AssignCustomersResponse {
	message: string
	assignedCount: number
}

export interface RemoveCustomersResponse {
	message: string
	removedCount: number
}
