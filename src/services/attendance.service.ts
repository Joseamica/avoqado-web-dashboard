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
  /** Minutos trabajados DESPUÉS de la salida del cuadrante, sin los descansos de esa ventana. */
  overtimeMinutes: number
  /**
   * Minutos ya autorizados de ese día. `null` = NADIE lo ha revisado, que NO es lo mismo que
   * 0 = revisado y negado. La pantalla necesita esa diferencia para saber qué falta por mirar.
   */
  overtimeApprovedMinutes: number | null
  /**
   * La revisión de esa autorización. Hay que devolverla al corregir, para que dos gerentes no
   * se pisen sin enterarse. `null` cuando nadie la ha revisado.
   */
  overtimeApprovedUpdatedAt: string | null
  /**
   * La huella de la JORNADA que produjo esos minutos: tramos trabajados, descansos, cuadrante
   * y zona del negocio. Se devuelve al autorizar para que el servidor pueda comprobar que se
   * está firmando lo que esta pantalla enseñaba — si alguien editó la checada mientras tanto,
   * rechaza en vez de estampar la firma sobre horas que nadie revisó.
   */
  overtimeFingerprint: string | null
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
  /** Minutos extra MEDIDOS por el reloj. Llegar temprano no cuenta. */
  overtimeMinutes: number
  /** De lo medido, lo que alguien AUTORIZÓ. Es lo único que se paga. */
  overtimeApprovedMinutes: number
  /** Medido que NADIE ha revisado todavía. Es lo que hay que mirar. */
  overtimePendingMinutes: number
  /** Medido que se revisó y NO se autorizó. */
  overtimeDeniedMinutes: number
  /** Días cuya checada cambió DESPUÉS de autorizar: hay que volver a mirarlos. */
  overtimeDaysToReview: string[]
  /** Lo AUTORIZADO, semana por semana: la base que la nómina necesita para calcular el pago. */
  overtimeWeeks: OvertimeWeek[]
}

/**
 * El desglose por semana natural (lunes a domingo), que es la unidad en la que una nómina
 * calcula el tiempo extraordinario.
 *
 * 🔴 Aquí NO viene el reparto en doble y triple ni ningún veredicto legal: se retiraron del
 * servidor el 31-ago-2026 por decisión del founder — la ley la cumple el patrón, no el
 * software. Si vuelves a necesitar esos campos, el sitio donde nacen es el sistema de nómina
 * del negocio, no este tipo.
 */
export interface OvertimeWeek {
  weekStart: string
  weekEnd: string
  minutosTotal: number
  /** El rango pedido no cubre la semana entera: su total todavía puede crecer. */
  parcial: boolean
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

  /**
   * Autoriza las horas extra de UN día. Se puede autorizar MENOS de lo medido (parcial) pero
   * nunca más: el servidor recalcula lo trabajado y rechaza el exceso. 0 = revisado y negado.
   */
  async approveOvertime(
    venueId: string,
    staffVenueId: string,
    body: {
      date: string
      minutesApproved: number
      note?: string
      expectedUpdatedAt?: string
      expectedSourceFingerprint?: string
    },
  ): Promise<{ staffVenueId: string; date: string; minutesApproved: number; minutesMeasured: number }> {
    const response = await api.put(
      `/api/v1/dashboard/venues/${venueId}/team/${staffVenueId}/overtime-approval`,
      body,
    )
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
