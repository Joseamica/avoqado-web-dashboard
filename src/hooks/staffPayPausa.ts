import type { MutationKey, QueryClient } from '@tanstack/react-query'

/**
 * Sin red, TanStack deja el envío EN PAUSA (`isPaused`) y lo manda solo al volver la red (E6a-fix2 C5). En pausa la petición
 * todavía NO salió (con `networkMode` «online» la pausa es antes de llamar al servicio), así que cancelarla es seguro si se
 * quita de la cola: `cancelarEnPausa` la saca del caché de mutaciones (al volver la red no se reanuda) y suelta el estado del
 * botón. Devuelve si había algo en pausa.
 */
export function conCancelarEnPausa<M extends { reset: () => void }>(mutacion: M, qc: QueryClient, mutationKey: MutationKey) {
  const cancelarEnPausa = () => {
    const cache = qc.getMutationCache()
    const enPausa = cache.findAll({ mutationKey, predicate: x => x.state.isPaused })
    for (const x of enPausa) cache.remove(x)
    if (enPausa.length) mutacion.reset()
    return enPausa.length > 0
  }
  return { ...mutacion, cancelarEnPausa }
}
