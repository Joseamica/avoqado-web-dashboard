import api from '@/api'
const BASE = '/api/v1/me/support-whatsapp'
export interface SupportStatus {
  enabled: boolean
  linked: boolean
  phone: string | null
  expiresAt: string | null
  /** Datos por WhatsApp (la B) prendidos en el servidor. Opcional: un servidor viejo no lo manda. */
  dataEnabled?: boolean
  /** T-F15: el número propio del soporte y su liga de WhatsApp. Opcional: null (o ausente en un servidor viejo) = no se enseña. */
  supportNumber?: { display: string; waMe: string } | null
}
export interface SupportVenue {
  id: string
  name: string
  organizationId: string
}
export interface SupportDataAccess {
  accepted: boolean
  /** El desbloqueo de hoy, crudo: el estado positivo es `accepted && unlocked` (con el aviso cambiado puede venir sin aceptar). */
  unlocked: boolean
  venueName: string
  notice: { text: string; hash: string }
}
const actorHeaders = (staffId: string) => ({ 'X-Support-Staff-Id': staffId })
export const getSupportStatus = (staffId: string, signal?: AbortSignal) =>
  api.get<SupportStatus>(`${BASE}/status`, { signal, headers: actorHeaders(staffId) }).then(r => r.data)
export const requestSupportCode = (staffId: string, input: { phone: string; operationKey: string; personalPhone: true }) =>
  api.post<{ challengeId: string; expiresAt: string }>(`${BASE}/challenge`, input, { headers: actorHeaders(staffId) }).then(r => r.data)
// Verificar NO lleva `repetible` (D6 de api.ts): el servidor cuenta cada código equivocado, y si guardó el intento y sólo se
// perdió la respuesta, repetir el POST solo gastaría otro (de tres pasaría a cinco y el código moriría). Falla una vez y la
// persona reintenta a mano; un código correcto ya usado contesta lo mismo sin volver a vincular (link.service del servidor).
export const verifySupportCode = (staffId: string, input: { challengeId: string; code: string }) =>
  api.post<{ linked: true }>(`${BASE}/verify`, input, { headers: actorHeaders(staffId) }).then(r => r.data)
// Desvincular sí es `repetible`: desvincular lo que ya no está vinculado no hace nada en el servidor.
export const unlinkSupportPhone = (staffId: string) =>
  api.post<{ linked: false }>(`${BASE}/unlink`, {}, { headers: actorHeaders(staffId), repetible: true }).then(r => r.data)
export const listSupportVenues = (staffId: string, params: { search?: string; cursor?: string; limit?: number }, signal?: AbortSignal) =>
  api
    .get<{ items: SupportVenue[]; total: number; nextCursor: string | null }>(`${BASE}/venues`, {
      params,
      signal,
      headers: actorHeaders(staffId),
    })
    .then(r => r.data)
export const getSupportDataAccess = (staffId: string, venueId: string, language: 'es' | 'en', signal?: AbortSignal) =>
  api
    .get<SupportDataAccess>(`${BASE}/data-access`, { params: { venueId, language }, signal, headers: actorHeaders(staffId) })
    .then(r => r.data)
// El permiso del día NO lleva `repetible` ni llave de operación (T-B29, mismo criterio que verificar): el servidor fecha cada
// POST con su propio reloj, así que si guardó el toque de las 23:59:59 y sólo se perdió la respuesta, repetirlo solo un segundo
// después autorizaría el día siguiente sin que la persona tocara nada. Falla una vez; la sección vuelve a leer el estado y la
// persona toca otra vez si hace falta. El cuerpo no debe ganar un campo de CAMPOS_QUE_RECONOCEN_LA_REPETICION (api.ts).
// `acceptNotice` (T-B37): true only from «Aceptar» in the dialog. The one tap outside it sends false, and then the server never
// records an acceptance: if the one it has no longer counts (relinked in another tab), it answers `accepted: false` and the notice.
export const grantSupportDataAccess = (
  staffId: string,
  input: { venueId: string; noticeHash: string; language: 'es' | 'en'; acceptNotice: boolean },
) => api.post<SupportDataAccess>(`${BASE}/data-access`, input, { headers: actorHeaders(staffId) }).then(r => r.data)
