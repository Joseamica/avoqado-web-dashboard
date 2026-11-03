import type { OnlineOrderStatus } from '@/types/onlineOrdering'

export type ActionOutcome = 'success' | 'gone' | 'paymentRequired' | 'hasPayments' | 'confirming' | 'paidByCard' | 'network' | 'error'

/**
 * Qué significa el error de una acción de la bandeja. `api.ts` reintenta un POST tras un error de red: si el primero sí llegó, el
 * segundo responde 409 ORDER_STATE_CHANGED con el pedido YA en el estado pedido ⇒ es éxito, no «ya no está disponible».
 * `error` ⇒ la UI muestra `serverMessage` (p. ej. ORDER_CANCEL_BLOCKED_BY_TERMINAL_CHARGE).
 * Tarjeta en línea: `confirming` (un segundo «Aceptar» mientras se cobra; el servidor nunca cobra dos veces) y `paidByCard` no son
 * errores rojos: aviso con el texto del servidor.
 */
export function actionOutcome(error: unknown, target: OnlineOrderStatus): ActionOutcome {
  const res = (error as { response?: { status?: number; data?: { code?: unknown; status?: unknown } } } | undefined)?.response
  if (!res) return 'network'
  const code = res.data?.code
  if (code === 'ORDER_STATE_CHANGED') return res.data?.status === target ? 'success' : 'gone'
  if (res.status === 404) return 'gone'
  if (code === 'PAYMENT_REQUIRED') return 'paymentRequired'
  if (code === 'ORDER_HAS_PAYMENTS') return 'hasPayments'
  if (code === 'ONLINE_ORDER_CONFIRMING_PAYMENT') return 'confirming'
  if (code === 'ONLINE_ORDER_PAID_BY_CARD') return 'paidByCard'
  return 'error'
}
