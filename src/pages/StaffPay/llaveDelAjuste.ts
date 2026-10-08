/**
 * La clave de un ajuste manual vive mientras viva su BORRADOR, no mientras viva el modal (E6a-fix2 D1, full-testing E6a).
 *
 * El servidor guarda una vez por clave: la misma clave con el mismo contenido devuelve el ajuste que ya guardó (`yaExistia`).
 * Antes la clave nacía con cada modal: si la respuesta se perdía, el dueño cerraba, veía la tabla sin el ajuste, lo capturaba
 * otra vez y el modal nuevo mandaba OTRA clave ⇒ dos ajustes, se pagaba dos veces.
 *
 * Ahora la clave se anota ANTES de tocar la red, por su huella (sede, persona, monto con signo y motivo), y se suelta sólo con
 * un desenlace: un 2xx la gasta (otro bono idéntico de verdad, después, es OTRO ajuste) y un 4xx saca a ese borrador de la duda.
 * Sin respuesta, con un 5xx o con el envío en pausa, el mismo borrador capturado otra vez —aunque se haya cerrado el modal—
 * viaja con la MISMA clave. La fecha no entra en la huella: dentro del mismo periodo el servidor la trata como el mismo
 * destino, y en otro periodo responde 409 CLAVE_REUTILIZADA (nunca un segundo ajuste).
 *
 * Vive en la memoria de la pestaña: al recargar, la lista ya viene del servidor y dice si el ajuste quedó.
 */
export interface BorradorDeAjuste {
  sede: string
  staffId: string
  amount: number
  reason: string
}

const enDuda = new Map<string, string>()
const huella = (b: BorradorDeAjuste) => JSON.stringify([b.sede, b.staffId, b.amount.toFixed(2), b.reason])

/** La clave de un borrador que quedó en duda, o la propia del modal. */
export const claveDelBorrador = (b: BorradorDeAjuste, propia: string): string => enDuda.get(huella(b)) ?? propia
/** ¿Este borrador quedó sin desenlace (sin respuesta, 5xx o en pausa)? */
export const borradorEnDuda = (b: BorradorDeAjuste): boolean => enDuda.has(huella(b))
/** Se anota ANTES de mandar: si la respuesta no llega, el borrador conserva su clave. */
export const anotarBorrador = (b: BorradorDeAjuste, clave: string): void => {
  enDuda.set(huella(b), clave)
}
/** Una respuesta con desenlace (2xx): la clave quedó gastada, para este borrador y cualquier otro que la llevara. */
export const soltarClave = (clave: string): void => {
  for (const [h, c] of enDuda) if (c === clave) enDuda.delete(h)
}
/** Un rechazo con desenlace (4xx) de ESE borrador: deja de estar en duda. */
export const soltarBorrador = (b: BorradorDeAjuste): void => {
  enDuda.delete(huella(b))
}
/** Sólo pruebas: cada una empieza sin borradores en duda. */
export const olvidarBorradoresEnDuda = (): void => enDuda.clear()
