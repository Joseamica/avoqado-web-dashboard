export type CreditPurchaseStatus = 'ACTIVE' | 'EXHAUSTED' | 'EXPIRED' | 'REFUNDED'
export type CreditTransactionType = 'PURCHASE' | 'REDEEM' | 'EXPIRE' | 'REFUND' | 'ADJUST'

export interface CreditPackItem {
	id: string
	productId: string
	product: { id: string; name: string; type: string; price: number; imageUrl?: string; duration?: number }
	quantity: number
}

export interface CreditPack {
	id: string
	venueId: string
	name: string
	description?: string
	price: number
	currency: string
	validityDays?: number
	maxPerCustomer?: number
	active: boolean
	displayOrder: number
	stripeProductId?: string
	stripePriceId?: string
	items: CreditPackItem[]
	createdAt: string
	updatedAt: string
}

export interface CreditPackPurchase {
	id: string
	venueId: string
	customerId: string
	customer: { id: string; firstName?: string; lastName?: string; email?: string; phone?: string }
	creditPackId: string
	creditPack: { name: string }
	purchasedAt: string
	expiresAt?: string
	status: CreditPurchaseStatus
	amountPaid: number
	itemBalances: CreditItemBalance[]
	createdAt: string
}

export interface CreditItemBalance {
	id: string
	productId: string
	product: { id: string; name: string; type: string; imageUrl?: string }
	originalQuantity: number
	remainingQuantity: number
}

export interface CreditTransaction {
	id: string
	venueId: string
	customerId: string
	customer: { firstName?: string; lastName?: string; email?: string; phone?: string }
	type: CreditTransactionType
	quantity: number
	reason?: string
	reservationId?: string
	creditItemBalance?: { product: { id: string; name: string } }
	creditPackPurchase?: { creditPack: { name: string } }
	createdBy?: { staff: { firstName: string; lastName: string } } | null
	createdAt: string
}

export interface CreateCreditPackRequest {
	name: string
	description?: string
	price: number
	currency?: string
	validityDays?: number
	maxPerCustomer?: number
	displayOrder?: number
	items: { productId: string; quantity: number }[]
}

export type UpdateCreditPackRequest = Partial<CreateCreditPackRequest> & { active?: boolean }

export interface PurchaseQueryParams {
	customerId?: string
	status?: CreditPurchaseStatus
	page?: number
	limit?: number
}

export interface TransactionQueryParams {
	customerId?: string
	type?: CreditTransactionType
	page?: number
	limit?: number
}

export interface PaginatedResponse<T> {
	data: T[]
	meta: { page: number; limit: number; total: number; totalPages: number }
}
