import type { InboxOrder } from '@/types/onlineOrdering'

/**
 * D661 (tarjeta en «Nadie»): en qué quedó el pedido, del SERVIDOR. Manda la devolución: «Devuelto» > «Devolviendo…» > «No lo recogió»
 * (un «No lo recogió» que se devuelve dice «Devolviendo…» y luego «Devuelto»). Sin marcas (o SERVIDOR viejo), `null`.
 * Ruling 60: si el SERVIDOR manda `refund` (el estado real del dinero), decide él: tras una reversa `refundedAt` se queda (el pedido
 * sigue cerrado) pero la clienta no recibió su dinero; y si el negocio se la pagó por otro medio, se dice cuál. Sólo en «Nadie»: en
 * «Mi equipo» una devolución parcial no marca el pedido.
 */
export const marcaDelPedido = (
  o: Pick<InboxOrder, 'requiresAcceptance' | 'refund' | 'notPickedUpAt' | 'refundRequestedAt' | 'refundedAt'>,
) => {
  const dinero = o.requiresAcceptance === false ? o.refund : null
  if (dinero?.status === 'REVERSED') return 'reversed'
  if (dinero?.status === 'PENDING') return 'refunding'
  if (dinero?.status === 'DONE') {
    return dinero.medio === 'EFECTIVO' ? 'refundedCash' : dinero.medio === 'TRANSFERENCIA' ? 'refundedTransfer' : 'refunded'
  }
  return o.refundedAt ? 'refunded' : o.refundRequestedAt ? 'refunding' : o.notPickedUpAt ? 'notPickedUp' : null
}
