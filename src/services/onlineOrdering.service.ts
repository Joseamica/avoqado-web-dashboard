/**
 * Pedidos en línea (panel). El servidor envuelve en `{ success, data }`.
 * Dos formas de error: transiciones `{success:false, code, error, status}` y el manejador global `{message, code?, details?}`
 * → `serverMessage` lee las dos.
 */
import api from '@/api'
import type {
  ActionResult,
  CardRefund,
  CardRefundReason,
  CardRefundResolveMethod,
  CardRefundResult,
  Inbox,
  InboxOrder,
  MenuCategoriesSummary,
  MenuProductsPage,
  OnlineOrderingSettings,
  OnlineOrderingSettingsInput,
  OnlineOrderingSettingsSaved,
  PauseMinutes,
  RejectReason,
  ToPayResponse,
} from '@/types/onlineOrdering'

const base = (venueId: string) => `/api/v1/dashboard/venues/${venueId}/online-ordering`

export const onlineOrderingKeys = {
  settings: (v: string) => ['online-ordering', v, 'settings'] as const,
  categories: (v: string) => ['online-ordering', v, 'menu', 'categories'] as const,
  products: (v: string, q: object) => ['online-ordering', v, 'menu', 'products', q] as const,
  toPay: (v: string) => ['online-ordering', v, 'to-pay'] as const,
  inbox: (v: string) => ['online-ordering', v, 'inbox'] as const,
  order: (v: string, orderId: string) => ['online-ordering', v, 'order', orderId] as const,
  cardRefunds: (v: string, orderId: string) => ['online-ordering', v, 'order', orderId, 'card-refunds'] as const,
}

export const getSettings = async (venueId: string): Promise<OnlineOrderingSettings> =>
  (await api.get(`${base(venueId)}/settings`)).data.data

export const updateSettings = async (
  venueId: string,
  patch: Partial<OnlineOrderingSettingsInput>,
): Promise<OnlineOrderingSettingsSaved> => (await api.put(`${base(venueId)}/settings`, patch)).data.data

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
export const getInbox = async (venueId: string, opts: { tray: boolean; status?: 'all' | 'active'; cursor?: string }): Promise<Inbox> =>
  (
    await api.get(`${base(venueId)}/orders`, {
      params: { status: opts.status ?? 'all', ...(opts.cursor ? { cursor: opts.cursor } : {}) },
      ...(opts.tray ? { headers: { 'x-online-orders-tray': '1' } } : {}),
    })
  ).data.data

/** Folios de «Nadie»: por pagar y por entregar. Sin cabecera de latido a propósito. `section`+`cursor` piden la siguiente página. */
export const getToPay = async (venueId: string, params?: { section?: 'toPay' | 'toDeliver'; cursor?: string }): Promise<ToPayResponse> =>
  (await api.get(`${base(venueId)}/orders/to-pay`, { params })).data.data

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

/**
 * UN pedido en línea por el id de su cuenta, con la forma de la bandeja (la bandeja sólo guarda 24 h). `null` = 404: la cuenta no es
 * pedido en línea.
 */
export const getOnlineOrder = async (venueId: string, orderId: string): Promise<InboxOrder | null> => {
  try {
    return (await api.get(`${base(venueId)}/orders/${orderId}`)).data.data
  } catch (error) {
    if ((error as { response?: { status?: number } } | undefined)?.response?.status === 404) return null
    throw error
  }
}

export const listCardRefunds = async (venueId: string, orderId: string): Promise<CardRefund[]> =>
  (await api.get(`${base(venueId)}/orders/${orderId}/card-refunds`)).data.data

/**
 * 🔴 `amount` en PESOS como texto («120.50»), nunca centavos. La llave y `expectedLatestRefundId` (la última devolución que vio el
 * operador, `null` si ninguna) son los del intento: los MISMOS en sus reintentos.
 */
export const createCardRefund = async (
  venueId: string,
  orderId: string,
  body: { amount: string; reason: CardRefundReason; note?: string; expectedLatestRefundId: string | null },
  idempotencyKey: string,
): Promise<CardRefundResult> =>
  (await api.post(`${base(venueId)}/orders/${orderId}/card-refund`, body, { headers: { 'Idempotency-Key': idempotencyKey } })).data.data

export const resolveCardRefund = async (
  venueId: string,
  orderId: string,
  refundId: string,
  body: { method: CardRefundResolveMethod; note?: string },
): Promise<{ status: 'RESOLVED'; replay: boolean }> =>
  (await api.post(`${base(venueId)}/orders/${orderId}/card-refund/${refundId}/resolve`, body, { repetible: true })).data.data

/** `fallback` ya viene traducido por la UI (`t('…')`): nada de texto fijo en español aquí. */
export function serverMessage(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: { error?: unknown; message?: unknown } } } | undefined)?.response?.data
  const msg = data?.error ?? data?.message
  return typeof msg === 'string' && msg ? msg : fallback
}
