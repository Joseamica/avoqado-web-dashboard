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
