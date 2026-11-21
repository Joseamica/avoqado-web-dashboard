import { useSyncExternalStore } from 'react'

/**
 * D661 · Ruling 61 (enmendado en la ronda 3): la devolución mandada de la que todavía no se sabe qué pasó, por pedido. Se anota ANTES de
 * mandarla y vive fuera de la hoja: cerrarla mientras dice «Devolviendo…» y volver a abrirla la deja fija, en «Reintentar» (la misma
 * llave y el mismo cuerpo), porque esa petición todavía puede ganar. Sólo la quita una respuesta definitiva para esa llave, una lista con
 * una devolución más nueva que la que se vio al mandar, o la salida de 10 minutos (`CardRefundSheet`).
 */
const dudas = new Map<string, unknown>()
const oyentes = new Set<() => void>()
const avisar = () => oyentes.forEach(oyente => oyente())
const llave = (venueId: string, orderId: string) => `${venueId}:${orderId}`
const suscribir = (oyente: () => void) => {
  oyentes.add(oyente)
  return () => {
    oyentes.delete(oyente)
  }
}

export const ponerDuda = (venueId: string, orderId: string, duda: unknown) => {
  dudas.set(llave(venueId, orderId), duda)
  avisar()
}
export const quitarDuda = (venueId: string, orderId: string) => {
  if (dudas.delete(llave(venueId, orderId))) avisar()
}
/** La duda de un pedido, viva: cada hoja abierta se entera cuando otra (o la respuesta de una ya cerrada) la pone o la quita. */
export function useDuda<T>(venueId: string, orderId: string): T | null {
  return useSyncExternalStore(suscribir, () => (dudas.get(llave(venueId, orderId)) as T | undefined) ?? null)
}
/** Para las pruebas: cada una empieza sin las dudas de otra. */
export const olvidarDudas = () => {
  dudas.clear()
  avisar()
}
