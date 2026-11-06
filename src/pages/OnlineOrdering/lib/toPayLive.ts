import type { QueryClient } from '@tanstack/react-query'

import { onlineOrderingKeys } from '@/services/onlineOrdering.service'
import type { ToPayResponse } from '@/types/onlineOrdering'

/**
 * R88 · El MODO de la consulta `to-pay` (VIVO: 10 s y releer con eventos · LENTO: 120 s y sin eventos) sale ÚNICAMENTE de la última
 * respuesta buena de to-pay: `showTile` (la lectura fresca de los ajustes en el SERVIDOR), conteos > 0 o una primera página con folios.
 * Ni los ajustes guardados en el panel ni la historia de la Bandeja deciden el modo (se quedaban pegados). Sin respuesta (arranque en
 * frío o error) es LENTO, con el reintento normal; la consulta nunca se apaga.
 */
export const toPayModeIsLive = (d: ToPayResponse | undefined): boolean =>
  !!d && (d.showTile || d.counts.toPay + d.counts.toDeliver > 0 || d.toPay.length > 0 || d.toDeliver.length > 0)

export const toPayIsLive = (queryClient: QueryClient, venueId: string): boolean =>
  toPayModeIsLive(queryClient.getQueryData<ToPayResponse>(onlineOrderingKeys.toPay(venueId)))

/** Un evento o una acción relee `to-pay` sólo en modo vivo; en modo lento espera su repaso de 120 s. */
export const invalidateToPay = (queryClient: QueryClient, venueId: string) =>
  toPayIsLive(queryClient, venueId) ? queryClient.invalidateQueries({ queryKey: onlineOrderingKeys.toPay(venueId) }) : Promise.resolve()
