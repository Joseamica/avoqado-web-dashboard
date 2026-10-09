import { areaIn, keepExisting, markOpen, sameDoc, selectionIn } from './docHelpers'
import { clamp, gridOf, placeTable, rotatedExtent, round6, tableSizeCells } from './floorGeometry'
import type { DraftArea, DraftElement, DraftTable, EditorDoc } from './types'

/**
 * Un paso de deshacer/rehacer: el plano al que se vuelve, la pestaña donde se hizo el cambio (`areaKey`) y la que quedó
 * abierta justo después (`afterAreaKey`). Deshacer abre `areaKey` y rehacer `afterAreaKey`: así se VE lo que se deshizo,
 * aunque mientras tanto se haya cambiado de pestaña.
 */
export interface HistoryEntry {
  doc: EditorDoc
  areaKey: string | null
  afterAreaKey: string | null
}

export interface EditorState {
  doc: EditorDoc
  past: HistoryEntry[]
  future: HistoryEntry[]
  selection: string[]
  activeAreaKey: string | null
  dirty: boolean
  /** Ráfaga en curso (flecha sostenida): los MOVE con `burst` y la misma etiqueta se juntan en un solo paso. */
  burst: string | null
}

export type EditorAction =
  | { type: 'LOAD'; doc: EditorDoc; activeIndex?: number }
  | { type: 'SET_ACTIVE_AREA'; key: string }
  | { type: 'SELECT'; keys: string[] }
  | { type: 'ADD_TABLE'; table: DraftTable }
  | { type: 'ADD_ELEMENT'; element: DraftElement }
  /** `burst`: es la repetición de una tecla sostenida; se suma al paso anterior de la misma ráfaga. */
  | { type: 'MOVE'; keys: string[]; dx: number; dy: number; burst?: boolean }
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
  /** Regresa al borrador mesas que se habían quitado (tal como estaban en el plano guardado), y las deja seleccionadas. */
  | { type: 'RESTORE_TABLES'; tables: DraftTable[] }
  /**
   * El servidor dijo (422) que estas mesas tienen una cuenta abierta: se marcan en el borrador Y en todo el historial,
   * para que deshacer no las regrese sin su marca (y Supr las pueda quitar otra vez). No es un cambio del usuario.
   */
  | { type: 'MARK_OPEN_ORDERS'; keys: string[] }
  /** Abre la pestaña de esas piezas y las selecciona (p. ej. «Ver la nueva» de dos mesas con el mismo número). */
  | { type: 'REVEAL'; keys: string[] }
  | { type: 'UNDO' }
  | { type: 'REDO' }

const HISTORY_LIMIT = 100

export function initEditorState(doc: EditorDoc, activeIndex = 0): EditorState {
  return {
    doc,
    past: [],
    future: [],
    selection: [],
    activeAreaKey: doc.areas[activeIndex]?.key ?? doc.areas[0]?.key ?? null,
    dirty: false,
    burst: null,
  }
}

function commit(state: EditorState, doc: EditorDoc, selection: string[] = state.selection, activeAreaKey = state.activeAreaKey): EditorState {
  if (sameDoc(state.doc, doc)) {
    return selection === state.selection && activeAreaKey === state.activeAreaKey ? state : { ...state, selection, activeAreaKey }
  }
  const entry: HistoryEntry = { doc: state.doc, areaKey: state.activeAreaKey, afterAreaKey: activeAreaKey }
  return { ...state, doc, past: [...state.past.slice(-(HISTORY_LIMIT - 1)), entry], future: [], selection, activeAreaKey, dirty: true, burst: null }
}

/** Pestaña y selección al deshacer/rehacer: sólo queda seleccionado lo que sigue existiendo y se ve en esa pestaña. */
function landOn(doc: EditorDoc, activeAreaKey: string | null, selection: string[]) {
  return { activeAreaKey, selection: selectionIn(doc, keepExisting(doc, selection), activeAreaKey) }
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
 * cualquier otro giro ⇒ 0, salvo el 180 de una puerta.
 */
export function normalizeRectElement(el: DraftElement): DraftElement {
  if (!isRect(el.type)) return el
  const r = ((el.rotation % 360) + 360) % 360
  if (r % 180 === 90) {
    const w = el.w ?? 1
    const h = el.h ?? 1
    return { ...el, w: h, h: w, x: round6(el.x + w / 2 - h / 2), y: round6(el.y + h / 2 - w / 2), rotation: el.type === 'DOOR' && r === 270 ? 180 : 0 }
  }
  // Sólo la puerta guarda 180 (abre hacia el otro lado); en barras y zonas 180 sólo voltearía su nombre de cabeza.
  const rotation = el.type === 'DOOR' && r === 180 ? 180 : 0
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
function moveRange(doc: EditorDoc, keys: ReadonlySet<string>): [number, number, number, number] {
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

/**
 * El desplazamiento que de verdad se aplica al mover `keys`: el pedido, recortado para que nada se salga del lienzo
 * (el grupo se detiene entero en la orilla). Lo usan MOVE y la vista previa del arrastre, así lo que se ve al
 * arrastrar es lo que queda al soltar. Basta un documento con las piezas que se mueven y sus áreas.
 */
export function clampMoveDelta(doc: EditorDoc, keys: ReadonlySet<string>, dx: number, dy: number): { dx: number; dy: number } {
  const [minDx, maxDx, minDy, maxDy] = moveRange(doc, keys)
  return { dx: minDx > maxDx ? 0 : clamp(dx, minDx, maxDx), dy: minDy > maxDy ? 0 : clamp(dy, minDy, maxDy) }
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
      const { dx, dy } = clampMoveDelta(doc, keys, action.dx, action.dy)
      if (!dx && !dy) return state
      const next: EditorDoc = {
        ...doc,
        tables: doc.tables.map(t => (keys.has(t.key) && t.x !== null && t.y !== null ? { ...t, x: round6(t.x + dx), y: round6(t.y + dy) } : t)),
        elements: doc.elements.map(e =>
          keys.has(e.key)
            ? { ...e, x: round6(e.x + dx), y: round6(e.y + dy), x2: e.x2 === null ? null : round6(e.x2 + dx), y2: e.y2 === null ? null : round6(e.y2 + dy) }
            : e,
        ),
      }
      const tag = `move:${[...keys].sort().join(',')}`
      // Flecha sostenida: la repetición reemplaza el plano dentro del mismo paso de deshacer (uno por ráfaga, no por tecla).
      if (action.burst && state.burst === tag && state.past.length && !sameDoc(doc, next)) return { ...state, doc: next, future: [], dirty: true }
      const committed = commit(state, next)
      return committed === state ? state : { ...committed, burst: tag }
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
      // El inspector también guarda al desmontarse: si la pieza ya no existe, no se deja un paso de deshacer vacío.
      if (!doc.tables.some(t => t.key === action.key)) return state
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
      if (!doc.elements.some(e => e.key === action.key)) return state
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
      return commit(state, { areas: [...doc.areas, area], tables, elements }, [], area.key)
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
      return commit(state, { ...doc, areas, elements: doc.elements.filter(e => e.areaKey !== action.key) }, [], areas[Math.max(0, i - 1)]?.key ?? null)
    }
    case 'RESTORE_TABLES': {
      const present = new Set(doc.tables.map(t => t.key))
      const back = action.tables
        .filter(t => !present.has(t.key))
        .map(t => {
          // Si su área ya no está en el borrador, vuelve «Sin acomodar»; si está, dentro de su lienzo (la forma pudo cambiar).
          if (t.areaKey === null || !doc.areas.some(a => a.key === t.areaKey)) return { ...t, areaKey: null, x: null, y: null }
          const g = gridFor(doc, t.areaKey)
          return clampTable(t, g.cols, g.rows)
        })
      if (!back.length) return state
      const area = back.find(t => t.areaKey !== null && t.x !== null)?.areaKey ?? state.activeAreaKey
      const next = { ...doc, tables: [...doc.tables, ...back] }
      // Se seleccionan las que se ven en la pestaña que se abre; las de otra área no (Supr las editaría a ciegas).
      return commit(state, next, selectionIn(next, back.map(t => t.key), area), area)
    }
    case 'MARK_OPEN_ORDERS': {
      const keys = new Set(action.keys)
      const patch = (e: HistoryEntry) => {
        const d = markOpen(e.doc, keys)
        return d === e.doc ? e : { ...e, doc: d }
      }
      const marked = markOpen(doc, keys)
      const past = state.past.map(patch)
      const future = state.future.map(patch)
      if (marked === doc && past.every((e, i) => e === state.past[i]) && future.every((e, i) => e === state.future[i])) return state
      return { ...state, doc: marked, past, future }
    }
    case 'REVEAL': {
      const keys = new Set(action.keys)
      const first =
        doc.tables.find(t => keys.has(t.key) && t.areaKey !== null && doc.areas.some(a => a.key === t.areaKey)) ??
        doc.elements.find(e => keys.has(e.key) && doc.areas.some(a => a.key === e.areaKey))
      const area = first?.areaKey ?? state.activeAreaKey
      return { ...state, activeAreaKey: area, selection: selectionIn(doc, action.keys, area) }
    }
    case 'UNDO': {
      const entry = state.past[state.past.length - 1]
      if (!entry) return state
      return {
        ...state,
        doc: entry.doc,
        past: state.past.slice(0, -1),
        future: [{ ...entry, doc }, ...state.future],
        ...landOn(entry.doc, areaIn(entry.doc, entry.areaKey, state.activeAreaKey), state.selection),
        dirty: true,
        burst: null,
      }
    }
    case 'REDO': {
      const entry = state.future[0]
      if (!entry) return state
      return {
        ...state,
        doc: entry.doc,
        past: [...state.past, { ...entry, doc }],
        future: state.future.slice(1),
        ...landOn(entry.doc, areaIn(entry.doc, entry.afterAreaKey, state.activeAreaKey), state.selection),
        dirty: true,
        burst: null,
      }
    }
  }
}
