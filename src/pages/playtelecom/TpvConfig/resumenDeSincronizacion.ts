/**
 * A cuántas terminales llegó un guardado de ajustes POR SUCURSAL (spec «pantalla del cliente» §13, 6ª ronda de Codex).
 * `terminalsOmitted` son las que cambiaron de sucursal entre la lectura y la escritura: ya no reciben el cambio. Antes
 * la pantalla decía «se sincronizarán con todas las terminales» aunque no hubiera llegado a ninguna.
 */
export type ResumenDeSincronizacion =
  | { tipo: 'desconocido' }
  | { tipo: 'soloNegocio' }
  | { tipo: 'todas'; actualizadas: number }
  | { tipo: 'parcial'; actualizadas: number; omitidas: number }
  | { tipo: 'ninguna'; omitidas: number }

const entero = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null)

export function resumenDeSincronizacion(
  respuesta: { terminalsUpdated?: unknown; terminalsOmitted?: unknown } | null | undefined,
): ResumenDeSincronizacion {
  const actualizadas = entero(respuesta?.terminalsUpdated)
  const omitidas = entero(respuesta?.terminalsOmitted)
  // Un servidor viejo no manda los conteos: se dice lo de antes, nunca «ninguna».
  if (actualizadas === null || omitidas === null) return { tipo: 'desconocido' }
  if (actualizadas === 0 && omitidas === 0) return { tipo: 'soloNegocio' }
  if (omitidas === 0) return { tipo: 'todas', actualizadas }
  if (actualizadas === 0) return { tipo: 'ninguna', omitidas }
  return { tipo: 'parcial', actualizadas, omitidas }
}
