export type CreditPurchaseStatus = 'ACTIVE' | 'EXHAUSTED' | 'EXPIRED' | 'REFUNDED'
export type CreditTransactionType = 'PURCHASE' | 'REDEEM' | 'EXPIRE' | 'REFUND' | 'ADJUST'

export interface CreditPackItem {
	id: string
	productId: string
	product: { id: string; name: string; type: string; price: number; imageUrl?: string; duration?: number }
	/** Un renglón Ilimitado trae 99,999 por dentro: nunca se enseña (D679). */
	quantity: number
	unlimited?: boolean
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
	/** Sólo en compras con un Ilimitado (D679): faltas contadas por reserva; no castigan. */
	faltas?: { noLlego: number; cancelTarde: number }
	createdAt: string
}

export interface CreditItemBalance {
	id: string
	productId: string
	product: { id: string; name: string; type: string; imageUrl?: string }
	originalQuantity: number
	remainingQuantity: number
	/** Ilimitado (D679): las cantidades son 99,999 por dentro y no se enseñan. */
	unlimited?: boolean
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
	creditItemBalance?: { unlimited?: boolean; product: { id: string; name: string } }
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
	/** Cada renglón manda `unlimited` (true o false): así el SERVIDOR sabe que es un panel nuevo (D679, W4). Un Ilimitado no
	 * manda cantidad. */
	items: { productId: string; quantity?: number; unlimited: boolean }[]
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
