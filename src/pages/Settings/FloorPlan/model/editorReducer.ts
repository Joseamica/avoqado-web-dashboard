import { areaIn, clampWall, keepExisting, markOpen, sameDoc, selectionIn } from './docHelpers'
import { clamp, clampWallEnd, gridOf, nextRotation, placeTable, round6, sizeFits, snapWallEnd, tableExtent, tableSize, withFittedSize } from './floorGeometry'
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

/** Sin `dirty`: «Cambios sin guardar» se deriva del contenido contra lo guardado (`planContent`, m-a), no del historial. */
export interface EditorState {
  doc: EditorDoc
  past: HistoryEntry[]
  future: HistoryEntry[]
  selection: string[]
  activeAreaKey: string | null
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
  | { type: 'UPDATE_TABLE'; key: string; patch: Partial<Pick<DraftTable, 'number' | 'capacity' | 'shape' | 'rotation' | 'areaKey' | 'w' | 'h'>> }
  | { type: 'UPDATE_ELEMENT'; key: string; patch: Partial<Pick<DraftElement, 'label' | 'w' | 'h' | 'rotation'>> }
  /** Arrastrar una punta de la pared: la otra se queda; se imanta a 0/45/90° desde ella y no sale del lienzo. */
  | { type: 'MOVE_WALL_END'; key: string; end: 'start' | 'end'; x: number; y: number }
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
    burst: null,
  }
}

function commit(state: EditorState, doc: EditorDoc, selection: string[] = state.selection, activeAreaKey = state.activeAreaKey): EditorState {
  if (sameDoc(state.doc, doc)) {
    return selection === state.selection && activeAreaKey === state.activeAreaKey ? state : { ...state, selection, activeAreaKey }
  }
  const entry: HistoryEntry = { doc: state.doc, areaKey: state.activeAreaKey, afterAreaKey: activeAreaKey }
  return { ...state, doc, past: [...state.past.slice(-(HISTORY_LIMIT - 1)), entry], future: [], selection, activeAreaKey, burst: null }
}

/** Pestaña y selección al deshacer/rehacer: sólo queda seleccionado lo que sigue existiendo y se ve en esa pestaña. */
function landOn(doc: EditorDoc, activeAreaKey: string | null, selection: string[]) {
  return { activeAreaKey, selection: selectionIn(doc, keepExisting(doc, selection), activeAreaKey) }
}

const gridFor = (doc: EditorDoc, areaKey: string | null) => gridOf(doc.areas.find(a => a.key === areaKey)?.floorShape ?? 'WIDE')

/** Mete el centro de la mesa al lienzo SIN tocar su tamaño (editar número, personas o girar: Codex C1). */
function clampPosition(t: DraftTable, cols: number, rows: number): DraftTable {
  if (t.x === null || t.y === null) return t
  const e = tableExtent(t)
  return { ...t, x: round6(clamp(t.x, e.w / 2, cols - e.w / 2)), y: round6(clamp(t.y, e.h / 2, rows - e.h / 2)) }
}

/** Con el tamaño metido al área (`withFittedSize`): SÓLO al poner, copiar o cambiar la forma del área. */
const clampTable = (t: DraftTable, cols: number, rows: number) => clampPosition(withFittedSize(t, cols, rows), cols, rows)

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
    const e = tableExtent(t)
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
      if (action.burst && state.burst === tag && state.past.length && !sameDoc(doc, next)) return { ...state, doc: next, future: [] }
      const committed = commit(state, next)
      return committed === state ? state : { ...committed, burst: tag }
    }
    case 'PLACE_TABLE': {
      const { cols, rows } = gridFor(doc, action.areaKey)
      // Con tamaño propio, primero se mete al área (pudo venir de una de otra forma) y luego se imanta donde cayó.
      const place = (t: DraftTable) => {
        const fitted = withFittedSize({ ...t, areaKey: action.areaKey, legacy: null }, cols, rows)
        return { ...fitted, ...placeTable(action.x, action.y, fitted, cols, rows) }
      }
      return commit(state, { ...doc, tables: doc.tables.map(t => (t.key === action.key ? place(t) : t)) }, [action.key])
    }
    case 'UPDATE_TABLE': {
      // El inspector también guarda al desmontarse: si la pieza ya no existe, no se deja un paso de deshacer vacío.
      const table = doc.tables.find(t => t.key === action.key)
      if (!table) return state
      // Sin área no hay cuadrícula con qué medir: un tamaño no se pone (el inspector tampoco lo ofrece).
      if (table.areaKey === null && (action.patch.w !== undefined || action.patch.h !== undefined)) return state
      // D1: otra área ⇒ se abre su pestaña con la mesa seleccionada (se ve dónde quedó), y nada de otra área queda
      // seleccionado (Supr lo quitaría sin que se vea). A «Sin acomodar» no se cambia: la bandeja sale en todas.
      const dest = action.patch.areaKey
      const active = typeof dest === 'string' && dest !== table.areaKey && doc.areas.some(a => a.key === dest) ? dest : state.activeAreaKey
      const nextDoc: EditorDoc = {
        ...doc,
        tables: doc.tables.map(t => {
          if (t.key !== action.key) return t
          let next: DraftTable = { ...t, ...action.patch }
          // Otra forma ⇒ vuelve a automático (spec 2026-10-12 §2). Las personas no tocan un tamaño propio.
          if (next.shape !== t.shape) next = { ...next, w: null, h: null }
          else if (next.w !== t.w || next.h !== t.h) {
            // Ancho y alto van juntos: si llega uno solo, el otro sale del tamaño que se ve.
            if ((next.w === null) !== (next.h === null)) {
              const s = tableSize(t)
              next = { ...next, w: next.w ?? s.w, h: next.h ?? s.h }
            }
            // Un + o − que no vale TAL CUAL (fuera de su eje, o ya girada no cabe) deja la mesa IGUAL: no se achica el otro
            // lado y, como el plano no cambia, no hay paso de deshacer (auditoría del plan, punto 3).
            const g = gridFor(doc, next.areaKey)
            if (!sizeFits(next, g.cols, g.rows)) return t
          }
          if (action.patch.areaKey !== undefined && action.patch.areaKey !== t.areaKey) {
            // Sin área no hay cuadrícula con qué medir la mesa: vuelve a automático.
            if (action.patch.areaKey === null) next = { ...next, x: null, y: null, w: null, h: null }
            else {
              // Otra área: AQUÍ sí se ajusta solo (por eje y, si girada no cabe, entera en proporción).
              const g = gridFor(doc, action.patch.areaKey)
              const fitted = withFittedSize({ ...next, legacy: null }, g.cols, g.rows)
              next = { ...fitted, ...placeTable(g.cols / 2, g.rows / 2, fitted, g.cols, g.rows) }
            }
          } else if (
            next.x !== null &&
            next.y !== null &&
            (next.shape !== t.shape || next.capacity !== t.capacity || next.rotation !== t.rotation || next.w !== t.w || next.h !== t.h)
          ) {
            // Otra forma, otras personas, otro giro u otro tamaño (ya validado): se vuelve a imantar a la cuadrícula.
            const g = gridFor(doc, next.areaKey)
            next = { ...next, ...placeTable(next.x, next.y, next, g.cols, g.rows) }
          }
          // Sin `withFittedSize`: el cambio de área ya lo ajustó arriba, y un número o unas personas nuevas conservan el
          // tamaño TAL CUAL aunque ya girada no quepa (venía así de otro editor o de la PAX; Codex C1).
          const g = gridFor(doc, next.areaKey)
          return clampPosition(next, g.cols, g.rows)
        }),
      }
      return active === state.activeAreaKey ? commit(state, nextDoc) : commit(state, nextDoc, selectionIn(nextDoc, state.selection, active), active)
    }
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
    case 'MOVE_WALL_END': {
      const wall = doc.elements.find(e => e.key === action.key && e.type === 'WALL')
      if (!wall) return state
      const { cols, rows } = gridFor(doc, wall.areaKey)
      const fixed = action.end === 'end' ? { x: wall.x, y: wall.y } : { x: wall.x2 ?? wall.x, y: wall.y2 ?? wall.y }
      const snapped = snapWallEnd(fixed.x, fixed.y, action.x, action.y)
      const moved = clampWallEnd(fixed.x, fixed.y, snapped.x, snapped.y, cols, rows)
      // Menos de un cuadro no es pared: lo mismo que pide el lápiz al dibujarla.
      if (Math.hypot(moved.x - fixed.x, moved.y - fixed.y) < 1) return state
      const patch = action.end === 'end' ? { x2: moved.x, y2: moved.y } : { x: moved.x, y: moved.y }
      return commit(state, { ...doc, elements: doc.elements.map(e => (e.key === wall.key ? { ...e, ...patch } : e)) })
    }
    case 'ROTATE': {
      const keys = new Set(action.keys)
      const tables = doc.tables.map(t => {
        if (!keys.has(t.key)) return t
        const g = gridFor(doc, t.areaKey)
        // Un tamaño propio nunca se achica solo: el PRIMER giro que cambia el dibujo y ya girada cabe; si ninguno, no gira.
        const rotation = nextRotation(t, g.cols, g.rows)
        return rotation === null ? t : clampPosition({ ...t, rotation }, g.cols, g.rows)
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
          if (t.areaKey === null || !doc.areas.some(a => a.key === t.areaKey)) return { ...t, areaKey: null, x: null, y: null, w: null, h: null }
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
        burst: null,
      }
    }
  }
}
