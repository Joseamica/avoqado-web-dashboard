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
  periodo: { start: string; end: string; periodicidad: 'MONTHLY' | 'SEMIMONTHLY'; id?: string | null; estado?: 'OPEN' | 'CLOSED' }
  parcial: boolean; truncado: boolean; venueIds: string[]
  /** `pagadas` (fase 2) es del periodo entero, no de la página que se ve (Codex R1-23). */
  tarjetas: { total: string; clases: number; personas: number; excepciones: number; excluidas: number; pagadas?: number }
  personas: { items: Array<{ staffId: string; staffName: string; payLevelName: string | null; venueIds: string[]; clases: number; promedioLugares: number; total: string; ajustes?: string; pagadoEn?: string | null }>; total: number; offset: number; limit: number }
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
  /** Fase 2: opcionales, el server de la fase 1 no los manda y el dashboard puede desplegarse antes. */
  periodoOrigen?: { id: string; start: string; end: string; estado: 'OPEN' | 'CLOSED' } | null
  lineas?: LineaContabilizadaDto[]
}
export interface AjusteClaseInput { payCountOverride: number | null; payAmountOverride: number | null; payExcluded: boolean; reason: string }

// ── Fase 2: cerrar y pagar ──
export type Bloqueo =
  | { codigo: 'NO_HA_TERMINADO'; hasta: string }
  | { codigo: 'CLASES_EN_CURSO'; n: number }
  | { codigo: 'EXCEPCIONES'; n: number }
  | { codigo: 'SIN_PERMISO' }
  | { codigo: 'YA_CERRADO' }
export interface PreviewCierreDto {
  periodo: { id: string | null; start: string; end: string; venueIds: string[] }
  puedeCerrar: boolean
  bloqueos: Bloqueo[]
  clases: number
  excluidas: number
  personas: number
  totalServicios: string
  totalAjustes: string
  total: string
  huerfanas: number
  huella: string
}
export interface ResultadoCierreDto { periodId: string; start: string; end: string; venueIds: string[]; personas: number; total: string; huella: string; yaCerrado: boolean }
export interface PeriodoListadoDto { id: string | null; start: string; end: string; estado: 'OPEN' | 'CLOSED'; personas: number; pagadas: number; total: string }
export interface ListaPeriodosDto { periodicidad: 'MONTHLY' | 'SEMIMONTHLY'; puedeCambiarPeriodicidad: boolean; items: PeriodoListadoDto[]; antesDe: string | null }
export interface RenglonReciboDto { tipo: 'CLASE' | 'DIFERENCIA' | 'AJUSTE'; fecha: string; hora: string | null; sede: string; concepto: string; lugares: number | null; monto: string }
export interface ReciboDto {
  persona: string
  periodo: { id: string | null; start: string; end: string; estado: 'OPEN' | 'CLOSED' }
  /** UNA página (Codex R2-R1-20). */
  renglones: RenglonReciboDto[]
  /** Del recibo ENTERO (lo suma la base): nunca se suma lo cargado. */
  total: string
  cantidad: number
  siguiente: string | null
  pagadoEn: string | null
  parcial: boolean
}
export interface AjusteManualInput { sede: string; staffId: string; amount: number; reason: string; fecha?: string; clientKey: string }
export interface AjusteManualDto { id: string; periodId: string; periodo: { start: string; end: string }; staffId: string; sede: string; amount: string; reason: string; yaExistia: boolean }
export interface LineaContabilizadaDto { concepto: 'SERVICE' | 'RECONCILE'; staffId: string; staffName: string; monto: string; periodo: { start: string; end: string }; pagadoEn: string | null }
