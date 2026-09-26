import type { MutableRefObject } from 'react'

export type PedidoEnVuelo<T> = { llave: string; promesa: Promise<T> } | null

/**
 * Comparte UNA petición en vuelo entre dos corridas del mismo efecto con la misma llave.
 *
 * 🔴 El /full-testing del 26-sep vio la pantalla de planes pedir DOS SetupIntent al abrir: React (StrictMode) corre el
 * efecto dos veces, cada corrida mandaba el suyo, y el servidor creaba el cliente de Stripe dos veces en carrera. El
 * `ref` sobrevive a esa doble corrida; se suelta en cuanto la petición termina, así que nunca se reusa un SetupIntent
 * que ya pudo quedar gastado (tras un rechazo o un cobro).
 */
export function pedidoCompartido<T>(ref: MutableRefObject<PedidoEnVuelo<T>>, llave: string, crear: () => Promise<T>): Promise<T> {
  if (ref.current && ref.current.llave === llave) return ref.current.promesa
  const promesa = crear()
  ref.current = { llave, promesa }
  const soltar = () => {
    if (ref.current?.promesa === promesa) ref.current = null
  }
  promesa.then(soltar, soltar)
  return promesa
}
