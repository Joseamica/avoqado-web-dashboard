import api from '@/api'
import type {
	PaginatedReservationsResponse,
	Reservation,
	ReservationStats,
	AvailableSlot,
	WaitlistEntry,
	ReservationSettings,
	CreateReservationRequest,
	UpdateReservationRequest,
	RescheduleRequest,
} from '@/types/reservation'

// Query parameters
export interface ReservationQueryParams {
	page?: number
	pageSize?: number
	status?: string // comma-separated for multiple
	dateFrom?: string
	dateTo?: string
	tableId?: string
	staffId?: string
	productId?: string
	channel?: string
	search?: string
}

export interface AvailabilityQueryParams {
	date: string
	duration?: number
	partySize?: number
	tableId?: string
	staffId?: string
	productId?: string
}

export const reservationService = {
	// ==================== RESERVATIONS ====================

	async getReservations(venueId: string, params: ReservationQueryParams = {}): Promise<PaginatedReservationsResponse> {
		const searchParams = new URLSearchParams()

		if (params.page) searchParams.append('page', params.page.toString())
		if (params.pageSize) searchParams.append('pageSize', params.pageSize.toString())
		if (params.status) searchParams.append('status', params.status)
		if (params.dateFrom) searchParams.append('dateFrom', params.dateFrom)
		if (params.dateTo) searchParams.append('dateTo', params.dateTo)
		if (params.tableId) searchParams.append('tableId', params.tableId)
		if (params.staffId) searchParams.append('staffId', params.staffId)
		if (params.productId) searchParams.append('productId', params.productId)
		if (params.channel) searchParams.append('channel', params.channel)
		if (params.search) searchParams.append('search', params.search)

		const queryString = searchParams.toString()
		const url = `/api/v1/dashboard/venues/${venueId}/reservations${queryString ? `?${queryString}` : ''}`

		const response = await api.get(url)
		return response.data
	},

	async getReservation(venueId: string, id: string): Promise<Reservation> {
		const response = await api.get(`/api/v1/dashboard/venues/${venueId}/reservations/${id}`)
		return response.data
	},

	async createReservation(venueId: string, data: CreateReservationRequest): Promise<Reservation> {
		const response = await api.post(`/api/v1/dashboard/venues/${venueId}/reservations`, data)
		return response.data
	},

	async updateReservation(venueId: string, id: string, data: UpdateReservationRequest): Promise<Reservation> {
		const response = await api.put(`/api/v1/dashboard/venues/${venueId}/reservations/${id}`, data)
		return response.data
	},

	async cancelReservation(venueId: string, id: string, reason?: string): Promise<Reservation> {
		const response = await api.delete(`/api/v1/dashboard/venues/${venueId}/reservations/${id}`, {
			data: reason ? { reason } : undefined,
		})
		return response.data
	},

	// ==================== STATE TRANSITIONS ====================

	async confirmReservation(venueId: string, id: string): Promise<Reservation> {
		const response = await api.post(`/api/v1/dashboard/venues/${venueId}/reservations/${id}/confirm`)
		return response.data
	},

	async checkIn(venueId: string, id: string): Promise<Reservation> {
		const response = await api.post(`/api/v1/dashboard/venues/${venueId}/reservations/${id}/check-in`)
		return response.data
	},

	async complete(venueId: string, id: string): Promise<Reservation> {
		const response = await api.post(`/api/v1/dashboard/venues/${venueId}/reservations/${id}/complete`)
		return response.data
	},

	async markNoShow(venueId: string, id: string): Promise<Reservation> {
		const response = await api.post(`/api/v1/dashboard/venues/${venueId}/reservations/${id}/no-show`)
		return response.data
	},

	async reschedule(venueId: string, id: string, data: RescheduleRequest): Promise<Reservation> {
		const response = await api.post(`/api/v1/dashboard/venues/${venueId}/reservations/${id}/reschedule`, data)
		return response.data
	},

	// ==================== STATS / CALENDAR / AVAILABILITY ====================

	async getStats(venueId: string, dateFrom: string, dateTo: string): Promise<ReservationStats> {
		const response = await api.get(
			`/api/v1/dashboard/venues/${venueId}/reservations/stats?dateFrom=${dateFrom}&dateTo=${dateTo}`,
		)
		return response.data
	},

	async getCalendar(
		venueId: string,
		dateFrom: string,
		dateTo: string,
		groupBy?: 'table' | 'staff',
	): Promise<{ reservations: Reservation[]; grouped?: Record<string, Reservation[]> }> {
		const params = new URLSearchParams({ dateFrom, dateTo })
		if (groupBy) params.append('groupBy', groupBy)
		const response = await api.get(`/api/v1/dashboard/venues/${venueId}/reservations/calendar?${params}`)
		return response.data
	},

	async getAvailability(
		venueId: string,
		params: AvailabilityQueryParams,
	): Promise<{ date: string; slots: AvailableSlot[] }> {
		const searchParams = new URLSearchParams({ date: params.date })
		if (params.duration) searchParams.append('duration', params.duration.toString())
		if (params.partySize) searchParams.append('partySize', params.partySize.toString())
		if (params.tableId) searchParams.append('tableId', params.tableId)
		if (params.staffId) searchParams.append('staffId', params.staffId)
		if (params.productId) searchParams.append('productId', params.productId)

		const response = await api.get(`/api/v1/dashboard/venues/${venueId}/reservations/availability?${searchParams}`)
		return response.data
	},

	// ==================== WAITLIST ====================

	async getWaitlist(venueId: string, status?: string): Promise<WaitlistEntry[]> {
		const url = status
			? `/api/v1/dashboard/venues/${venueId}/reservations/waitlist?status=${status}`
			: `/api/v1/dashboard/venues/${venueId}/reservations/waitlist`
		const response = await api.get(url)
		return response.data
	},

	async addToWaitlist(
		venueId: string,
		data: {
			customerId?: string
			guestName?: string
			guestPhone?: string
			partySize?: number
			desiredStartAt: string
			desiredEndAt?: string
			notes?: string
		},
	): Promise<WaitlistEntry> {
		const response = await api.post(`/api/v1/dashboard/venues/${venueId}/reservations/waitlist`, data)
		return response.data
	},

	async removeFromWaitlist(venueId: string, entryId: string): Promise<void> {
		await api.delete(`/api/v1/dashboard/venues/${venueId}/reservations/waitlist/${entryId}`)
	},

	async promoteWaitlist(venueId: string, entryId: string, reservationId: string): Promise<WaitlistEntry> {
		const response = await api.post(
			`/api/v1/dashboard/venues/${venueId}/reservations/waitlist/${entryId}/promote`,
			{ reservationId },
		)
		return response.data
	},

	// ==================== SETTINGS ====================

	async getSettings(venueId: string): Promise<ReservationSettings> {
		const response = await api.get(`/api/v1/dashboard/venues/${venueId}/reservations/settings`)
		return response.data
	},

	async updateSettings(venueId: string, data: Partial<ReservationSettings>): Promise<ReservationSettings> {
		const response = await api.put(`/api/v1/dashboard/venues/${venueId}/reservations/settings`, data)
		return response.data
	},
}

export default reservationService
