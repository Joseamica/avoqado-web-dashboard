import type { QueryClient } from '@tanstack/react-query'

import { onlineOrderingKeys } from '@/services/onlineOrdering.service'
import type { Inbox, ToPayResponse } from '@/types/onlineOrdering'

/**
 * ¿La consulta `to-pay` debe estar VIVA (sondeo de 10 s + releer con eventos de la Bandeja)? Sí si hay folios (conteos o listas de la
 * primera página), si la Bandeja ya vio un folio de «Nadie» o si los ajustes dicen «Nadie». Si no, va en modo LENTO (120 s, sin
 * eventos). La consulta NUNCA se apaga del todo: un folio que llega justo tras una lectura la despierta en el siguiente repaso.
 */
export function toPayIsLive(queryClient: QueryClient, venueId: string, inboxSignal = false): boolean {
  const d = queryClient.getQueryData<ToPayResponse>(onlineOrderingKeys.toPay(venueId))
  if (d && (d.counts.toPay + d.counts.toDeliver > 0 || d.toPay.length > 0 || d.toDeliver.length > 0)) return true
  if (queryClient.getQueryData<{ requiresAcceptance?: boolean }>(onlineOrderingKeys.settings(venueId))?.requiresAcceptance === false)
    return true
  if (queryClient.getQueryData<Inbox>(onlineOrderingKeys.inbox(venueId))?.orders.some(o => o.requiresAcceptance === false)) return true
  return inboxSignal
}

/** Un evento o una acción relee `to-pay` sólo en modo vivo; en modo lento espera su repaso de 120 s. */
export const invalidateToPay = (queryClient: QueryClient, venueId: string) =>
  toPayIsLive(queryClient, venueId) ? queryClient.invalidateQueries({ queryKey: onlineOrderingKeys.toPay(venueId) }) : Promise.resolve()
