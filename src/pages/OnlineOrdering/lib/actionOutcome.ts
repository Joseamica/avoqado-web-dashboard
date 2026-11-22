import type { OnlineOrderStatus } from '@/types/onlineOrdering'

export type ActionOutcome =
  'success' | 'gone' | 'marked' | 'paymentRequired' | 'hasPayments' | 'confirming' | 'paidByCard' | 'network' | 'error'

/**
 * Qué significa el error de una acción de la bandeja. `api.ts` reintenta un POST tras un error de red: si el primero sí llegó, el
 * segundo responde 409 ORDER_STATE_CHANGED con el pedido YA en el estado pedido ⇒ es éxito, no «ya no está disponible».
 * `error` ⇒ la UI muestra `serverMessage` (p. ej. ORDER_CANCEL_BLOCKED_BY_TERMINAL_CHARGE).
 * Tarjeta en línea: `confirming` (un segundo «Aceptar» mientras se cobra; el servidor nunca cobra dos veces) y `paidByCard` no son
 * errores rojos: aviso con el texto del servidor.
 * D661: `marked` = el 409 trae una marca («No lo recogió», «Devolviendo…», «Devuelto»): aunque el estado coincida NO es éxito; se
 * avisa con el texto del servidor y la tarjeta no se oculta. Ruling 71: el SERVIDOR nuevo lo dice con su propio código
 * (`ORDER_CLOSED_NOT_DELIVERED`, mismo cuerpo); el publicado, con ORDER_STATE_CHANGED y la marca.
 */
export function actionOutcome(error: unknown, target: OnlineOrderStatus): ActionOutcome {
  type Data = { code?: unknown; status?: unknown; notPickedUpAt?: unknown; refundRequestedAt?: unknown; refundedAt?: unknown }
  const res = (error as { response?: { status?: number; data?: Data } } | undefined)?.response
  if (!res) return 'network'
  const code = res.data?.code
  if (code === 'ORDER_CLOSED_NOT_DELIVERED') return 'marked'
  if (code === 'ORDER_STATE_CHANGED') {
    if (res.data?.notPickedUpAt || res.data?.refundRequestedAt || res.data?.refundedAt) return 'marked'
    return res.data?.status === target ? 'success' : 'gone'
  }
  if (res.status === 404) return 'gone'
  if (code === 'PAYMENT_REQUIRED') return 'paymentRequired'
  if (code === 'ORDER_HAS_PAYMENTS') return 'hasPayments'
  if (code === 'ONLINE_ORDER_CONFIRMING_PAYMENT') return 'confirming'
  if (code === 'ONLINE_ORDER_PAID_BY_CARD') return 'paidByCard'
  return 'error'
}
