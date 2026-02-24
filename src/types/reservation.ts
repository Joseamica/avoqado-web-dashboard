// Reservation Types

export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'
export type ReservationChannel = 'DASHBOARD' | 'WEB' | 'PHONE' | 'WHATSAPP' | 'APP' | 'WALK_IN' | 'THIRD_PARTY'
export type DepositStatus = 'PENDING' | 'PAID' | 'REFUNDED'
export type WaitlistStatus = 'WAITING' | 'NOTIFIED' | 'PROMOTED' | 'CANCELLED' | 'EXPIRED'

export interface Reservation {
	id: string
	venueId: string
	confirmationCode: string
	cancelSecret: string
	status: ReservationStatus
	channel: ReservationChannel
	startsAt: string
	endsAt: string
	duration: number
	customerId: string | null
	customer: {
		id: string
		firstName: string
		lastName: string
		phone: string | null
		email: string | null
	} | null
	guestName: string | null
	guestPhone: string | null
	guestEmail: string | null
	partySize: number
	tableId: string | null
	table: {
		id: string
		number: string
		capacity: number
	} | null
	productId: string | null
	product: {
		id: string
		name: string
		price: number | null
	} | null
	classSessionId: string | null
	assignedStaffId: string | null
	assignedStaff: {
		id: string
		firstName: string
		lastName: string
	} | null
	createdById: string | null
	createdBy: {
		id: string
		firstName: string
		lastName: string
	} | null
	depositAmount: number | null
	depositStatus: DepositStatus | null
	confirmedAt: string | null
	checkedInAt: string | null
	completedAt: string | null
	cancelledAt: string | null
	noShowAt: string | null
	cancelledBy: string | null
	cancellationReason: string | null
	specialRequests: string | null
	internalNotes: string | null
	tags: string[]
	statusLog: StatusLogEntry[] | null
	createdAt: string
	updatedAt: string
}

export interface StatusLogEntry {
	status: ReservationStatus
	at: string
	by: string | null
	reason?: string
}

export interface WaitlistEntry {
	id: string
	venueId: string
	customerId: string | null
	customer: {
		id: string
		firstName: string
		lastName: string
		phone: string | null
	} | null
	guestName: string | null
	guestPhone: string | null
	partySize: number
	desiredStartAt: string
	desiredEndAt: string | null
	status: WaitlistStatus
	position: number
	notifiedAt: string | null
	responseDeadline: string | null
	promotedReservationId: string | null
	promotedReservation: {
		id: string
		confirmationCode: string
		status: ReservationStatus
	} | null
	notes: string | null
	createdAt: string
	updatedAt: string
}

export interface ReservationStats {
	total: number
	byStatus: Record<ReservationStatus, number>
	byChannel: Record<ReservationChannel, number>
	noShowRate: number
}

export interface AvailableSlot {
	startsAt: string
	endsAt: string
	availableTables: { id: string; number: string; capacity: number }[]
	availableStaff: { id: string; firstName: string; lastName: string }[]
}

export interface DaySchedule {
	enabled: boolean
	ranges: { open: string; close: string }[]
}

export interface OperatingHours {
	monday: DaySchedule
	tuesday: DaySchedule
	wednesday: DaySchedule
	thursday: DaySchedule
	friday: DaySchedule
	saturday: DaySchedule
	sunday: DaySchedule
}

export interface ReservationSettings {
	scheduling: {
		slotIntervalMin: number
		defaultDurationMin: number
		autoConfirm: boolean
		maxAdvanceDays: number
		minNoticeMin: number
		noShowGraceMin: number
		pacingMaxPerSlot: number | null
		onlineCapacityPercent: number
	}
	deposits: {
		enabled: boolean
		mode: 'none' | 'card_hold' | 'deposit' | 'prepaid'
		percentageOfTotal: number | null
		fixedAmount: number | null
		requiredForPartySizeGte: number | null
		paymentWindowHrs: number | null
	}
	cancellation: {
		allowCustomerCancel: boolean
		minHoursBeforeStart: number | null
		forfeitDeposit: boolean
		noShowFeePercent: number | null
	}
	waitlist: {
		enabled: boolean
		maxSize: number
		priorityMode: 'fifo' | 'party_size' | 'broadcast'
		notifyWindowMin: number
	}
	reminders: {
		enabled: boolean
		channels: string[]
		minutesBefore: number[]
	}
	publicBooking: {
		enabled: boolean
		requirePhone: boolean
		requireEmail: boolean
	}
	operatingHours: OperatingHours
}

export interface PaginatedReservationsResponse {
	data: Reservation[]
	meta: {
		total: number
		page: number
		pageSize: number
		totalPages: number
	}
}

export interface CreateReservationRequest {
	startsAt: string
	endsAt: string
	duration: number
	channel?: ReservationChannel
	customerId?: string
	guestName?: string
	guestPhone?: string
	guestEmail?: string
	partySize?: number
	tableId?: string
	productId?: string
	assignedStaffId?: string
	specialRequests?: string
	internalNotes?: string
	tags?: string[]
}

export interface UpdateReservationRequest {
	startsAt?: string
	endsAt?: string
	duration?: number
	guestName?: string
	guestPhone?: string
	guestEmail?: string | null
	partySize?: number
	tableId?: string | null
	productId?: string | null
	assignedStaffId?: string | null
	specialRequests?: string | null
	internalNotes?: string | null
	tags?: string[]
}

export interface RescheduleRequest {
	startsAt: string
	endsAt: string
}
