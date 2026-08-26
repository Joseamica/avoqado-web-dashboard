import api from '@/api'

/**
 * Asistencia (checador).
 *
 * Marcar entrada y salida NO vive aquí: eso pasa en la TPV, en Android y en iOS, donde
 * la foto y el GPS se toman en el lugar de trabajo. El dashboard sólo lee y aprueba.
 */

export type TimeEntryStatus = 'CLOCKED_IN' | 'ON_BREAK' | 'CLOCKED_OUT'
export type TimeEntryValidation = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface TimeEntryBreak {
  id: string
  startTime: string
  endTime: string | null
}

export interface TimeEntry {
  id: string
  staffId: string
  venueId: string
  clockInTime: string
  clockOutTime: string | null
  jobRole: string | null
  totalHours: string | number | null
  breakMinutes: number | null
  status: TimeEntryStatus
  notes: string | null
  checkInPhotoUrl: string | null
  checkOutPhotoUrl: string | null
  clockInLatitude: number | null
  clockInLongitude: number | null
  clockOutLatitude: number | null
  clockOutLongitude: number | null
  autoClockOut: boolean
  autoClockOutNote: string | null
  validationStatus: TimeEntryValidation
  validatedBy: string | null
  validatedAt: string | null
  validationNote: string | null
  staff?: {
    id: string
    firstName: string
    lastName: string
    employeeCode: string | null
  }
  breaks?: TimeEntryBreak[]
}

export interface TimeEntryFilters {
  staffId?: string
  startDate?: string
  endDate?: string
  status?: TimeEntryStatus
  limit?: number
  offset?: number
}

export type AttendanceStatus = 'ON_TIME' | 'LATE' | 'ABSENT' | 'DAY_OFF' | 'NO_SCHEDULE' | 'PENDING'

export interface AttendanceReportRow {
  staffId: string
  staffVenueId: string
  name: string
  date: string
  expectedStart: string | null
  expectedEnd: string | null
  clockInTime: string | null
  clockOutTime: string | null
  status: AttendanceStatus
  lateMinutes: number
  earlyLeaveMinutes: number
}

export interface AttendanceReport {
  rows: AttendanceReportRow[]
  graceMinutes: number
  timezone: string
}

export interface DaySchedule {
  enabled: boolean
  ranges: { open: string; close: string }[]
}
export type WeeklySchedule = Record<'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday', DaySchedule>

export interface WorkScheduleException {
  id?: string
  startDate: string
  endDate: string
  kind: 'OFF' | 'HOURS'
  startTime?: string | null
  endTime?: string | null
  note?: string | null
}

export interface WorkSchedule {
  weekly: WeeklySchedule | null
  exceptions: WorkScheduleException[]
}

export interface StaffTimeSummary {
  totalHours: number
  totalBreakMinutes: number
  entriesCount: number
}

function buildQuery(filters: TimeEntryFilters): string {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.append(key, String(value))
  })
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export const attendanceService = {
  async getTimeEntries(venueId: string, filters: TimeEntryFilters = {}): Promise<{ entries: TimeEntry[]; total: number }> {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/time-entries${buildQuery(filters)}`)
    // El motor devuelve `{ timeEntries, total, limit, offset }`. Antes se buscaba `.data`, que
    // no existe, y la pantalla mostraba "Sin checadas" siempre (auditoría Codex, P1).
    const d = response.data ?? {}
    const entries: TimeEntry[] = Array.isArray(d) ? d : (d.timeEntries ?? d.data ?? [])
    return { entries, total: typeof d.total === 'number' ? d.total : entries.length }
  },

  async getActiveStaff(venueId: string): Promise<TimeEntry[]> {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/time-entries/active`)
    return Array.isArray(response.data) ? response.data : (response.data?.data ?? [])
  },

  /** Reporte de puntualidad: cuadrante contra checadas, en la zona del negocio. */
  async getReport(venueId: string, startDate: string, endDate: string): Promise<AttendanceReport> {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/attendance/report?startDate=${startDate}&endDate=${endDate}`)
    return response.data
  },

  async getWorkSchedule(venueId: string, staffVenueId: string): Promise<WorkSchedule> {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/team/${staffVenueId}/work-schedule`)
    return response.data
  },

  /** Reemplaza el cuadrante completo (semana + excepciones). */
  async replaceWorkSchedule(venueId: string, staffVenueId: string, input: WorkSchedule): Promise<WorkSchedule> {
    const response = await api.put(`/api/v1/dashboard/venues/${venueId}/team/${staffVenueId}/work-schedule`, input)
    return response.data
  },

  async getStaffTimeSummary(venueId: string, staffId: string, startDate: string, endDate: string): Promise<StaffTimeSummary> {
    const response = await api.get(
      `/api/v1/dashboard/venues/${venueId}/time-entries/summary/${staffId}?startDate=${startDate}&endDate=${endDate}`,
    )
    return response.data
  },

  async validateTimeEntry(venueId: string, timeEntryId: string, status: 'APPROVED' | 'REJECTED', note?: string): Promise<TimeEntry> {
    const response = await api.post(`/api/v1/dashboard/venues/${venueId}/time-entries/${timeEntryId}/validate`, { status, note })
    return response.data
  },
}
