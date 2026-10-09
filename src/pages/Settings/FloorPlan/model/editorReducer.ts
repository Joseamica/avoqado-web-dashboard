import { clamp, gridOf, placeTable, rotatedExtent, round6, tableSizeCells } from './floorGeometry'
import type { DraftArea, DraftElement, DraftTable, EditorDoc } from './types'

export interface EditorState {
  doc: EditorDoc
  past: EditorDoc[]
  future: EditorDoc[]
  selection: string[]
  activeAreaKey: string | null
  dirty: boolean
}

export type EditorAction =
  | { type: 'LOAD'; doc: EditorDoc; activeIndex?: number }
  | { type: 'SET_ACTIVE_AREA'; key: string }
  | { type: 'SELECT'; keys: string[] }
  | { type: 'ADD_TABLE'; table: DraftTable }
  | { type: 'ADD_ELEMENT'; element: DraftElement }
  | { type: 'MOVE'; keys: string[]; dx: number; dy: number }
  | { type: 'PLACE_TABLE'; key: string; areaKey: string; x: number; y: number }
  | { type: 'UPDATE_TABLE'; key: string; patch: Partial<Pick<DraftTable, 'number' | 'capacity' | 'shape' | 'rotation' | 'areaKey'>> }
  | { type: 'UPDATE_ELEMENT'; key: string; patch: Partial<Pick<DraftElement, 'label' | 'w' | 'h' | 'rotation'>> }
  | { type: 'ROTATE'; keys: string[] }
  | { type: 'DUPLICATE'; clones: Array<{ sourceKey: string; key: string; number?: string }> }
  | { type: 'REMOVE'; keys: string[] }
  | { type: 'ADD_AREA'; area: DraftArea; tables: DraftTable[] }
  | { type: 'UPDATE_AREA'; key: string; patch: Partial<Pick<DraftArea, 'name' | 'floorShape'>> }
  | { type: 'MOVE_AREA'; key: string; direction: -1 | 1 }
  | { type: 'REMOVE_AREA'; key: string }
  | { type: 'UNDO' }
  | { type: 'REDO' }

const HISTORY_LIMIT = 100

export function initEditorState(doc: EditorDoc, activeIndex = 0): EditorState {
  return { doc, past: [], future: [], selection: [], activeAreaKey: doc.areas[activeIndex]?.key ?? doc.areas[0]?.key ?? null, dirty: false }
}

function commit(state: EditorState, doc: EditorDoc, selection: string[] = state.selection): EditorState {
  return { ...state, doc, past: [...state.past.slice(-(HISTORY_LIMIT - 1)), state.doc], future: [], selection, dirty: true }
}

const gridFor = (doc: EditorDoc, areaKey: string | null) => gridOf(doc.areas.find(a => a.key === areaKey)?.floorShape ?? 'WIDE')

function clampTable(t: DraftTable, cols: number, rows: number): DraftTable {
  if (t.x === null || t.y === null) return t
  const { w, h } = tableSizeCells(t.shape, t.capacity)
  const e = rotatedExtent(w, h, t.rotation)
  return { ...t, x: round6(clamp(t.x, e.w / 2, cols - e.w / 2)), y: round6(clamp(t.y, e.h / 2, rows - e.h / 2)) }
}

const isRect = (type: DraftElement['type']) => type === 'BAR_COUNTER' || type === 'SERVICE_AREA' || type === 'DOOR'

/**
 * Barras, zonas de servicio y puertas giran de a 90° INTERCAMBIANDO ancho y alto sobre el mismo centro: nunca guardan
 * 90/270/45, así la caja que se guarda es la que se ve. Sólo la puerta guarda 180 (abre hacia el otro lado).
 * Normaliza lo viejo (la PAX sí guardaba 90/270): 90 ⇒ lados intercambiados y 0; 270 ⇒ intercambiados y 0 (puerta: 180);
 * cualquier otro giro que no sea 0/180 ⇒ 0.
 */
export function normalizeRectElement(el: DraftElement): DraftElement {
  if (!isRect(el.type)) return el
  const r = ((el.rotation % 360) + 360) % 360
  if (r % 180 === 90) {
    const w = el.w ?? 1
    const h = el.h ?? 1
    return { ...el, w: h, h: w, x: round6(el.x + w / 2 - h / 2), y: round6(el.y + h / 2 - w / 2), rotation: el.type === 'DOOR' && r === 270 ? 180 : 0 }
  }
  const rotation = r === 0 || r === 180 ? r : 0
  return rotation === el.rotation ? el : { ...el, rotation }
}

/**
 * Pared: por eje, si su caja cabe se TRASLADA entera al lienzo (nunca se dobla ni se acorta); si es más larga que el
 * lienzo, se apoya en el 0 y se recorta sobre su propia línea (conserva su dirección: 0°/45°/90° siguen siéndolo).
 */
function clampWall(el: DraftElement, cols: number, rows: number): DraftElement {
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

function clampElement(el: DraftElement, cols: number, rows: number): DraftElement {
  if (el.type === 'WALL') return clampWall(el, cols, rows)
  if (el.type === 'LABEL') return { ...el, x: clamp(el.x, 0, cols - 1), y: clamp(el.y, 0, rows - 1) }
  // Barra, zona de servicio, puerta: giro 0 o 180, así que la caja sin girar ES la que se ve.
  const n = normalizeRectElement(el)
  const w = clamp(n.w ?? 1, 1, cols)
  const h = clamp(n.h ?? 1, 1, rows)
  return { ...n, w, h, x: round6(clamp(n.x, 0, cols - w)), y: round6(clamp(n.y, 0, rows - h)) }
}

/** Girar 90° una barra/zona/puerta: lados intercambiados sobre el mismo centro. Si parada no cabe en el área, no gira. */
function rotateRect(el: DraftElement, cols: number, rows: number): DraftElement {
  const n = normalizeRectElement(el)
  const w = n.w ?? 1
  const h = n.h ?? 1
  if (h > cols || w > rows) return el
  // La puerta recorre H0 → V0 → H180 → V180 → H0: al volver a quedar horizontal, abre hacia el otro lado.
  const rotation = n.type === 'DOOR' ? (h >= w ? (n.rotation + 180) % 360 : n.rotation) : 0
  return clampElement({ ...n, w: h, h: w, x: n.x + w / 2 - h / 2, y: n.y + h / 2 - w / 2, rotation }, cols, rows)
}

/** Cuánto se puede mover cada pieza sin salirse: [minDx, maxDx, minDy, maxDy]. */
function moveRange(doc: EditorDoc, keys: Set<string>): [number, number, number, number] {
  let r: [number, number, number, number] = [-Infinity, Infinity, -Infinity, Infinity]
  const narrow = (minX: number, maxX: number, minY: number, maxY: number) => {
    r = [Math.max(r[0], minX), Math.min(r[1], maxX), Math.max(r[2], minY), Math.min(r[3], maxY)]
  }
  for (const t of doc.tables) {
    if (!keys.has(t.key) || t.x === null || t.y === null) continue
    const { cols, rows } = gridFor(doc, t.areaKey)
    const s = tableSizeCells(t.shape, t.capacity)
    const e = rotatedExtent(s.w, s.h, t.rotation)
    narrow(e.w / 2 - t.x, cols - e.w / 2 - t.x, e.h / 2 - t.y, rows - e.h / 2 - t.y)
  }
  for (const el of doc.elements) {
    if (!keys.has(el.key)) continue
    const { cols, rows } = gridFor(doc, el.areaKey)
    if (el.type === 'WALL') {
      const xs = [el.x, el.x2 ?? el.x]
      const ys = [el.y, el.y2 ?? el.y]
      narrow(-Math.min(...xs), cols - Math.max(...xs), -Math.min(...ys), rows - Math.max(...ys))
    } else if (el.type === 'LABEL') {
      narrow(-el.x, cols - 1 - el.x, -el.y, rows - 1 - el.y)
    } else {
      // Misma caja que clampElement: la sin girar (giro 0 o 180).
      const w = el.w ?? 1
      const h = el.h ?? 1
      narrow(-el.x, cols - w - el.x, -el.y, rows - h - el.y)
    }
  }
  return r
}

const keepExisting = (doc: EditorDoc, keys: string[]) => {
  const all = new Set([...doc.tables.map(t => t.key), ...doc.elements.map(e => e.key)])
  return keys.filter(k => all.has(k))
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  const { doc } = state
  switch (action.type) {
    case 'LOAD':
      return initEditorState(action.doc, action.activeIndex)
    case 'SET_ACTIVE_AREA':
      return { ...state, activeAreaKey: action.key, selection: [] }
    case 'SELECT':
      return { ...state, selection: action.keys }
    case 'ADD_TABLE': {
      const { cols, rows } = gridFor(doc, action.table.areaKey)
      return commit(state, { ...doc, tables: [...doc.tables, clampTable(action.table, cols, rows)] }, [action.table.key])
    }
    case 'ADD_ELEMENT': {
      const { cols, rows } = gridFor(doc, action.element.areaKey)
      const selection = action.element.type === 'WALL' ? state.selection : [action.element.key]
      return commit(state, { ...doc, elements: [...doc.elements, clampElement(action.element, cols, rows)] }, selection)
    }
    case 'MOVE': {
      const keys = new Set(action.keys)
      const [minDx, maxDx, minDy, maxDy] = moveRange(doc, keys)
      const dx = minDx > maxDx ? 0 : clamp(action.dx, minDx, maxDx)
      const dy = minDy > maxDy ? 0 : clamp(action.dy, minDy, maxDy)
      if (!dx && !dy) return state
      return commit(state, {
        ...doc,
        tables: doc.tables.map(t => (keys.has(t.key) && t.x !== null && t.y !== null ? { ...t, x: round6(t.x + dx), y: round6(t.y + dy) } : t)),
        elements: doc.elements.map(e =>
          keys.has(e.key)
            ? { ...e, x: round6(e.x + dx), y: round6(e.y + dy), x2: e.x2 === null ? null : round6(e.x2 + dx), y2: e.y2 === null ? null : round6(e.y2 + dy) }
            : e,
        ),
      })
    }
    case 'PLACE_TABLE': {
      const { cols, rows } = gridFor(doc, action.areaKey)
      return commit(
        state,
        {
          ...doc,
          tables: doc.tables.map(t =>
            t.key === action.key ? { ...t, areaKey: action.areaKey, legacy: null, ...placeTable(action.x, action.y, t.shape, t.capacity, t.rotation, cols, rows) } : t,
          ),
        },
        [action.key],
      )
    }
    case 'UPDATE_TABLE':
      return commit(state, {
        ...doc,
        tables: doc.tables.map(t => {
          if (t.key !== action.key) return t
          let next: DraftTable = { ...t, ...action.patch }
          if (action.patch.areaKey !== undefined && action.patch.areaKey !== t.areaKey) {
            if (action.patch.areaKey === null) next = { ...next, x: null, y: null }
            else {
              const g = gridFor(doc, action.patch.areaKey)
              next = { ...next, legacy: null, ...placeTable(g.cols / 2, g.rows / 2, next.shape, next.capacity, next.rotation, g.cols, g.rows) }
            }
          } else if (next.x !== null && next.y !== null && (next.shape !== t.shape || next.capacity !== t.capacity || next.rotation !== t.rotation)) {
            // Otra forma, otras personas u otro giro ⇒ otro tamaño: se vuelve a imantar para que sus bordes caigan en la cuadrícula.
            const g = gridFor(doc, next.areaKey)
            next = { ...next, ...placeTable(next.x, next.y, next.shape, next.capacity, next.rotation, g.cols, g.rows) }
          }
          const g = gridFor(doc, next.areaKey)
          return clampTable(next, g.cols, g.rows)
        }),
      })
    case 'UPDATE_ELEMENT':
      return commit(state, {
        ...doc,
        elements: doc.elements.map(e => {
          if (e.key !== action.key) return e
          const g = gridFor(doc, e.areaKey)
          return clampElement({ ...e, ...action.patch }, g.cols, g.rows)
        }),
      })
    case 'ROTATE': {
      const keys = new Set(action.keys)
      const tables = doc.tables.map(t => {
        if (!keys.has(t.key)) return t
        const g = gridFor(doc, t.areaKey)
        return clampTable({ ...t, rotation: (t.rotation + 45) % 360 }, g.cols, g.rows)
      })
      const elements = doc.elements.map(e => {
        if (!keys.has(e.key) || !isRect(e.type)) return e
        const g = gridFor(doc, e.areaKey)
        return rotateRect(e, g.cols, g.rows)
      })
      if (tables.every((t, i) => t === doc.tables[i]) && elements.every((e, i) => e === doc.elements[i])) return state
      return commit(state, { ...doc, tables, elements })
    }
    case 'DUPLICATE': {
      const tables: DraftTable[] = []
      const elements: DraftElement[] = []
      for (const c of action.clones) {
        const t = doc.tables.find(x => x.key === c.sourceKey)
        if (t) {
          const g = gridFor(doc, t.areaKey)
          tables.push(
            clampTable(
              { ...t, key: c.key, id: undefined, number: c.number ?? t.number, hasOpenOrder: false, legacy: null, x: t.x === null ? null : t.x + 2, y: t.y === null ? null : t.y + 2 },
              g.cols,
              g.rows,
            ),
          )
          continue
        }
        const e = doc.elements.find(x => x.key === c.sourceKey)
        if (e) {
          const g = gridFor(doc, e.areaKey)
          elements.push(clampElement({ ...e, key: c.key, id: undefined, x: e.x + 2, y: e.y + 2, x2: e.x2 === null ? null : e.x2 + 2, y2: e.y2 === null ? null : e.y2 + 2 }, g.cols, g.rows))
        }
      }
      if (!tables.length && !elements.length) return state
      return commit(state, { ...doc, tables: [...doc.tables, ...tables], elements: [...doc.elements, ...elements] }, [...tables, ...elements].map(x => x.key))
    }
    case 'REMOVE': {
      const keys = new Set(action.keys)
      const blocked = doc.tables.filter(t => keys.has(t.key) && t.hasOpenOrder).map(t => t.key)
      const next = {
        ...doc,
        tables: doc.tables.filter(t => !keys.has(t.key) || t.hasOpenOrder),
        elements: doc.elements.filter(e => !keys.has(e.key)),
      }
      if (next.tables.length === doc.tables.length && next.elements.length === doc.elements.length) return state
      return commit(state, next, blocked)
    }
    case 'ADD_AREA': {
      const area = { ...action.area, sortOrder: doc.areas.length }
      const incoming = new Map(action.tables.map(t => [t.key, t]))
      const tables = [...doc.tables.map(t => incoming.get(t.key) ?? t), ...action.tables.filter(t => !doc.tables.some(x => x.key === t.key))]
      // Lo viejo sin área se convirtió con la cuadrícula ancha (40 × 25): se reescala a la del área nueva para que quede
      // en el mismo lugar relativo, y se mete a su lienzo.
      const g = gridOf(area.floorShape)
      const wide = gridOf('WIDE')
      const sx = (v: number) => round6((v * g.cols) / wide.cols)
      const sy = (v: number) => round6((v * g.rows) / wide.rows)
      const elements = doc.elements.map(e =>
        e.areaKey === ''
          ? clampElement(
              {
                ...e,
                areaKey: area.key,
                x: sx(e.x),
                y: sy(e.y),
                w: e.w === null ? null : sx(e.w),
                h: e.h === null ? null : sy(e.h),
                x2: e.x2 === null ? null : sx(e.x2),
                y2: e.y2 === null ? null : sy(e.y2),
              },
              g.cols,
              g.rows,
            )
          : e,
      )
      return { ...commit(state, { areas: [...doc.areas, area], tables, elements }, []), activeAreaKey: area.key }
    }
    case 'UPDATE_AREA': {
      const area = doc.areas.find(a => a.key === action.key)
      if (!area) return state
      const nextArea = { ...area, ...action.patch }
      const g = gridOf(nextArea.floorShape)
      const reshape = action.patch.floorShape !== undefined && action.patch.floorShape !== area.floorShape
      return commit(state, {
        areas: doc.areas.map(a => (a.key === action.key ? nextArea : a)),
        tables: reshape ? doc.tables.map(t => (t.areaKey === action.key ? clampTable(t, g.cols, g.rows) : t)) : doc.tables,
        elements: reshape ? doc.elements.map(e => (e.areaKey === action.key ? clampElement(e, g.cols, g.rows) : e)) : doc.elements,
      })
    }
    case 'MOVE_AREA': {
      const i = doc.areas.findIndex(a => a.key === action.key)
      const j = i + action.direction
      if (i < 0 || j < 0 || j >= doc.areas.length) return state
      const areas = [...doc.areas]
      ;[areas[i], areas[j]] = [areas[j], areas[i]]
      return commit(state, { ...doc, areas: areas.map((a, k) => ({ ...a, sortOrder: k })) })
    }
    case 'REMOVE_AREA': {
      if (doc.tables.some(t => t.areaKey === action.key)) return state
      const i = doc.areas.findIndex(a => a.key === action.key)
      if (i < 0) return state
      const areas = doc.areas.filter(a => a.key !== action.key).map((a, k) => ({ ...a, sortOrder: k }))
      const next = commit(state, { ...doc, areas, elements: doc.elements.filter(e => e.areaKey !== action.key) }, [])
      return { ...next, activeAreaKey: areas[Math.max(0, i - 1)]?.key ?? null }
    }
    case 'UNDO': {
      const prev = state.past[state.past.length - 1]
      if (!prev) return state
      const activeAreaKey = prev.areas.some(a => a.key === state.activeAreaKey) ? state.activeAreaKey : (prev.areas[0]?.key ?? null)
      return { ...state, doc: prev, past: state.past.slice(0, -1), future: [doc, ...state.future], selection: keepExisting(prev, state.selection), activeAreaKey, dirty: true }
    }
    case 'REDO': {
      const next = state.future[0]
      if (!next) return state
      const activeAreaKey = next.areas.some(a => a.key === state.activeAreaKey) ? state.activeAreaKey : (next.areas[0]?.key ?? null)
      return { ...state, doc: next, past: [...state.past, doc], future: state.future.slice(1), selection: keepExisting(next, state.selection), activeAreaKey, dirty: true }
    }
  }
}
