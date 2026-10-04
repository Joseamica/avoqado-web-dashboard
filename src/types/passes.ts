/**
 * Conector de pases (TotalPass · Wellhub) — espejo 1:1 de lo que devuelve la API del dashboard
 * (avoqado-server, Plan 2a: `passIntegrations.service.ts`, `passCapacity.service.ts`, `passVisits.service.ts`).
 * Nunca llegan aquí `credentialCiphertext`, `webhookToken`, la `place_api_key` ni `validationRef`: el server los excluye.
 */
export type PassProvider = 'TOTALPASS' | 'WELLHUB'
export type PassConnectionStatus = 'PENDING' | 'ACTIVE' | 'PAUSED' | 'REVOKED'
export type PassConfirmMode = 'AUTO' | 'ON_VENUE_CHECKIN'
export interface PassPlan {
  id: string
  name: string | null
  code: string | null
}
export interface PassProductLink {
  productId: string
  productName: string
  externalPlanId: string
  externalPlanName: string | null
}
export interface PassConnectionView {
  provider: PassProvider
  available: boolean
  status: PassConnectionStatus | null
  externalPlaceName: string | null
  confirmMode: PassConfirmMode
  lastError: string | null
  plans: PassPlan[]
  productLinks: PassProductLink[]
  updatedAt: string | null
}
/** `planActive`: ¿el plan del negocio incluye los pases? Sin él (pausa suave, R62) el server no publica clases nuevas; lo ya publicado y reservado sigue. */
export interface PassIntegrationsOverview {
  planActive: boolean
  connections: PassConnectionView[]
  classProducts: { items: Array<{ id: string; name: string }>; total: number }
}
export interface WeeklyRuleView {
  id: string
  weekday: number
  startMinute: number | null
  maxSpots: number
}
export interface WeeklyRuleInput {
  weekday: number
  startMinute: number | null
  maxSpots: number
}
export interface PassSuggestion {
  weekday: number
  startMinute: number
  suggestedMaxSpots: number
  weeksOfData: number
  p75Occupancy: number
  capacity: number
  applied: boolean
}
export interface PassCapacityView {
  defaultMaxSpots: number | null
  weekly: WeeklyRuleView[]
  suggestions: PassSuggestion[]
}
export type PassVisitStatus = 'PENDING' | 'CONFIRMED' | 'ALREADY_CONFIRMED' | 'EXPIRED' | 'REJECTED'
/** `confirmedBy` es un CÓDIGO del server: 'AUTO' (se confirmó sola) o 'VENUE' (la confirmó el negocio), nunca un nombre (P3-17). */
export interface PassVisitView {
  id: string
  provider: PassProvider
  status: PassVisitStatus
  memberName: string | null
  startedAt: string
  deadlineAt: string
  confirmedAt: string | null
  confirmedBy: string | null
  lastError: string | null
  reservation: { id: string; classSessionId: string | null; startsAt: string; productName: string | null } | null
  canConfirm: boolean
  canReject: boolean
}
/** `from`/`to`: días LOCALES del venue como `AAAA-MM-DD`, `to` inclusivo; el server convierte con la zona del venue (P2-7). */
export interface PassVisitsQuery {
  status?: PassVisitStatus
  provider?: PassProvider
  from?: string
  to?: string
  limit?: number
  offset?: number
}
export interface PassVisitsPage {
  items: PassVisitView[]
  total: number
  hasMore: boolean
  nextOffset: number | null
}
export interface PassVisitsSummaryRow {
  provider: PassProvider
  confirmed: number
  alreadyConfirmed: number
  expired: number
  rejected: number
  pending: number
  lateCancellations: number
}
export interface SessionPasses {
  taken: number
  cap: number
  sessionCap: number | null
}
