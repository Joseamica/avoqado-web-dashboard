import api from '@/api'

export type ClassSessionStatus = 'SCHEDULED' | 'CANCELLED' | 'COMPLETED'

export interface ClassSession {
  id: string
  venueId: string
  productId: string
  product: {
    id: string
    name: string
    price: number | null
    maxParticipants: number | null
  }
  startsAt: string
  endsAt: string
  capacity: number
  reservedCount: number
  status: ClassSessionStatus
  assignedStaffId: string | null
  assignedStaff: {
    id: string
    firstName: string
    lastName: string
  } | null
  internalNotes: string | null
  createdAt: string
  updatedAt: string
}

export interface ClassSessionAttendee {
  id: string
  confirmationCode: string
  status: string
  guestName: string | null
  guestPhone: string | null
  guestEmail: string | null
  partySize: number
  specialRequests: string | null
  createdAt: string
}

export interface CreateClassSessionDto {
  productId: string
  startsAt: string // ISO UTC
  endsAt: string // ISO UTC
  capacity: number
  assignedStaffId?: string | null
  internalNotes?: string | null
}

export interface UpdateClassSessionDto {
  startsAt?: string
  endsAt?: string
  capacity?: number
  assignedStaffId?: string | null
  internalNotes?: string | null
}

export interface ListClassSessionsParams {
  dateFrom: string // YYYY-MM-DD
  dateTo: string
  productId?: string
  status?: ClassSessionStatus
}

const classSessionService = {
  async getClassSessions(venueId: string, params: ListClassSessionsParams): Promise<ClassSession[]> {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/class-sessions`, { params })
    return response.data.data
  },

  async getClassSession(venueId: string, sessionId: string): Promise<ClassSession> {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/class-sessions/${sessionId}`)
    return response.data.data
  },

  async createClassSession(venueId: string, data: CreateClassSessionDto): Promise<ClassSession> {
    const response = await api.post(`/api/v1/dashboard/venues/${venueId}/class-sessions`, data)
    return response.data.data
  },

  async updateClassSession(venueId: string, sessionId: string, data: UpdateClassSessionDto): Promise<ClassSession> {
    const response = await api.patch(`/api/v1/dashboard/venues/${venueId}/class-sessions/${sessionId}`, data)
    return response.data.data
  },

  async cancelClassSession(venueId: string, sessionId: string): Promise<ClassSession> {
    const response = await api.post(`/api/v1/dashboard/venues/${venueId}/class-sessions/${sessionId}/cancel`)
    return response.data.data
  },

  async addAttendee(
    venueId: string,
    sessionId: string,
    data: { guestName: string; guestPhone?: string; guestEmail?: string; partySize?: number; specialRequests?: string },
  ): Promise<ClassSessionAttendee> {
    const response = await api.post(`/api/v1/dashboard/venues/${venueId}/class-sessions/${sessionId}/attendees`, data)
    return response.data.data
  },

  async removeAttendee(venueId: string, sessionId: string, reservationId: string): Promise<void> {
    await api.delete(`/api/v1/dashboard/venues/${venueId}/class-sessions/${sessionId}/attendees/${reservationId}`)
  },
}

export default classSessionService
