/**
 * Promoters Audit API Service
 * Provides promoter tracking, attendance, sales stats, and deposit management
 * for PlayTelecom/White-Label dashboard.
 */
import api from '@/api'

// ===========================================
// TYPES
// ===========================================

// Backend response structure (from promoters.service.ts in avoqado-server)
export interface Promoter {
  id: string
  name: string
  photo: string | null
  status: 'ACTIVE' | 'INACTIVE' | 'ON_BREAK'
  store: { id: string; name: string }
  todaySales: number
  todayUnits: number
  commission: number
  lastActivity: string | null
}

// Legacy type alias for backwards compatibility
export interface PromoterStats {
  todaySales: number
  todayUnits: number
  weekSales: number
  weekUnits: number
  monthSales: number
  monthUnits: number
  attendanceRate: number
  avgDailyScore: number
}

export interface PromotersListResponse {
  promoters: Promoter[]
  summary: {
    total: number
    active: number
    onBreak: number
    todayTotalSales: number
    todayTotalCommissions: number
  }
}

// Matches backend promoters.service.ts PromoterDetail type
export interface PromoterDetail {
  promoter: {
    id: string
    name: string
    email: string | null
    phone: string | null
    photo: string | null
    joinDate: string
    role: string
  }
  todayMetrics: {
    sales: number
    units: number
    commission: number
    goalProgress: number
    dailyGoal: number
  }
  checkIn: {
    time: string
    method: string | null
    photoUrl: string | null
    location: { lat: number; lng: number } | null
    verified: boolean
  } | null
  attendance: {
    days: Array<{
      date: string
      status: 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY'
    }>
  }
}

export interface AttendanceDay {
  date: string
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'ON_LEAVE' | 'FUTURE'
  clockIn: string | null
  clockOut: string | null
  hoursWorked: number | null
}

export interface AttendanceResponse {
  calendar: AttendanceDay[]
  summary: {
    daysPresent: number
    daysAbsent: number
    daysLate: number
    daysOnLeave: number
    attendanceRate: number
  }
}

// Matches backend promoters.service.ts PromoterDeposit type
export interface Deposit {
  id: string
  amount: number
  method: string
  timestamp: string
  voucherImageUrl: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  rejectionReason: string | null
}

export interface DepositsResponse {
  deposits: Deposit[]
}

export interface ValidateDepositResult {
  success: boolean
  deposit: Deposit
}

// ===========================================
// API FUNCTIONS
// ===========================================

/**
 * Get list of promoters for a venue
 */
export const getPromoters = async (
  venueId: string,
  params?: { status?: string; search?: string }
): Promise<PromotersListResponse> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/promoters`, { params })
  return response.data.data
}

/**
 * Get detailed info for a single promoter
 * Backend route: GET /dashboard/venues/:venueId/promoters/:promoterId
 */
export const getPromoterDetail = async (
  venueId: string,
  promoterId: string
): Promise<PromoterDetail> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/promoters/${promoterId}`)
  return response.data.data
}

/**
 * Get attendance calendar for a promoter
 */
export const getPromoterAttendance = async (
  venueId: string,
  promoterId: string,
  params?: { month?: string; year?: string }
): Promise<AttendanceResponse> => {
  const response = await api.get(
    `/api/v1/dashboard/venues/${venueId}/promoters/${promoterId}/attendance`,
    { params }
  )
  return response.data.data
}

/**
 * Get deposits for a promoter
 */
export const getPromoterDeposits = async (
  venueId: string,
  promoterId: string,
  params?: { status?: string; limit?: number }
): Promise<DepositsResponse> => {
  const response = await api.get(
    `/api/v1/dashboard/venues/${venueId}/promoters/${promoterId}/deposits`,
    { params }
  )
  return response.data.data
}

/**
 * Validate (approve/reject) a deposit
 */
export const validateDeposit = async (
  venueId: string,
  promoterId: string,
  depositId: string,
  data: { action: 'approve' | 'reject'; notes?: string }
): Promise<ValidateDepositResult> => {
  const response = await api.post(
    `/api/v1/dashboard/venues/${venueId}/promoters/${promoterId}/deposits/${depositId}/validate`,
    data
  )
  return response.data.data
}
