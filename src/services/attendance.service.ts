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
  /** Fase 3: por qué no viene (sólo OFF). null = descanso simple. */
  type?: string | null
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

export interface PayrollSummaryRow {
  staffId: string
  staffVenueId: string
  name: string
  scheduledDays: number
  workedDays: number
  onTimeDays: number
  lateDays: number
  lateMinutesTotal: number
  absentDays: number
  pendingDays: number
  absences: Record<string, number>
  hoursWorked: number
  breakMinutes: number
}

export interface PayrollSummaryResponse {
  rows: PayrollSummaryRow[]
  timezone: string
  startDate: string
  endDate: string
}


// ─── Turnos rotativos (fase 1 "como Sesame") ────────────────────────────────────────────
export interface WorkShiftTemplate {
  id: string
  name: string
  abbreviation: string
  color: string
  /** 'HH:mm' en hora del negocio. endTime <= startTime = cruza la medianoche. */
  startTime: string
  endTime: string
  active: boolean
  sortOrder: number
}
export type WorkShiftTemplateInput = Pick<WorkShiftTemplate, 'name' | 'abbreviation' | 'startTime' | 'endTime'> & { color?: string; sortOrder?: number }
export interface WorkShiftAssignment {
  id: string
  staffVenueId: string
  date: string
  templateId: string | null
  templateName: string
  startTime: string
  endTime: string
  status: 'DRAFT' | 'PUBLISHED'
  /** Revisión: se manda de vuelta al publicar (CAS todo-o-nada). */
  updatedAt: string
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
  async getPayrollSummary(venueId: string, startDate: string, endDate: string): Promise<PayrollSummaryResponse> {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/attendance/payroll-summary`, { params: { startDate, endDate } })
    return response.data
  },

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
  // ─── Turnos rotativos ───
  async getWorkShiftTemplates(venueId: string, includeInactive = false): Promise<WorkShiftTemplate[]> {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/work-shifts/templates`, { params: includeInactive ? { includeInactive: 'true' } : {} })
    return response.data?.data ?? []
  },
  async createWorkShiftTemplate(venueId: string, input: WorkShiftTemplateInput): Promise<WorkShiftTemplate> {
    const response = await api.post(`/api/v1/dashboard/venues/${venueId}/work-shifts/templates`, input)
    return response.data?.data
  },
  async updateWorkShiftTemplate(venueId: string, templateId: string, input: Partial<WorkShiftTemplateInput> & { active?: boolean }): Promise<WorkShiftTemplate> {
    const response = await api.put(`/api/v1/dashboard/venues/${venueId}/work-shifts/templates/${templateId}`, input)
    return response.data?.data
  },
  async getWorkShiftAssignments(venueId: string, from: string, to: string): Promise<WorkShiftAssignment[]> {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/work-shifts/assignments`, { params: { from, to } })
    return response.data?.data ?? []
  },
  /** Guarda celdas persona×día como BORRADOR. `templateId: null` vacía la celda. */
  async replaceWorkShiftAssignments(venueId: string, input: { from: string; to: string; items: Array<{ staffVenueId: string; date: string; templateId: string | null }> }): Promise<WorkShiftAssignment[]> {
    const response = await api.put(`/api/v1/dashboard/venues/${venueId}/work-shifts/assignments`, input)
    return response.data?.data ?? []
  },
  /** Publicar = "esta semana va": desde aquí cuenta para asistencia y comisiones. */
  async publishWorkShiftAssignments(venueId: string, input: { from: string; to: string; drafts: Array<{ id: string; updatedAt: string }> }): Promise<{ published: number; cleared: number; skipped: number }> {
    const response = await api.post(`/api/v1/dashboard/venues/${venueId}/work-shifts/assignments/publish`, input)
    return response.data?.data ?? { published: 0, cleared: 0, skipped: 0 }
  },
}
