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
 * Al editar, sólo se manda lo que la persona cambió frente a lo que abrió (Codex D14 v2 r1 #1): un formulario abierto antes de
 * que otra persona guardara no debe pisar su límite o sus categorías con el valor viejo. Listas: mismo conjunto = igual.
 */
export const siCambio = <T>(nuevo: T, abierto: T): T | undefined => {
	const a = nuevo ?? null
	const b = abierto ?? null
	if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every(x => b.includes(x)) ? undefined : nuevo
	return a === b ? undefined : nuevo
}
