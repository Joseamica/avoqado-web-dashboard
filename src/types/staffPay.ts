export interface CeldaDto { payLevelId: string; count: number; amount: number }
export interface NivelDto { id: string; name: string; sortOrder: number; archivedAt: string | null }
export interface AsignacionVigenteDto { staffId: string; payLevelId: string; payLevelName: string; effectiveFrom: string }
export interface TablaDto {
  id: string; name: string; productIds: string[]; archivedFrom: string | null
  vigente: null | { id: string; effectiveFrom: string; revision: number; countMode: 'BOOKED' | 'ATTENDED'; maxCount: number; cells: CeldaDto[] }
}
export type MotivoExcepcion = 'SIN_COACH' | 'COACH_SIN_NIVEL' | 'SIN_TABLA' | 'SIN_MONTO_PARA_ESE_CONTEO'
export interface ClaseValoradaDto {
  classSessionId: string; venueId: string; productName: string; startsAt: string; fechaLocal: string
  staffId: string | null; staffName: string | null; payLevelName: string | null; countMode: 'BOOKED' | 'ATTENDED' | null
  conteoCalculado: number; conteo: number; tieneAjuste: boolean; estado: 'OK' | 'EXCLUIDA' | 'EXCEPCION'
  motivo: MotivoExcepcion | null; monto: string | null
}
export interface ReportePeriodoDto {
  periodo: { start: string; end: string; periodicidad: 'MONTHLY' | 'SEMIMONTHLY' }
  parcial: boolean; truncado: boolean; venueIds: string[]
  tarjetas: { total: string; clases: number; personas: number; excepciones: number; excluidas: number }
  personas: { items: Array<{ staffId: string; staffName: string; payLevelName: string | null; venueIds: string[]; clases: number; promedioLugares: number; total: string }>; total: number; offset: number; limit: number }
  huerfanas: number
}
export interface PaginaCursor<T> { items: T[]; nextCursor: string | null }
export interface PaginaOffset<T> { items: T[]; total: number }
/** Reserva de clase sin horario (spec §5.5): no cuenta para ningún pago. */
export interface ReservaHuerfanaDto { reservationId: string; startsAt: string; venueId: string; productName: string | null; guestName: string | null }
export interface PagoDeClaseDto {
  classSessionId: string; estado: 'OK' | 'EXCLUIDA' | 'EXCEPCION' | 'NO_TERMINADA' | 'CANCELADA'
  motivo: MotivoExcepcion | null; monto: string | null; conteo: number | null; conteoCalculado: number | null
  maxCount: number | null; countMode: string | null; staffName: string | null; payLevelName: string | null
  ajuste: { payCountOverride: number | null; payAmountOverride: string | null; payExcluded: boolean; reason: string | null; at: string | null } | null
  anclada: boolean
}
export interface AjusteClaseInput { payCountOverride: number | null; payAmountOverride: number | null; payExcluded: boolean; reason: string }
