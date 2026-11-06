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
