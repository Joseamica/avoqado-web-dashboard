import type { CommissionConfig } from '@/types/commission'

/**
 * ¿Quién paga cuando dos esquemas activos se enciman? (ft-graves, D-REACTIVAR). Regla del server: una categoría la paga UN solo
 * esquema, el de mayor prioridad; y de dos esquemas generales (sin categorías) paga sólo uno, también el de mayor prioridad. Con la
 * misma prioridad no está definido cuál: la pantalla lo dice y pide subir la prioridad del que deba pagar.
 */

export type EsquemaDePago = Pick<CommissionConfig, 'id' | 'name' | 'priority' | 'filterByCategories' | 'categoryIds'>

export interface Solape<E extends EsquemaDePago = EsquemaDePago> {
  a: E
  b: E
  /** Las categorías que comparten; `null` = los dos son generales. */
  categorias: string[] | null
  /** El que paga, o `null` si tienen la misma prioridad. */
  paga: E | null
}

export const esGeneral = (e: EsquemaDePago) => !e.filterByCategories || !e.categoryIds?.length

/** El solape entre dos esquemas, o `null` si no comparten nada (uno general y otro por categorías no se cuentan aquí). */
export function solape<E extends EsquemaDePago>(a: E, b: E): Solape<E> | null {
  let categorias: string[] | null
  if (esGeneral(a) && esGeneral(b)) categorias = null
  else if (esGeneral(a) || esGeneral(b)) return null
  else {
    const deB = new Set(b.categoryIds)
    categorias = a.categoryIds.filter(id => deB.has(id))
    if (categorias.length === 0) return null
  }
  const paga = (a.priority ?? 0) === (b.priority ?? 0) ? null : (a.priority ?? 0) > (b.priority ?? 0) ? a : b
  return { a, b, categorias, paga }
}

/** Los solapes de `esquema` con los demás activos (sin contarse a sí mismo). */
export const solapesDe = <E extends EsquemaDePago>(esquema: E, activos: readonly E[]): Solape<E>[] =>
  activos.filter(o => o.id !== esquema.id).flatMap(o => {
    const s = solape(esquema, o)
    return s ? [s] : []
  })

/** Todos los solapes entre pares de esquemas activos. */
export function solapesEntre<E extends EsquemaDePago>(activos: readonly E[]): Solape<E>[] {
  const todos: Solape<E>[] = []
  activos.forEach((a, i) =>
    activos.slice(i + 1).forEach(b => {
      const s = solape(a, b)
      if (s) todos.push(s)
    }),
  )
  return todos
}

/**
 * ¿Lo reemplazó otro? «Duplicar con cambios» crea el nuevo y apaga el original en UNA transacción: el nuevo nace en el mismo
 * instante en que el original se desactivó. Si el server manda el vínculo (`reemplazadoPor`), manda ése.
 */
export function reemplazadoPor<E extends EsquemaDePago & Pick<CommissionConfig, 'active' | 'createdAt' | 'updatedAt'>>(
  inactivo: E & { reemplazadoPor?: { id?: string; name?: string } | string | null },
  activos: readonly E[],
): { name: string } | null {
  const vinculo = inactivo.reemplazadoPor
  if (vinculo) {
    const id = typeof vinculo === 'string' ? vinculo : vinculo.id
    const nombre = typeof vinculo === 'string' ? undefined : vinculo.name
    const activo = activos.find(o => o.id === id)
    if (nombre || activo) return { name: nombre ?? activo!.name }
  }
  if (inactivo.active) return null
  const apagado = new Date(inactivo.updatedAt).getTime()
  const creado = new Date(inactivo.createdAt).getTime()
  // Se apagó DESPUÉS de crearse (no nació así, como en una carga inicial) y otro nació en ese mismo instante, después que él.
  if (!(apagado - creado > 1000)) return null
  const nuevo = activos.find(o => {
    const nacio = new Date(o.createdAt).getTime()
    return o.id !== inactivo.id && nacio > creado && Math.abs(nacio - apagado) <= 5000
  })
  return nuevo ? { name: nuevo.name } : null
}
