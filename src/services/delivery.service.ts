/**
 * Delivery channels — activación y gestión de canales (dashboard).
 * Consume el backend de activación de avoqado-server (`src/routes/delivery-channels.routes.ts`,
 * mount `/api/v1/delivery-channels`) — endpoints existentes, protegidos por la feature PREMIUM
 * `DELIVERY_CHANNELS` (plan-catalog.ts, Task 1). El backend envuelve todo en `{ success, data }`;
 * cada fn desenvuelve `response.data.data`.
 */
import api from '@/api'
import type { DeliveryChannelConfig, DeliveryChannelLink, DeliveryActivationRequest, DeliverySummary } from '@/types/delivery'

const base = (venueId: string) => `/api/v1/delivery-channels/venues/${venueId}`

/** GET .../channels — lista los canales de delivery vinculados al venue. */
export const getChannels = async (venueId: string): Promise<DeliveryChannelLink[]> => (await api.get(`${base(venueId)}/channels`)).data.data

/** GET .../activation-request — solicitud de activación viva (PENDING|CONTACTED) del venue, o null si no hay. */
export const getActivationRequest = async (venueId: string): Promise<DeliveryActivationRequest | null> =>
  (await api.get(`${base(venueId)}/activation-request`)).data.data

/**
 * POST .../activation-request — el dueño solicita activar delivery. Idempotente en el backend:
 * si ya hay una solicitud PENDING/CONTACTED, la devuelve en vez de duplicarla.
 */
export const createActivationRequest = async (
  venueId: string,
  body: { requestedChannels: string[]; note?: string },
): Promise<DeliveryActivationRequest> => (await api.post(`${base(venueId)}/activation-request`, body)).data.data

/** GET .../delivery/summary — pedidos e ingreso (pesos) de HOY, venue-local, agrupados por canal. */
export const getDeliverySummary = async (venueId: string): Promise<DeliverySummary> =>
  (await api.get(`${base(venueId)}/delivery/summary`)).data.data

/** POST .../channels/:linkId/pause — pausa o reactiva un canal vinculado. */
export const pauseChannel = async (venueId: string, linkId: string, paused: boolean): Promise<DeliveryChannelLink> =>
  (await api.post(`${base(venueId)}/channels/${linkId}/pause`, { paused })).data.data

/**
 * PATCH .../channels/:linkId — actualiza el canal (modo de aceptación auto/manual, auto-sync de
 * menú, etc.). Todos los campos son opcionales; el backend exige al menos uno (`updateChannelSchema`).
 */
export const updateChannel = async (
  venueId: string,
  linkId: string,
  // `config` se MEZCLA en el backend, no reemplaza: mandar sólo `deliveryHours` deja
  // `precios` intacto. Mandar `null` sí limpia todo — es el borrado explícito.
  body: { orderAcceptanceMode?: 'AUTO' | 'MANUAL'; autoSyncMenu?: boolean; config?: DeliveryChannelConfig | null },
): Promise<DeliveryChannelLink> => (await api.patch(`${base(venueId)}/channels/${linkId}`, body)).data.data

/**
 * GET .../channels/rappi/connect-url — Rappi fase 3: el enlace (vence en 10 min) con el que el dueño conecta o reconecta su
 * tienda de Rappi. 🔴 Esta ruta responde `{ ok, url, instrucciones }` SIN la envoltura `data` de las demás.
 */
export const getRappiConnectUrl = async (venueId: string): Promise<{ ok: boolean; url: string; instrucciones?: string }> =>
  (await api.get(`${base(venueId)}/channels/rappi/connect-url`)).data

/**
 * POST .../channels/:linkId/disconnect — Rappi fase 3: avisa a Rappi «no integrada» y deja la tienda DISABLED. `conexionId` es
 * el que trajo el listado (si la conexión cambió, el servidor responde 409 sin tocar nada). `forzar` sólo tras un 502 y una
 * segunda confirmación del dueño.
 */
export const disconnectChannel = async (
  venueId: string,
  linkId: string,
  conexionId: string,
  opciones?: { forzar?: boolean },
): Promise<DeliveryChannelLink> =>
  (await api.post(`${base(venueId)}/channels/${linkId}/disconnect`, { conexionId, ...(opciones?.forzar ? { forzar: true } : {}) })).data
    .data
