/**
 * Un enlace del menú se resalta sólo si ningún hermano de su misma lista es más específico y también coincide con la
 * ruta. En «Clientes», `loyalty` (Programa de Lealtad) es prefijo de `loyalty/card` y `loyalty/promotions`: en Promociones
 * de lealtad se resaltaban los dos renglones (visto al hacer la guía de Tarjeta de sellos, 13-nov).
 */
export function enlaceActivo(url: string, hermanos: string[], coincide: (url: string) => boolean): boolean {
  if (!coincide(url)) return false
  const base = url.replace(/\/+$/, '')
  return !hermanos.some(h => h !== url && h.startsWith(`${base}/`) && coincide(h))
}
