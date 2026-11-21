import type { InboxOrder } from '@/types/onlineOrdering'

/**
 * D661 (tarjeta en «Nadie»): en qué quedó el pedido, del SERVIDOR. Manda la devolución: «Devuelto» > «Devolviendo…» > «No lo recogió»
 * (un «No lo recogió» que se devuelve dice «Devolviendo…» y luego «Devuelto»). Sin marcas (o SERVIDOR viejo), `null`.
 */
export const marcaDelPedido = (o: Pick<InboxOrder, 'notPickedUpAt' | 'refundRequestedAt' | 'refundedAt'>) =>
  o.refundedAt ? 'refunded' : o.refundRequestedAt ? 'refunding' : o.notPickedUpAt ? 'notPickedUp' : null
