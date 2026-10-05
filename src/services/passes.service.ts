/**
 * Conector de pases (TotalPass · Wellhub) — API del dashboard.
 * Montada en /api/v1/dashboard/venues/:venueId/pass-integrations (avoqado-server, Plan 2a T5), protegida por
 * `AGGREGATOR_PASSES` (Pro) —salvo la vista general y desconectar, que sólo piden permiso (R62, pausa suave)— y
 * permisos `reservations:*`. El server envuelve todo en `{ success, data }`: cada fn desenvuelve `response.data.data`.
 * Los reintentos de red ya los hace `src/api.ts`; aquí no se repiten.
 */
import api from '@/api'
import type {
  PassCapacityView,
  PassConfirmMode,
  PassConnectionView,
  PassIntegrationsOverview,
  PassProvider,
  PassVisitView,
  PassVisitsPage,
  PassVisitsQuery,
  PassVisitsSummaryRow,
  WeeklyRuleInput,
  WeeklyRuleView,
} from '@/types/passes'

const base = (venueId: string) => `/api/v1/dashboard/venues/${venueId}/pass-integrations`
/** En la URL el proveedor va en minúsculas (`totalpass` · `wellhub`); en body y query, en mayúsculas. */
const slug = (provider: PassProvider) => provider.toLowerCase()

/** GET / — estado de TotalPass y Wellhub (siempre los dos, en ese orden), las clases del negocio (acotadas) y `planActive`.
 * Sin candado de plan (R62): un negocio que perdió el plan la lee para ver la pausa y desconectar. */
export const getPassIntegrationsOverview = async (venueId: string): Promise<PassIntegrationsOverview> =>
  (await api.get(base(venueId))).data.data

/** POST /totalpass/connect — pega la `place_api_key`. Se recorta aquí: copiada del portal suele traer espacios o salto de línea. */
export const connectTotalPass = async (venueId: string, placeApiKey: string): Promise<PassConnectionView> =>
  (await api.post(`${base(venueId)}/totalpass/connect`, { placeApiKey: placeApiKey.trim() })).data.data

/** PUT /:provider/confirm-mode — AUTO (de fábrica) o cuando el estudio registre la asistencia. */
export const setPassConfirmMode = async (
  venueId: string,
  provider: PassProvider,
  confirmMode: PassConfirmMode,
): Promise<PassConnectionView> => (await api.put(`${base(venueId)}/${slug(provider)}/confirm-mode`, { confirmMode })).data.data

/** PUT /:provider/products — la lista COMPLETA de clases ligadas (lo que no venga se desliga; el server rechaza con 409 si tiene socios). */
export const setPassProductLinks = async (
  venueId: string,
  provider: PassProvider,
  links: Array<{ productId: string; externalPlanId: string }>,
): Promise<PassConnectionView> => (await api.put(`${base(venueId)}/${slug(provider)}/products`, { links })).data.data

/** POST /:provider/disconnect — sin candado de plan (R62). No ACTIVE: se desconecta siempre (R41). ACTIVE, dos 409 distintos:
 * `PASS_DISCONNECT_UNLINKING` es AVANCE, no rechazo (tiene clases ligadas y ningún socio próximo: en esa misma llamada las
 * desliga y pide volver a presionar Desconectar en unos minutos); `PASS_DISCONNECT_BLOCKED` sí es rechazo (hay socios con
 * reserva próxima o check-ins por confirmar). Ambos traen `message` en español, que la UI muestra tal cual. */
export const disconnectPassProvider = async (venueId: string, provider: PassProvider): Promise<{ disconnected: true }> =>
  (await api.post(`${base(venueId)}/${slug(provider)}/disconnect`)).data.data

/** GET /capacity — tope general, excepciones por día/hora y sugerencias. */
export const getPassCapacity = async (venueId: string): Promise<PassCapacityView> => (await api.get(`${base(venueId)}/capacity`)).data.data

/** PUT /capacity/default — `null` quita la regla general (vuelven a ofrecerse todos los lugares libres). La API devuelve
 * `{ saved: true }`, no la capacidad (P3-16): la pantalla la vuelve a pedir por invalidación. */
export const setDefaultPassCap = async (venueId: string, maxSpots: number | null): Promise<{ saved: true }> =>
  (await api.put(`${base(venueId)}/capacity/default`, { maxSpots })).data.data

/** POST /capacity/weekly — la misma combinación día+hora actualiza la existente en vez de duplicarla. Sólo viajan los tres
 * campos: el esquema del server es estricto y un `id` de más (una regla de la lista) devolvería 400. */
export const upsertWeeklyPassCap = async (venueId: string, { weekday, startMinute, maxSpots }: WeeklyRuleInput): Promise<WeeklyRuleView> =>
  (await api.post(`${base(venueId)}/capacity/weekly`, { weekday, startMinute, maxSpots })).data.data

/** DELETE /capacity/rules/:ruleId */
export const deletePassCapRule = async (venueId: string, ruleId: string): Promise<{ deleted: true }> =>
  (await api.delete(`${base(venueId)}/capacity/rules/${ruleId}`)).data.data

/** PUT /capacity/sessions/:classSessionId — `null` borra el ajuste de esa clase (vuelve a la regla general). */
export const setSessionPassCap = async (venueId: string, classSessionId: string, maxSpots: number | null): Promise<{ saved: true }> =>
  (await api.put(`${base(venueId)}/capacity/sessions/${classSessionId}`, { maxSpots })).data.data

/** GET /visits — paginado por limit/offset (tope 100 en el server). `from`/`to` como `AAAA-MM-DD` (días locales del venue,
 * `to` inclusivo): el server los convierte con la zona del venue (P2-7). Aquí no se toca nada. */
export const listPassVisits = async (venueId: string, query: PassVisitsQuery): Promise<PassVisitsPage> =>
  (await api.get(`${base(venueId)}/visits`, { params: query })).data.data

/** GET /visits/summary?month=AAAA-MM — una fila por proveedor, mes en la zona del venue (lo resuelve el server). */
export const getPassVisitsSummary = async (venueId: string, month: string): Promise<PassVisitsSummaryRow[]> =>
  (await api.get(`${base(venueId)}/visits/summary`, { params: { month } })).data.data

/** POST /visits/:id/confirm — idempotente en el server (el reintento de red de api.ts no duplica nada). Devuelve la visita
 * COMO QUEDÓ: puede seguir PENDING (la validación con el proveedor va por outbox) o venir ya resuelta
 * (CONFIRMED/ALREADY_CONFIRMED/EXPIRED/REJECTED); la UI decide por `status`, nunca anuncia éxito a ciegas (P1-3). */
export const confirmPassVisit = async (venueId: string, visitId: string): Promise<PassVisitView> =>
  (await api.post(`${base(venueId)}/visits/${visitId}/confirm`)).data.data

/** POST /visits/:id/reject — sólo una PENDING pasa a REJECTED. */
export const rejectPassVisit = async (venueId: string, visitId: string): Promise<PassVisitView> =>
  (await api.post(`${base(venueId)}/visits/${visitId}/reject`)).data.data
