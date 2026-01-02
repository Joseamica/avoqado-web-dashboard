import api from '@/api'
import type {
	Customer,
	CustomerWithOrders,
	CustomerGroup,
	CustomerStats,
	CustomerGroupStats,
	PaginatedCustomersResponse,
	PaginatedCustomerGroupsResponse,
	CreateCustomerRequest,
	UpdateCustomerRequest,
	CreateCustomerGroupRequest,
	UpdateCustomerGroupRequest,
	AssignCustomersRequest,
	AssignCustomersResponse,
	RemoveCustomersResponse,
} from '@/types/customer'

// Customer query parameters
export interface CustomerQueryParams {
	page?: number
	pageSize?: number
	search?: string
	customerGroupId?: string
	noGroup?: boolean
	sortBy?: 'createdAt' | 'totalSpent' | 'visitCount' | 'lastVisit'
	sortOrder?: 'asc' | 'desc'
	hasPendingBalance?: boolean
}

// Customer Group query parameters
export interface CustomerGroupQueryParams {
	page?: number
	pageSize?: number
	active?: boolean
}

// Customer Service
export const customerService = {
	// ==================== CUSTOMERS ====================

	// Get customers with pagination, search, and filters
	async getCustomers(venueId: string, params: CustomerQueryParams = {}): Promise<PaginatedCustomersResponse> {
		const searchParams = new URLSearchParams()

		if (params.page) searchParams.append('page', params.page.toString())
		if (params.pageSize) searchParams.append('pageSize', params.pageSize.toString())
		if (params.search) searchParams.append('search', params.search)
		if (params.customerGroupId) searchParams.append('customerGroupId', params.customerGroupId)
		if (params.noGroup) searchParams.append('noGroup', 'true')
		if (params.sortBy) searchParams.append('sortBy', params.sortBy)
		if (params.sortOrder) searchParams.append('sortOrder', params.sortOrder)
		if (params.hasPendingBalance) searchParams.append('hasPendingBalance', 'true')

		const queryString = searchParams.toString()
		const url = `/api/v1/dashboard/venues/${venueId}/customers${queryString ? `?${queryString}` : ''}`

		const response = await api.get(url)
		return response.data
	},

	// Get customer statistics
	async getCustomerStats(venueId: string): Promise<CustomerStats> {
		const response = await api.get(`/api/v1/dashboard/venues/${venueId}/customers/stats`)
		return response.data
	},

	// Get specific customer with orders
	async getCustomer(venueId: string, customerId: string): Promise<CustomerWithOrders> {
		const response = await api.get(`/api/v1/dashboard/venues/${venueId}/customers/${customerId}`)
		return response.data
	},

	// Create new customer
	async createCustomer(venueId: string, data: CreateCustomerRequest): Promise<Customer> {
		const response = await api.post(`/api/v1/dashboard/venues/${venueId}/customers`, data)
		return response.data
	},

	// Update customer
	async updateCustomer(venueId: string, customerId: string, data: UpdateCustomerRequest): Promise<Customer> {
		const response = await api.put(`/api/v1/dashboard/venues/${venueId}/customers/${customerId}`, data)
		return response.data
	},

	// Delete customer
	async deleteCustomer(venueId: string, customerId: string): Promise<void> {
		await api.delete(`/api/v1/dashboard/venues/${venueId}/customers/${customerId}`)
	},

	// Settle customer pending balance (mark pay-later orders as paid)
	async settleBalance(
		venueId: string,
		customerId: string,
		notes?: string
	): Promise<{ settledOrderCount: number; settledAmount: number; message: string }> {
		const response = await api.post(`/api/v1/dashboard/venues/${venueId}/customers/${customerId}/settle-balance`, {
			notes,
		})
		return response.data
	},

	// ==================== CUSTOMER GROUPS ====================

	// Get customer groups with pagination
	async getCustomerGroups(venueId: string, params: CustomerGroupQueryParams = {}): Promise<PaginatedCustomerGroupsResponse> {
		const searchParams = new URLSearchParams()

		if (params.page) searchParams.append('page', params.page.toString())
		if (params.pageSize) searchParams.append('pageSize', params.pageSize.toString())
		if (params.active !== undefined) searchParams.append('active', params.active.toString())

		const queryString = searchParams.toString()
		const url = `/api/v1/dashboard/venues/${venueId}/customer-groups${queryString ? `?${queryString}` : ''}`

		const response = await api.get(url)
		return response.data
	},

	// Get specific customer group
	async getCustomerGroup(venueId: string, groupId: string): Promise<CustomerGroup> {
		const response = await api.get(`/api/v1/dashboard/venues/${venueId}/customer-groups/${groupId}`)
		return response.data
	},

	// Get customer group statistics
	async getCustomerGroupStats(venueId: string, groupId: string): Promise<CustomerGroupStats> {
		const response = await api.get(`/api/v1/dashboard/venues/${venueId}/customer-groups/${groupId}/stats`)
		return response.data
	},

	// Create new customer group
	async createCustomerGroup(venueId: string, data: CreateCustomerGroupRequest): Promise<CustomerGroup> {
		const response = await api.post(`/api/v1/dashboard/venues/${venueId}/customer-groups`, data)
		return response.data
	},

	// Update customer group
	async updateCustomerGroup(venueId: string, groupId: string, data: UpdateCustomerGroupRequest): Promise<CustomerGroup> {
		const response = await api.put(`/api/v1/dashboard/venues/${venueId}/customer-groups/${groupId}`, data)
		return response.data
	},

	// Delete customer group
	async deleteCustomerGroup(venueId: string, groupId: string): Promise<void> {
		await api.delete(`/api/v1/dashboard/venues/${venueId}/customer-groups/${groupId}`)
	},

	// Assign customers to group
	async assignCustomersToGroup(venueId: string, groupId: string, data: AssignCustomersRequest): Promise<AssignCustomersResponse> {
		const response = await api.post(`/api/v1/dashboard/venues/${venueId}/customer-groups/${groupId}/assign`, data)
		return response.data
	},

	// Remove customers from group
	async removeCustomersFromGroup(venueId: string, groupId: string, data: AssignCustomersRequest): Promise<RemoveCustomersResponse> {
		const response = await api.post(`/api/v1/dashboard/venues/${venueId}/customer-groups/${groupId}/remove`, data)
		return response.data
	},
}

export default customerService
