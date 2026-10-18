/**
 * Pedidos en línea (panel). El servidor envuelve en `{ success, data }`.
 * Dos formas de error: transiciones `{success:false, code, error, status}` y el manejador global `{message, code?, details?}`
 * → `serverMessage` lee las dos.
 */
import api from '@/api'
import type {
  ActionResult,
  Inbox,
  MenuCategoriesSummary,
  MenuProductsPage,
  OnlineOrderingSettings,
  OnlineOrderingSettingsInput,
  PauseMinutes,
  RejectReason,
} from '@/types/onlineOrdering'

const base = (venueId: string) => `/api/v1/dashboard/venues/${venueId}/online-ordering`

export const onlineOrderingKeys = {
  settings: (v: string) => ['online-ordering', v, 'settings'] as const,
  categories: (v: string) => ['online-ordering', v, 'menu', 'categories'] as const,
  products: (v: string, q: object) => ['online-ordering', v, 'menu', 'products', q] as const,
  inbox: (v: string) => ['online-ordering', v, 'inbox'] as const,
}

export const getSettings = async (venueId: string): Promise<OnlineOrderingSettings> =>
  (await api.get(`${base(venueId)}/settings`)).data.data

export const updateSettings = async (venueId: string, patch: Partial<OnlineOrderingSettingsInput>): Promise<OnlineOrderingSettings> =>
  (await api.put(`${base(venueId)}/settings`, patch)).data.data

export const getMenuCategories = async (venueId: string): Promise<MenuCategoriesSummary> =>
  (await api.get(`${base(venueId)}/menu/categories`)).data.data

export const getMenuProducts = async (
  venueId: string,
  q: { categoryId?: string; search?: string; cursor?: string; limit?: number },
): Promise<MenuProductsPage> => (await api.get(`${base(venueId)}/menu/products`, { params: q })).data.data

export const setMenuAvailability = async (
  venueId: string,
  body: { availableOnline: boolean; productIds?: string[]; categoryIds?: string[]; allProducts?: boolean },
): Promise<{ updated: number }> => (await api.put(`${base(venueId)}/menu/availability`, body)).data.data

/** `tray:true` = la bandeja en primer plano: la cabecera le dice al servidor que mantenga abierta la tienda. */
export const getInbox = async (venueId: string, opts: { tray: boolean }): Promise<Inbox> =>
  (
    await api.get(`${base(venueId)}/orders`, {
      params: { status: 'all' },
      ...(opts.tray ? { headers: { 'x-online-orders-tray': '1' } } : {}),
    })
  ).data.data

const act = async (venueId: string, orderId: string, action: string, body: object = {}): Promise<ActionResult> =>
  (await api.post(`${base(venueId)}/orders/${orderId}/${action}`, body)).data.data

export const acceptOrder = (venueId: string, orderId: string, estimatedMinutes: number) =>
  act(venueId, orderId, 'accept', { estimatedMinutes })
export const rejectOrder = (venueId: string, orderId: string, reason: RejectReason, note?: string) =>
  act(venueId, orderId, 'reject', note ? { reason, note } : { reason })
export const markReady = (venueId: string, orderId: string) => act(venueId, orderId, 'ready')
export const markDelivered = (venueId: string, orderId: string) => act(venueId, orderId, 'delivered')
export const cancelOrder = (venueId: string, orderId: string) => act(venueId, orderId, 'cancel')

export const pauseOrdering = async (venueId: string, minutes: PauseMinutes): Promise<{ pausedUntil: string | null; manualPause: boolean }> =>
  (await api.post(`${base(venueId)}/pause`, { minutes })).data.data

const GENERIC = 'No se pudo completar la acción. Intenta de nuevo.'
export function serverMessage(error: unknown): string {
  const data = (error as { response?: { data?: { error?: unknown; message?: unknown } } } | undefined)?.response?.data
  const msg = data?.error ?? data?.message
  return typeof msg === 'string' && msg ? msg : GENERIC
}
