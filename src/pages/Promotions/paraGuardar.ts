import { DateTime } from 'luxon'

/**
 * D14 v2: cómo manda el panel el alcance y los límites de un descuento o cupón. Sólo la forma: si el valor vale lo decide el
 * SERVIDOR (validarCambioDeDescuento) frente a lo guardado, y el panel enseña su mensaje.
 */

/** Al editar, un límite vacío va como null (sin límite); antes se omitía y el límite viejo se quedaba. Al crear, se omite. */
export const limiteParaGuardar = (valor: number | null | undefined, editando: boolean): number | null | undefined =>
  valor ?? (editando ? null : undefined)

/** «Categorías» manda su lista aunque esté vacía (antes se omitía: quitar todas dejaba las viejas guardadas). */
export const categoriasParaGuardar = (scope: string, valores?: unknown[]): string[] | undefined =>
  scope === 'CATEGORY'
    ? (valores ?? []).map(v => (typeof v === 'object' && v !== null ? (v as { value: string }).value : String(v)))
    : undefined

/**
 * Al editar, sólo se manda lo que la persona cambió frente a lo que abrió (Codex D14 v2 r1 #1 y r3): un formulario abierto antes
 * de que otra persona guardara no debe pisar con el valor viejo un campo que no se tocó. En lo que sí se cambió, gana el último
 * que guarda (decisión del 5-nov). Listas: mismo conjunto = igual; null y vacío = igual.
 */
const igual = (nuevo: unknown, abierto: unknown) => {
  const a = nuevo ?? null
  const b = abierto ?? null
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every(x => b.includes(x))
  return a === b
}

export const siCambio = <T>(nuevo: T, abierto: unknown): T | undefined => (igual(nuevo, abierto) ? undefined : nuevo)

/** Quita del guardado cada campo igual a lo que se abrió. */
export const soloLoQueCambio = <T extends object>(datos: T, abierto: object | undefined): Partial<T> =>
  abierto
    ? (Object.fromEntries(Object.entries(datos).filter(([k, v]) => !igual(v, (abierto as Record<string, unknown>)[k]))) as Partial<T>)
    : datos

/**
 * D37 (21-nov-2026): «Válido desde/hasta» es un DÍA DEL NEGOCIO, en su zona: desde = 00:00 de ese día, hasta = 23:59:59.999. Antes el
 * panel mandaba 'YYYY-MM-DD' y el SERVIDOR lo guardaba a las 00:00 UTC: un cupón «hasta el 1-dic» dejaba de servir el 30-nov a las
 * 6 p. m. en México. Misma regla que `BundleEditor` (paquetes) y `parseCouponDate` del MCP.
 */
export const vigenciaParaGuardar = (fecha: string, zona: string, borde: 'desde' | 'hasta'): string => {
  const dia = DateTime.fromISO(fecha, { zone: zona })
  return (borde === 'desde' ? dia.startOf('day') : dia.endOf('day')).toUTC().toISO() as string
}

/** Lo guardado, como el día del negocio que va en la caja de fecha ('' si no hay). La caja nunca recibe un instante completo. */
export const vigenciaParaFormulario = (instante: string | null | undefined, zona: string): string =>
  instante ? (DateTime.fromISO(instante, { zone: 'utc' }).setZone(zona).toISODate() ?? '') : ''

/**
 * Lo que se manda de una fecha. Crear: vacío se omite. Editar: sólo si el día cambió frente al que se abrió (una fecha sin tocar no
 * mueve lo guardado, tampoco lo viejo a 00:00 UTC); vacío = null, la quita.
 */
export const vigenciaSiCambio = (
  fecha: string | undefined,
  abierto: string | null | undefined,
  zona: string,
  borde: 'desde' | 'hasta',
  editando: boolean,
): string | null | undefined => {
  if (editando && (fecha || '') === vigenciaParaFormulario(abierto, zona)) return undefined
  if (!fecha) return editando ? null : undefined
  return vigenciaParaGuardar(fecha, zona, borde)
}

type Fechas = { validFrom?: string; validUntil?: string }
type Abierto = { validFrom?: string | null; validUntil?: string | null }

/** Las dos fechas de un formulario de cupón o descuento, listas para mandar (`abierto` = lo que se editaba; sin él, es crear). */
export function vigenciaDelFormulario(valores: Fechas, zona: string): Fechas
export function vigenciaDelFormulario(valores: Fechas, zona: string, abierto: Abierto | undefined): Abierto
export function vigenciaDelFormulario(valores: Fechas, zona: string, abierto?: Abierto): Abierto {
  return {
    validFrom: vigenciaSiCambio(valores.validFrom, abierto?.validFrom, zona, 'desde', !!abierto),
    validUntil: vigenciaSiCambio(valores.validUntil, abierto?.validUntil, zona, 'hasta', !!abierto),
  }
}
