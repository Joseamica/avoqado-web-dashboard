import api from '@/api'
import type { OperatingHours } from '@/types/reservation'

// ==========================================
// Public Booking Service (Unauthenticated)
// Uses venueSlug (not venueId) — no auth needed
// ==========================================

export interface PublicVenueInfo {
	name: string
	slug: string
	logo: string | null
	type: string
	address: string | null
	phone: string | null
	timezone: string
	products: {
		id: string
		name: string
		price: number | null
		duration: number | null
		eventCapacity: number | null
	}[]
	publicBooking: {
		enabled: boolean
		requirePhone: boolean
		requireEmail: boolean
	}
	operatingHours?: OperatingHours
}

export interface PublicSlot {
	startsAt: string
	endsAt: string
	available: boolean
}

export interface PublicAvailabilityResponse {
	date: string
	slots: PublicSlot[]
}

export interface PublicCreateReservationRequest {
	startsAt: string
	endsAt: string
	duration: number
	guestName: string
	guestPhone: string
	guestEmail?: string
	partySize?: number
	productId?: string
	specialRequests?: string
}

export interface PublicBookingResult {
	confirmationCode: string
	cancelSecret: string
	startsAt: string
	endsAt: string
	status: string
	depositRequired: boolean
	depositAmount: number | null
}

export interface PublicReservationDetail {
	confirmationCode: string
	status: string
	startsAt: string
	endsAt: string
	duration: number
	partySize: number
	guestName: string | null
	product: { id: string; name: string; price: number | null } | null
	assignedStaff: { firstName: string; lastName: string } | null
	table: { number: string } | null
	specialRequests: string | null
	depositAmount: number | null
	depositStatus: string | null
}

export interface PublicCancelResult {
	confirmationCode: string
	status: string
	cancelledAt: string
	depositStatus: string | null
}

export interface PublicAvailabilityParams {
	date: string
	duration?: number
	partySize?: number
	productId?: string
}

export const publicBookingService = {
	async getVenueInfo(venueSlug: string): Promise<PublicVenueInfo> {
		const response = await api.get(`/api/v1/public/venues/${venueSlug}/info`)
		return response.data
	},

	async getAvailability(venueSlug: string, params: PublicAvailabilityParams): Promise<PublicAvailabilityResponse> {
		const searchParams = new URLSearchParams()
		searchParams.append('date', params.date)
		if (params.duration) searchParams.append('duration', params.duration.toString())
		if (params.partySize) searchParams.append('partySize', params.partySize.toString())
		if (params.productId) searchParams.append('productId', params.productId)

		const response = await api.get(`/api/v1/public/venues/${venueSlug}/availability?${searchParams.toString()}`)
		return response.data
	},

	async createReservation(venueSlug: string, data: PublicCreateReservationRequest): Promise<PublicBookingResult> {
		const response = await api.post(`/api/v1/public/venues/${venueSlug}/reservations`, data)
		return response.data
	},

	async getReservation(venueSlug: string, cancelSecret: string): Promise<PublicReservationDetail> {
		const response = await api.get(`/api/v1/public/venues/${venueSlug}/reservations/${cancelSecret}`)
		return response.data
	},

	async cancelReservation(venueSlug: string, cancelSecret: string, reason?: string): Promise<PublicCancelResult> {
		const response = await api.post(`/api/v1/public/venues/${venueSlug}/reservations/${cancelSecret}/cancel`, { reason })
		return response.data
	},
}

export default publicBookingService
