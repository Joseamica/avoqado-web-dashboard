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
	pendingOrderCount: number  // Count of pay-later orders
	pendingBalance: number      // Total balance pending
	// Referral program fields (Plan 1 backend additions)
	referralCode?: string | null
	referralCount?: number
	referralTier?: 'TIER_1' | 'TIER_2' | 'TIER_3' | null
	tierUnlockedAt?: string | null
	referredByCustomerId?: string | null
	referredByCustomer?: {
		id: string
		firstName: string | null
		lastName: string | null
	} | null
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
	customerCount?: number // Backend returns this instead of _count
	_count?: {
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

	// ── Mecánica de SELLOS ──────────────────────────────────────────────────
	// 🔴 Banderas INDEPENDIENTES de los puntos, no un modo exclusivo: un gimnasio
	// puede querer puntos por gasto Y paquetes de clases a la vez.
	stampsEnabled: boolean
	/** Cuántos sellos pide una cartilla nueva. Al abrirse se congela en la cartilla. */
	stampsRequired: number
	/** Tope por cliente por día, contado en la zona horaria del negocio. 0 = sin tope. */
	maxStampsPerDay: number
	stampRewardType: 'FREE_PRODUCT' | 'FIXED_AMOUNT' | 'PERCENTAGE'
	/** Pesos o porcentaje según el tipo. Null cuando el premio es un producto. */
	stampRewardValue: number | null
	stampRewardProductId: string | null
	/** Lo que el cliente lee en su tarjeta. */
	stampRewardLabel: string

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

/**
 * Aprobación de clientes — el negocio decide quién puede reservar en línea.
 * Sólo aplica cuando `requireCustomerApproval` está prendido en Ajustes de Reservaciones.
 */
export type CustomerApprovalStatus = 'APPROVED' | 'PENDING' | 'REJECTED'

export interface CustomerAwaitingApproval {
	id: string
	firstName: string | null
	lastName: string | null
	email: string | null
	phone: string | null
	approvalStatus: CustomerApprovalStatus
	/** Write-CAS: viaja de vuelta en la decisión para no pisar a quien decidió primero. */
	approvalVersion: number
	approvalRequestedAt: string | null
	accountActivatedAt: string | null
	createdAt: string
}

/**
 * 🔴 Meta PROPIA, no `PaginationMeta`.
 *
 * El endpoint devuelve `{ page, pageSize, total }` — no el shape de las listas viejas
 * (`totalCount`, `currentPage`, `totalPages`, `hasNextPage`…). Reusar `PaginationMeta` "porque
 * es paginado" tipaba una mentira: el conteo salía `undefined` en pantalla.
 */
export interface CustomerApprovalPaginationMeta {
	page: number
	pageSize: number
	total: number
}

export interface CustomersAwaitingApprovalResponse {
	data: CustomerAwaitingApproval[]
	meta: CustomerApprovalPaginationMeta
}

export interface CustomerApprovalDecisionResponse {
	approvalStatus: CustomerApprovalStatus
	approvalVersion: number
	/** `false` = ya estaba así; la decisión fue idempotente y no se avisó a nadie de nuevo. */
	changed: boolean
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
