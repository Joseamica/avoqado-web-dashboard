import type { DraftTable, EditorDoc } from './types'

// Ayudas puras del reductor (R25: el reductor no pasa de 500 líneas).

/** Mismo valor: igual, o el mismo objeto anidado (la posición vieja `legacy`) por contenido. */
const sameValue = (a: unknown, b: unknown) =>
  a === b || (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null && JSON.stringify(a) === JSON.stringify(b))
function sameItem<T extends object>(a: T, b: T): boolean {
  if (a === b) return true
  const keys = Object.keys(a) as Array<keyof T>
  return keys.length === Object.keys(b).length && keys.every(k => sameValue(a[k], b[k]))
}
const sameList = <T extends object>(a: T[], b: T[]) => a === b || (a.length === b.length && a.every((x, i) => sameItem(x, b[i])))
/** El cambio no cambió nada (girar una barra cuadrada, la misma forma, el mismo lugar…): no merece un paso de deshacer. */
export const sameDoc = (a: EditorDoc, b: EditorDoc) => sameList(a.areas, b.areas) && sameList(a.tables, b.tables) && sameList(a.elements, b.elements)

/** La pestaña que se abre al deshacer/rehacer: la del cambio si sigue existiendo; si no, la abierta; si no, la primera. */
export function areaIn(doc: EditorDoc, preferred: string | null, current: string | null): string | null {
  const has = (key: string | null) => key !== null && doc.areas.some(a => a.key === key)
  return has(preferred) ? preferred : has(current) ? current : (doc.areas[0]?.key ?? null)
}

export const keepExisting = (doc: EditorDoc, keys: string[]) => {
  const all = new Set([...doc.tables.map(t => t.key), ...doc.elements.map(e => e.key)])
  return keys.filter(k => all.has(k))
}

/**
 * Lo seleccionado que se VE en la pestaña `areaKey`: sus mesas y elementos, más las mesas «Sin acomodar» (la bandeja
 * sale en todas). Así, si deshacer cambia de pestaña, no queda seleccionada una pieza de otra área que Supr o las
 * flechas editarían sin que se vea.
 */
export function selectionIn(doc: EditorDoc, keys: string[], areaKey: string | null): string[] {
  const visible = new Set([
    ...doc.tables.filter(t => t.areaKey === areaKey || t.areaKey === null).map(t => t.key),
    ...doc.elements.filter(e => e.areaKey === areaKey).map(e => e.key),
  ])
  return keys.filter(k => visible.has(k))
}

export const markOpen = (doc: EditorDoc, keys: ReadonlySet<string>): EditorDoc =>
  doc.tables.some(t => keys.has(t.key) && !t.hasOpenOrder)
    ? { ...doc, tables: doc.tables.map(t => (keys.has(t.key) && !t.hasOpenOrder ? { ...t, hasOpenOrder: true } : t)) }
    : doc

/**
 * Números de mesa repetidos en el borrador (comparados sin espacios), con las claves de cada grupo. El servidor rechaza
 * un plano así; el editor lo enseña antes y no deja guardar. Hoy sólo puede pasar al regresar una mesa con cuenta cuyo
 * número ya tomó una mesa nueva.
 */
export function duplicateNumbers(tables: readonly DraftTable[]): Array<{ number: string; keys: string[] }> {
  const byNumber = new Map<string, string[]>()
  for (const t of tables) {
    const n = t.number.trim()
    const keys = byNumber.get(n)
    if (keys) keys.push(t.key)
    else byNumber.set(n, [t.key])
  }
  return [...byNumber].filter(([, keys]) => keys.length > 1).map(([number, keys]) => ({ number, keys }))
}

/**
 * De cada grupo de números repetidos, las mesas a las que hay que cambiarles el número: las que NO tienen cuenta
 * abierta («la nueva», p. ej. la que tomó el número de una que se regresó tras un 422). Si todas tienen cuenta, todas
 * las del grupo: si no, «Ver cuáles» no seleccionaba nada (m3 de 15-D).
 */
export function keysToRenumber(groups: ReadonlyArray<{ keys: string[] }>, tables: readonly DraftTable[]): string[] {
  const open = new Set(tables.filter(t => t.hasOpenOrder).map(t => t.key))
  return groups.flatMap(g => {
    const fresh = g.keys.filter(k => !open.has(k))
    return fresh.length ? fresh : g.keys
  })
}
