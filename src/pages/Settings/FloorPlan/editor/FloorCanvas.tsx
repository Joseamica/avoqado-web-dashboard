import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import { MousePointerClick, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FloorDrawing } from './FloorDrawing'
import { useKeyboardFocus } from './useKeyboardFocus'
import { ZoomControls } from './ZoomControls'
import { clampMoveDelta } from '../model/editorReducer'
import {
  alignmentGuides,
  clamp,
  clampWallEnd,
  fitView,
  gridOf,
  rotatedExtent,
  snapWallEnd,
  tableSizeCells,
  zoomAround,
  type Box,
  type GuideLine,
  type ViewBox,
} from '../model/floorGeometry'
import { overlappingTables } from '../model/overlap'
import { placementOf } from '../model/placement'
import type { DraftArea, DraftElement, DraftTable, EditorDoc, ToolId } from '../model/types'

export const TOOL_DRAG_MIME = 'application/x-avoqado-floor-tool'
export const TABLE_DRAG_MIME = 'application/x-avoqado-floor-table'

export interface FloorCanvasProps {
  area: DraftArea
  tables: DraftTable[]
  elements: DraftElement[]
  selection: string[]
  tool: ToolId
  onSelect: (keys: string[]) => void
  onMove: (keys: string[], dx: number, dy: number) => void
  onPlaceTool: (tool: ToolId, x: number, y: number) => void
  onCreateWall: (x1: number, y1: number, x2: number, y2: number) => void
  onPlaceTable: (key: string, x: number, y: number) => void
  onToolDone: () => void
  /** Qué control tiene el foco por teclado (`useKeyboardFocus` del editor, que sobrevive a que el lienzo se desmonte). */
  keyboardFocus?: MutableRefObject<EventTarget | null>
}

type Rect = { x: number; y: number; w: number; h: number }
type Gesture =
  /** `last`: el desplazamiento que ya se pintó; si no cambia, no se vuelve a pintar. */
  /** `clicked`: la pieza bajo el puntero; un clic sin mover sobre una selección de varias la deja sola a ella. */
  | { kind: 'drag'; keys: string[]; keySet: Set<string>; clicked: string; startX: number; startY: number; moved: boolean; last: { dx: number; dy: number } | null }
  /** `base`: lo que ya estaba seleccionado si se empezó con Shift (el recuadro SUMA en vez de reemplazar). */
  | { kind: 'marquee'; startX: number; startY: number; base: string[] }
  | { kind: 'pan'; clientX: number; clientY: number; view: ViewBox }

const isTyping = (target: EventTarget | null) => !!(target as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable="true"]')

/**
 * Controles que la barra espaciadora acciona con el teclado. La tecla es del control sólo si llegó a él con el TECLADO;
 * si el foco quedó ahí por el ratón (un clic, o Radix que lo regresa al cerrar un menú), Espacio es la mano. No se usa
 * `:focus-visible`: el navegador lo prende en cuanto se aprieta una tecla, justo la que aquí se decide. Además el editor
 * suelta el foco de los botones tocados con el ratón (`blurAfterPointerClick`).
 */
const SPACE_CONTROLS =
  'button, a[href], summary, [role="button"], [role="switch"], [role="checkbox"], [role="radio"], [role="tab"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="option"], [role="slider"], [role="combobox"]'
const controlOf = (target: EventTarget | null) => (target as HTMLElement | null)?.closest?.(SPACE_CONTROLS) ?? null
/**
 * La capa encima del editor donde está el foco: un diálogo, o un menú o una lista de Radix (el menú «···» del área, el
 * selector de área del inspector), que se dibujan fuera del diálogo del editor (m4).
 */
const dialogOf = (target: EventTarget | null) =>
  (target as HTMLElement | null)?.closest?.('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]') ?? null

/** Cuadros por píxel en pantalla. Con `preserveAspectRatio="meet"` manda el lado más apretado. */
function unitsPerPixel(view: ViewBox, el: Element): number {
  return Math.max(view.w / Math.max(1, el.clientWidth), view.h / Math.max(1, el.clientHeight))
}

const viewCenter = (v: ViewBox) => ({ x: v.x + v.w / 2, y: v.y + v.h / 2 })

function tableBox(t: DraftTable, dx = 0, dy = 0): Box {
  const s = tableSizeCells(t.shape, t.capacity)
  const e = rotatedExtent(s.w, s.h, t.rotation)
  return { cx: (t.x as number) + dx, cy: (t.y as number) + dy, w: e.w, h: e.h }
}

function elementCenter(e: DraftElement): { x: number; y: number } {
  if (e.type === 'WALL') return { x: (e.x + (e.x2 ?? e.x)) / 2, y: (e.y + (e.y2 ?? e.y)) / 2 }
  if (e.type === 'LABEL') return { x: e.x + 1, y: e.y + 0.7 }
  // Barra, zona y puerta giran intercambiando lados (giro 0 o 180): su caja sin girar es la que se ve.
  return { x: e.x + (e.w ?? 1) / 2, y: e.y + (e.h ?? 1) / 2 }
}

/**
 * Lienzo del editor: seleccionar (clic, Shift+clic, recuadro), arrastrar con imán a la cuadrícula y guías de
 * alineación, dibujar paredes encadenadas, poner piezas de la paleta (clic o arrastrar y soltar) y mesas de la
 * bandeja, acercar/alejar (Ctrl/⌘ + rueda o pellizco) y mover el plano (rueda, botón del medio o Espacio + arrastrar).
 * No cambia el borrador mientras se arrastra: sólo desplaza el dibujo y avisa al soltar.
 */
export function FloorCanvas(props: FloorCanvasProps) {
  const { area, tables, elements, selection, tool } = props
  const { t } = useTranslation('floorPlan')
  const { cols, rows } = gridOf(area.floorShape)
  const svgRef = useRef<SVGSVGElement>(null)
  const [view, setView] = useState<ViewBox>(() => fitView(cols, rows))
  const gesture = useRef<Gesture | null>(null)
  // Lo que se suelta se lee de refs: el `pointerup` puede llegar antes de que React pinte el último `pointermove`.
  const delta = useRef({ dx: 0, dy: 0 })
  const marqueeBox = useRef<Rect | null>(null)
  const [ghost, setGhost] = useState<{ keys: Set<string>; dx: number; dy: number } | null>(null)
  const [guides, setGuides] = useState<GuideLine[]>([])
  const [marquee, setMarquee] = useState<Rect | null>(null)
  const [wallStart, setWallStart] = useState<{ x: number; y: number } | null>(null)
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)
  const [spaceHeld, setSpaceHeld] = useState(false)
  const spacePan = useRef(false)
  // Sin el del editor (el lienzo suelto, en sus pruebas), uno propio.
  const ownKeyboardFocus = useKeyboardFocus(!props.keyboardFocus)
  const keyboardFocus = props.keyboardFocus ?? ownKeyboardFocus
  const pinch = useRef(1)
  const selected = useMemo(() => new Set(selection), [selection])
  // H4: mesas encimadas (lo viejo de la PAX, o dos que se arrastraron una sobre otra). Se avisa; nunca se mueven solas.
  const overlap = useMemo(() => overlappingTables(tables), [tables])
  const overlapKeys = useMemo(() => tables.filter(x => overlap.has(x.key)).map(x => x.key), [tables, overlap])
  // Lo que ve el lienzo, como documento: con él se recorta el arrastre igual que MOVE al soltar.
  const canvasDoc = useMemo<EditorDoc>(() => ({ areas: [area], tables, elements }), [area, tables, elements])

  // Otra área (u otra forma): vista completa y sin pared a medias.
  useEffect(() => {
    setView(fitView(cols, rows))
    setWallStart(null)
  }, [cols, rows, area.key])
  useEffect(() => {
    if (tool !== 'WALL') setWallStart(null)
  }, [tool])

  const toCell = useCallback((clientX: number, clientY: number) => {
    const ctm = svgRef.current?.getScreenCTM?.()
    if (!ctm) return { x: 0, y: 0 }
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse())
    return { x: p.x, y: p.y }
  }, [])
  const snapPoint = (p: { x: number; y: number }) => ({ x: clamp(Math.round(p.x), 0, cols), y: clamp(Math.round(p.y), 0, rows) })
  /** Final de pared imantado a 0/45/90° y metido al lienzo sobre su propia línea. Lo usan la vista previa y el clic. */
  const wallEnd = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const raw = snapWallEnd(from.x, from.y, to.x, to.y)
    return clampWallEnd(from.x, from.y, raw.x, raw.y, cols, rows)
  }

  // Espacio = mano para mover el plano. Con el foco en un botón o interruptor la barra lo sigue accionando: no se le roba
  // el clic aunque el puntero esté sobre el plano (al tocar el plano el foco pasa al lienzo, y ahí sí es la mano).
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || isTyping(e.target)) return
      // Un diálogo, menú o lista encima del editor («¿Salir sin guardar?», «Nueva área», «···»): Espacio es de sus
      // botones y opciones (m2 de 15-D, m4).
      const dialog = dialogOf(e.target)
      if (dialog && !dialog.contains(svgRef.current)) return
      const control = controlOf(e.target)
      if (control && control === keyboardFocus.current) return
      e.preventDefault()
      spacePan.current = true
      setSpaceHeld(true)
    }
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || !spacePan.current) return
      e.preventDefault()
      spacePan.current = false
      setSpaceHeld(false)
    }
    // Si se suelta la tecla en otra ventana, la mano no se queda pegada.
    const blur = () => {
      spacePan.current = false
      setSpaceHeld(false)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [keyboardFocus])

  // Rueda: con Ctrl/⌘ (o pellizco en el trackpad) acerca; sin tecla desplaza.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        const at = toCell(e.clientX, e.clientY)
        setView(v => zoomAround(v, at, Math.exp(e.deltaY * 0.01), { cols, rows }))
      } else {
        setView(v => {
          const k = unitsPerPixel(v, svg)
          return { ...v, x: v.x + e.deltaX * k, y: v.y + e.deltaY * k }
        })
      }
    }
    // Safari no manda el pellizco del trackpad como rueda con Ctrl: manda `gesture*` con la escala acumulada.
    type Gesture = Event & { scale: number; clientX: number; clientY: number }
    const onGestureStart = (e: Event) => {
      e.preventDefault()
      pinch.current = 1
    }
    const onGestureChange = (e: Event) => {
      const g = e as Gesture
      e.preventDefault()
      if (!g.scale) return
      const at = toCell(g.clientX, g.clientY)
      const factor = pinch.current / g.scale
      pinch.current = g.scale
      setView(v => zoomAround(v, at, factor, { cols, rows }))
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    svg.addEventListener('gesturestart', onGestureStart)
    svg.addEventListener('gesturechange', onGestureChange)
    return () => {
      svg.removeEventListener('wheel', onWheel)
      svg.removeEventListener('gesturestart', onGestureStart)
      svg.removeEventListener('gesturechange', onGestureChange)
    }
  }, [toCell, cols, rows])

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    // El foco pasa al lienzo: así Espacio ya no es de un botón que se tocó antes, y el campo del inspector se guarda.
    if (document.activeElement !== e.currentTarget) e.currentTarget.focus({ preventScroll: true })
    if (e.button === 1 || spaceHeld) {
      e.preventDefault()
      gesture.current = { kind: 'pan', clientX: e.clientX, clientY: e.clientY, view }
      e.currentTarget.setPointerCapture(e.pointerId)
      return
    }
    if (e.button !== 0) return
    const p = toCell(e.clientX, e.clientY)
    if (tool === 'WALL') {
      const s = snapPoint(p)
      if (!wallStart) {
        setWallStart(s)
        return
      }
      const end = wallEnd(wallStart, s)
      if (Math.hypot(end.x - wallStart.x, end.y - wallStart.y) >= 1) {
        props.onCreateWall(wallStart.x, wallStart.y, end.x, end.y)
        setWallStart(end) // se encadena: la siguiente pared sale de aquí
      }
      return
    }
    if (tool !== 'select') {
      const s = snapPoint(p)
      props.onPlaceTool(tool, s.x, s.y)
      props.onToolDone()
      return
    }
    const key = (e.target as Element).closest?.('[data-floor-key]')?.getAttribute('data-floor-key') ?? null
    if (key) {
      if (e.shiftKey) {
        props.onSelect(selected.has(key) ? selection.filter(k => k !== key) : [...selection, key])
        return
      }
      const keys = selected.has(key) ? selection : [key]
      if (!selected.has(key)) props.onSelect(keys)
      gesture.current = { kind: 'drag', keys, keySet: new Set(keys), clicked: key, startX: p.x, startY: p.y, moved: false, last: null }
      e.currentTarget.setPointerCapture(e.pointerId)
      return
    }
    if (!e.shiftKey) props.onSelect([])
    gesture.current = { kind: 'marquee', startX: p.x, startY: p.y, base: e.shiftKey ? selection : [] }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const p = toCell(e.clientX, e.clientY)
    // Con una herramienta en la mano, el puntero imantado: punto de la pared o vista previa de la pieza (pasada en vivo).
    if (tool !== 'select') {
      const s = snapPoint(p)
      setCursor(c => (c && c.x === s.x && c.y === s.y ? c : s))
    }
    const g = gesture.current
    if (!g) return
    if (g.kind === 'pan') {
      const k = unitsPerPixel(g.view, e.currentTarget)
      setView({ ...g.view, x: g.view.x - (e.clientX - g.clientX) * k, y: g.view.y - (e.clientY - g.clientY) * k })
      return
    }
    if (g.kind === 'marquee') {
      const box = { x: Math.min(g.startX, p.x), y: Math.min(g.startY, p.y), w: Math.abs(p.x - g.startX), h: Math.abs(p.y - g.startY) }
      marqueeBox.current = box
      setMarquee(box)
      return
    }
    let dx = Math.round(p.x - g.startX)
    let dy = Math.round(p.y - g.startY)
    if (!g.moved && dx === 0 && dy === 0) return
    g.moved = true
    let lines: GuideLine[] = []
    const single = g.keys.length === 1 ? tables.find(x => x.key === g.keys[0] && x.x !== null) : undefined
    if (single) {
      const others = tables.filter(o => o.key !== single.key && o.x !== null).map(o => tableBox(o))
      const res = alignmentGuides(tableBox(single, dx, dy), others)
      dx += res.dx
      dy += res.dy
      lines = res.lines
    }
    // Igual que MOVE al soltar: lo que se ve mientras se arrastra es lo que queda.
    const fit = clampMoveDelta(canvasDoc, g.keySet, dx, dy)
    // Si la orilla corrigió un eje, la guía de ese eje ya no dice dónde queda la pieza.
    if (fit.dx !== dx) lines = lines.filter(l => l.x1 !== l.x2)
    if (fit.dy !== dy) lines = lines.filter(l => l.y1 !== l.y2)
    if (g.last && g.last.dx === fit.dx && g.last.dy === fit.dy) return
    g.last = fit
    delta.current = fit
    setGuides(lines)
    setGhost({ keys: g.keySet, dx: fit.dx, dy: fit.dy })
  }

  /** Fin del gesto. `commit = false` (pointercancel) lo descarta: el sistema se llevó el puntero, nadie soltó nada. */
  const endGesture = (commit: boolean) => {
    const g = gesture.current
    gesture.current = null
    if (commit && g?.kind === 'drag' && g.moved) props.onMove(g.keys, delta.current.dx, delta.current.dy)
    if (commit && g?.kind === 'drag' && !g.moved && g.keys.length > 1) props.onSelect([g.clicked])
    const box = marqueeBox.current
    if (commit && g?.kind === 'marquee' && box && (box.w > 0.5 || box.h > 0.5)) {
      const inside = (x: number, y: number) => x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h
      const picked = [
        ...tables.filter(tb => tb.x !== null && inside(tb.x, tb.y as number)).map(tb => tb.key),
        ...elements.filter(el => inside(elementCenter(el).x, elementCenter(el).y)).map(el => el.key),
      ]
      props.onSelect([...g.base, ...picked.filter(k => !g.base.includes(k))])
    }
    delta.current = { dx: 0, dy: 0 }
    marqueeBox.current = null
    setGhost(null)
    setGuides([])
    setMarquee(null)
  }

  const onDrop = (e: ReactDragEvent<SVGSVGElement>) => {
    const tableKey = e.dataTransfer.getData(TABLE_DRAG_MIME)
    const dropped = e.dataTransfer.getData(TOOL_DRAG_MIME) as ToolId | ''
    if (!tableKey && !dropped) return
    e.preventDefault()
    const p = snapPoint(toCell(e.clientX, e.clientY))
    if (tableKey) props.onPlaceTable(tableKey, p.x, p.y)
    else if (dropped && dropped !== 'WALL' && dropped !== 'select') props.onPlaceTool(dropped, p.x, p.y)
  }

  const wallPreview = tool === 'WALL' && wallStart && cursor ? wallEnd(wallStart, cursor) : null
  // Dónde caería la pieza de la paleta con un clic aquí: antes se ponía a ciegas (sólo la cruz del puntero).
  const placing = cursor && !spaceHeld ? placementOf(tool, cursor.x, cursor.y, cols, rows) : null

  const zoom = Math.round(((cols + 4) / view.w) * 100)
  const hint = tool === 'select' ? null : tool === 'WALL' ? t('tools.wallHint') : t('tools.placeHint')

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-input bg-muted/40">
      <svg
        ref={svgRef}
        data-testid="floor-canvas"
        data-tour="floor-plan-canvas"
        role="img"
        aria-label={t('canvas.label', { name: area.name })}
        // Enfocable sólo con el ratón (no por Tab): al tocarlo, el foco deja el botón que se usó antes.
        tabIndex={-1}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        preserveAspectRatio="xMidYMid meet"
        className={cn(
          'min-h-0 w-full flex-1 touch-none select-none outline-none',
          spaceHeld ? 'cursor-grab' : tool === 'select' ? 'cursor-default' : 'cursor-crosshair',
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => endGesture(true)}
        onPointerCancel={() => endGesture(false)}
        onPointerLeave={() => setCursor(null)}
        onDoubleClick={() => setWallStart(null)}
        onDragOver={e => {
          if (e.dataTransfer.types.includes(TOOL_DRAG_MIME) || e.dataTransfer.types.includes(TABLE_DRAG_MIME)) e.preventDefault()
        }}
        onDrop={onDrop}
      >
        <FloorDrawing area={area} tables={tables} elements={elements} selected={selected} ghost={ghost} warnKeys={overlap} interactive />
        {guides.map((l, i) => (
          <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} className="stroke-primary" strokeWidth={0.08} strokeDasharray="0.35 0.25" />
        ))}
        {marquee && <rect x={marquee.x} y={marquee.y} width={marquee.w} height={marquee.h} className="fill-primary/10 stroke-primary" strokeWidth={0.06} />}
        {wallStart && wallPreview && (
          <line
            x1={wallStart.x}
            y1={wallStart.y}
            x2={wallPreview.x}
            y2={wallPreview.y}
            className="stroke-primary/60"
            strokeWidth={0.6}
            strokeLinecap="round"
          />
        )}
        {tool === 'WALL' && cursor && <circle cx={cursor.x} cy={cursor.y} r={0.25} className="fill-primary" />}
        {placing && (
          <g className="pointer-events-none fill-primary/10 stroke-primary/70" strokeWidth={0.12} strokeDasharray="0.4 0.3" data-testid="floor-place-preview">
            {placing.kind === 'table' && placing.shape === 'ROUND' ? (
              <circle cx={placing.x} cy={placing.y} r={placing.w / 2} />
            ) : placing.kind === 'table' ? (
              <rect x={placing.x - placing.w / 2} y={placing.y - placing.h / 2} width={placing.w} height={placing.h} rx={0.6} />
            ) : (
              <rect x={placing.x} y={placing.y} width={placing.w} height={placing.h} rx={0.3} />
            )}
          </g>
        )}
      </svg>

      {/* H1: la barra va DEBAJO del dibujo, no encima: ninguna esquina del área queda tapada por los botones. */}
      <div className="flex h-12 shrink-0 items-center gap-3 border-t border-input bg-card px-3" data-testid="floor-canvas-bar">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
          {hint ? (
            <p className="flex min-w-0 items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-foreground" aria-live="polite" data-testid="floor-canvas-hint">
              <MousePointerClick className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">{hint}</span>
            </p>
          ) : overlapKeys.length > 0 ? (
            <button
              type="button"
              onClick={() => props.onSelect(overlapKeys)}
              className="flex min-w-0 cursor-pointer items-center gap-2 rounded-full px-2 py-1 text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-testid="floor-canvas-overlap"
            >
              <TriangleAlert className="h-4 w-4 shrink-0 text-warning" aria-hidden />
              <span className="truncate">{t('canvas.overlap', { count: overlapKeys.length })}</span>
              <span className="shrink-0 text-muted-foreground underline underline-offset-4">{t('canvas.overlapShow')}</span>
            </button>
          ) : null}
        </div>
        {/* El punto ámbar de las mesas no se explicaba en ningún lado (pasada en vivo, 9-oct): su leyenda, sólo si hay. Con
            una herramienta en la mano manda la instrucción: a 1280 px la leyenda la recortaba. */}
        {!hint && tables.some(x => x.hasOpenOrder) && (
          <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground" data-testid="floor-canvas-open-legend">
            <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-warning" />
            {t('canvas.openOrderLegend')}
          </span>
        )}
        <ZoomControls
          zoom={zoom}
          onZoomOut={() => setView(v => zoomAround(v, viewCenter(v), 1.25, { cols, rows }))}
          onZoomIn={() => setView(v => zoomAround(v, viewCenter(v), 0.8, { cols, rows }))}
          onFit={() => setView(fitView(cols, rows))}
        />
      </div>
    </div>
  )
}
