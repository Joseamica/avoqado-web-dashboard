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

/** Cada duda es de UNA llave (la de la petición que se mandó). */
type Duda = { attempt: { key: string } }

export const ponerDuda = (venueId: string, orderId: string, duda: Duda) => {
  dudas.set(llave(venueId, orderId), duda)
  avisar()
}
/**
 * Sólo si la duda guardada es de esa llave: la respuesta tardía de una petición vieja (de una hoja ya cerrada) no suelta la de un envío
 * más nuevo con otra llave.
 */
export const quitarDuda = (venueId: string, orderId: string, key: string) => {
  const k = llave(venueId, orderId)
  if ((dudas.get(k) as Duda | undefined)?.attempt.key !== key) return
  dudas.delete(k)
  sinRespuesta.delete(key)
  avisar()
}
/** La duda de un pedido, viva: cada hoja abierta se entera cuando otra (o la respuesta de una ya cerrada) la pone o la quita. */
export function useDuda<T>(venueId: string, orderId: string): T | null {
  return useSyncExternalStore(suscribir, () => (dudas.get(llave(venueId, orderId)) as T | undefined) ?? null)
}

/**
 * Ruling 90: cuántas peticiones de cada llave siguen en camino desde esta pestaña (las de una hoja ya cerrada también). Mientras quede
 * una, el rechazo de otra con la misma llave no dice qué hará ella: todavía puede ganar con lo que se mandó.
 */
const enCamino = new Map<string, number>()
export async function mandarConLlave<T>(key: string, peticion: () => Promise<T>): Promise<T> {
  enCamino.set(key, (enCamino.get(key) ?? 0) + 1)
  try {
    return await peticion()
  } finally {
    const quedan = (enCamino.get(key) ?? 1) - 1
    if (quedan > 0) enCamino.set(key, quedan)
    else enCamino.delete(key)
  }
}
export const sigueEnCamino = (key: string) => enCamino.has(key)

/**
 * Ruling 98: llaves con una petición que terminó SIN respuesta definitiva (sin respuesta, o la página de error de un intermediario):
 * pudo seguir en el SERVIDOR. Cuenta hasta que se suelta su duda (respuesta definitiva, devolución nueva o la salida de 10 minutos).
 */
const sinRespuesta = new Set<string>()
export const quedoSinRespuesta = (key: string) => void sinRespuesta.add(key)
export const pudoSeguirEnCamino = (key: string) => sinRespuesta.has(key)

/** La llave del envío que está en duda en ese pedido (Ruling 101: qué intento enseña una hoja reabierta). */
export const llaveEnDuda = (venueId: string, orderId: string) =>
  (dudas.get(llave(venueId, orderId)) as Duda | undefined)?.attempt.key ?? null

/**
 * Por qué el saldo a favor no se pudo, a las hojas ABIERTAS de ese pedido: la respuesta puede llegarle a una hoja ya cerrada mientras
 * otra (la reabierta) sigue en pantalla. Ruling 101: va con la llave del intento; sólo la hoja que enseña ESE intento lo toma (cambia a
 * «A su tarjeta»). Contesta si alguna lo tomó (si no, quien lo manda lo avisa aparte).
 */
type OyenteSinSaldo = (texto: string, key: string) => boolean
const oyentesSinSaldo = new Map<string, Set<OyenteSinSaldo>>()
export function escucharSinSaldo(venueId: string, orderId: string, oyente: OyenteSinSaldo) {
  const k = llave(venueId, orderId)
  const oyentes = oyentesSinSaldo.get(k) ?? new Set()
  oyentes.add(oyente)
  oyentesSinSaldo.set(k, oyentes)
  return () => {
    oyentes.delete(oyente)
    if (!oyentes.size) oyentesSinSaldo.delete(k)
  }
}
export function avisarSinSaldo(venueId: string, orderId: string, texto: string, key: string) {
  let tomado = false
  oyentesSinSaldo.get(llave(venueId, orderId))?.forEach(oyente => {
    if (oyente(texto, key)) tomado = true
  })
  return tomado
}

/** Para las pruebas: cada una empieza sin las dudas de otra. */
export const olvidarDudas = () => {
  dudas.clear()
  enCamino.clear()
  sinRespuesta.clear()
  avisar()
}
