/**
 * Delivery channels — activación y gestión de canales (dashboard).
 * Consume el backend de activación de avoqado-server (`src/routes/delivery-channels.routes.ts`,
 * mount `/api/v1/delivery-channels`) — endpoints existentes, protegidos por la feature PREMIUM
 * `DELIVERY_CHANNELS` (plan-catalog.ts, Task 1). El backend envuelve todo en `{ success, data }`;
 * cada fn desenvuelve `response.data.data`.
 */
import api from '@/api'
import type { DeliveryChannelLink, DeliveryActivationRequest, DeliverySummary } from '@/types/delivery'

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
