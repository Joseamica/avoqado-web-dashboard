import api from '@/api'
import type {
	CreditPack,
	CreditPackPurchase,
	CreditTransaction,
	CreateCreditPackRequest,
	UpdateCreditPackRequest,
	PurchaseQueryParams,
	TransactionQueryParams,
	PaginatedResponse,
} from '@/types/creditPack'

const buildPurchaseQueryString = (params: PurchaseQueryParams): string => {
	const searchParams = new URLSearchParams()
	if (params.page) searchParams.append('page', params.page.toString())
	if (params.limit) searchParams.append('limit', params.limit.toString())
	if (params.customerId) searchParams.append('customerId', params.customerId)
	if (params.status) searchParams.append('status', params.status)
	const qs = searchParams.toString()
	return qs ? `?${qs}` : ''
}

const buildTransactionQueryString = (params: TransactionQueryParams): string => {
	const searchParams = new URLSearchParams()
	if (params.page) searchParams.append('page', params.page.toString())
	if (params.limit) searchParams.append('limit', params.limit.toString())
	if (params.customerId) searchParams.append('customerId', params.customerId)
	if (params.type) searchParams.append('type', params.type)
	const qs = searchParams.toString()
	return qs ? `?${qs}` : ''
}

export const creditPackService = {
	// ==================== CRUD ====================

	async getCreditPacks(venueId: string): Promise<CreditPack[]> {
		const response = await api.get(`/api/v1/dashboard/venues/${venueId}/credit-packs`)
		return response.data
	},

	async getCreditPack(venueId: string, packId: string): Promise<CreditPack> {
		const response = await api.get(`/api/v1/dashboard/venues/${venueId}/credit-packs/${packId}`)
		return response.data
	},

	async createCreditPack(venueId: string, data: CreateCreditPackRequest): Promise<CreditPack> {
		const response = await api.post(`/api/v1/dashboard/venues/${venueId}/credit-packs`, data)
		return response.data
	},

	async updateCreditPack(venueId: string, packId: string, data: UpdateCreditPackRequest): Promise<CreditPack> {
		const response = await api.patch(`/api/v1/dashboard/venues/${venueId}/credit-packs/${packId}`, data)
		return response.data
	},

	async deactivateCreditPack(venueId: string, packId: string): Promise<void> {
		await api.delete(`/api/v1/dashboard/venues/${venueId}/credit-packs/${packId}`)
	},

	// ==================== PURCHASES ====================

	async getPurchases(venueId: string, params: PurchaseQueryParams = {}): Promise<PaginatedResponse<CreditPackPurchase>> {
		const qs = buildPurchaseQueryString(params)
		const response = await api.get(`/api/v1/dashboard/venues/${venueId}/credit-packs/purchases${qs}`)
		const raw = response.data
		// Backend returns { purchases, total, page, limit, totalPages }
		return {
			data: raw.purchases ?? raw.data ?? [],
			meta: { page: raw.page ?? 1, limit: raw.limit ?? 20, total: raw.total ?? 0, totalPages: raw.totalPages ?? 1 },
		}
	},

	async getCustomerPurchases(venueId: string, customerId: string): Promise<CreditPackPurchase[]> {
		const response = await api.get(`/api/v1/dashboard/venues/${venueId}/credit-packs/purchases/${customerId}`)
		return response.data
	},

	// ==================== TRANSACTIONS ====================

	async getTransactions(venueId: string, params: TransactionQueryParams = {}): Promise<PaginatedResponse<CreditTransaction>> {
		const qs = buildTransactionQueryString(params)
		const response = await api.get(`/api/v1/dashboard/venues/${venueId}/credit-packs/transactions${qs}`)
		const raw = response.data
		// Backend returns { transactions, total, page, limit, totalPages }
		return {
			data: raw.transactions ?? raw.data ?? [],
			meta: { page: raw.page ?? 1, limit: raw.limit ?? 20, total: raw.total ?? 0, totalPages: raw.totalPages ?? 1 },
		}
	},

	// ==================== BALANCE OPERATIONS ====================

	async redeemItem(venueId: string, balanceId: string, data: { quantity: number; reservationId?: string }): Promise<void> {
		await api.post(`/api/v1/dashboard/venues/${venueId}/credit-packs/balances/${balanceId}/redeem`, data)
	},

	async adjustBalance(venueId: string, balanceId: string, data: { quantity: number; reason: string }): Promise<void> {
		await api.post(`/api/v1/dashboard/venues/${venueId}/credit-packs/balances/${balanceId}/adjust`, data)
	},

	async refundPurchase(venueId: string, purchaseId: string, data: { reason: string }): Promise<void> {
		await api.post(`/api/v1/dashboard/venues/${venueId}/credit-packs/purchases/${purchaseId}/refund`, data)
	},
}

export default creditPackService
