import { clamp, round6 } from './floorGeometry'
import type { DraftElement, DraftTable, EditorDoc } from './types'

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

/**
 * Pared: por eje, si su caja cabe se TRASLADA entera al lienzo (nunca se dobla ni se acorta); si es más larga que el
 * lienzo, se apoya en el 0 y se recorta sobre su propia línea (conserva su dirección: 0°/45°/90° siguen siéndolo).
 */
export function clampWall(el: DraftElement, cols: number, rows: number): DraftElement {
  const shift = (a: number, b: number, size: number) => {
    const lo = Math.min(a, b)
    const hi = Math.max(a, b)
    if (hi - lo > size) return -lo
    return lo < 0 ? -lo : hi > size ? size - hi : 0
  }
  const ex = el.x2 ?? el.x
  const ey = el.y2 ?? el.y
  const sx = shift(el.x, ex, cols)
  const sy = shift(el.y, ey, rows)
  const x1 = el.x + sx
  const y1 = el.y + sy
  const x2 = ex + sx
  const y2 = ey + sy
  // Recorte de Liang–Barsky contra [0, cols] × [0, rows].
  const dx = x2 - x1
  const dy = y2 - y1
  let t0 = 0
  let t1 = 1
  for (const [p, q] of [[-dx, x1], [dx, cols - x1], [-dy, y1], [dy, rows - y1]]) {
    if (p === 0) {
      if (q < 0) t0 = Infinity
    } else if (p < 0) t0 = Math.max(t0, q / p)
    else t1 = Math.min(t1, q / p)
  }
  if (t0 > t1) {
    // Sólo si no cabe en NINGÚN eje (no lo produce el editor): último recurso, extremo por extremo.
    return { ...el, x: clamp(x1, 0, cols), y: clamp(y1, 0, rows), x2: clamp(x2, 0, cols), y2: clamp(y2, 0, rows) }
  }
  const at = (t: number, a: number, b: number) => round6(t === 0 ? a : t === 1 ? b : a + t * (b - a))
  return { ...el, x: at(t0, x1, x2), y: at(t0, y1, y2), x2: at(t1, x1, x2), y2: at(t1, y1, y2) }
}
