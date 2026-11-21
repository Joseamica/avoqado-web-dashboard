/**
 * D661 · Ruling 61: la devolución que se mandó y se quedó sin respuesta, por pedido. Vive fuera de la hoja para que cerrarla y volver a
 * abrirla no la suelte: mientras exista, la hoja sólo deja «Reintentar» (la misma llave y el mismo cuerpo) o «Cerrar». Se quita con una
 * respuesta definitiva para esa llave, o cuando la lista trae una devolución más nueva que la que se vio al mandarla (desde ahí el
 * SERVIDOR ya no deja que esa petición haga otra).
 */
const dudas = new Map<string, unknown>()
const llave = (venueId: string, orderId: string) => `${venueId}:${orderId}`

export const leerDuda = <T>(venueId: string, orderId: string): T | null => (dudas.get(llave(venueId, orderId)) as T | undefined) ?? null
export const ponerDuda = (venueId: string, orderId: string, duda: unknown) => {
  dudas.set(llave(venueId, orderId), duda)
}
export const quitarDuda = (venueId: string, orderId: string) => {
  dudas.delete(llave(venueId, orderId))
}
/** Para las pruebas: cada una empieza sin las dudas de otra. */
export const olvidarDudas = () => dudas.clear()
