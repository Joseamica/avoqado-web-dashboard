import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent as ReactDragEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Maximize, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { FloorDrawing } from './FloorDrawing'
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
}

type Rect = { x: number; y: number; w: number; h: number }
type Gesture =
  /** `last`: el desplazamiento que ya se pintó; si no cambia, no se vuelve a pintar. */
  | { kind: 'drag'; keys: string[]; keySet: Set<string>; startX: number; startY: number; moved: boolean; last: { dx: number; dy: number } | null }
  /** `base`: lo que ya estaba seleccionado si se empezó con Shift (el recuadro SUMA en vez de reemplazar). */
  | { kind: 'marquee'; startX: number; startY: number; base: string[] }
  | { kind: 'pan'; clientX: number; clientY: number; view: ViewBox }

const isTyping = (target: EventTarget | null) => !!(target as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable="true"]')

/** Controles que la barra espaciadora acciona con el teclado: no se les roba la tecla (salvo con el puntero sobre el plano). */
const SPACE_CONTROLS =
  'button, a[href], summary, [role="button"], [role="switch"], [role="checkbox"], [role="radio"], [role="tab"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="option"], [role="slider"], [role="combobox"]'
const isSpaceControl = (target: EventTarget | null) => !!(target as HTMLElement | null)?.closest?.(SPACE_CONTROLS)

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
  const overCanvas = useRef(false)
  const selected = useMemo(() => new Set(selection), [selection])
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

  // Espacio = mano para mover el plano. Con el foco en un botón o interruptor, la barra lo sigue accionando
  // (teclado) a menos que el puntero esté sobre el plano.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || isTyping(e.target)) return
      if (isSpaceControl(e.target) && !overCanvas.current) return
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
  }, [])

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
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [toCell, cols, rows])

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
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
      gesture.current = { kind: 'drag', keys, keySet: new Set(keys), startX: p.x, startY: p.y, moved: false, last: null }
      e.currentTarget.setPointerCapture(e.pointerId)
      return
    }
    if (!e.shiftKey) props.onSelect([])
    gesture.current = { kind: 'marquee', startX: p.x, startY: p.y, base: e.shiftKey ? selection : [] }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const p = toCell(e.clientX, e.clientY)
    if (tool === 'WALL') setCursor(snapPoint(p))
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

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-input bg-muted/40">
      <svg
        ref={svgRef}
        data-testid="floor-canvas"
        data-tour="floor-plan-canvas"
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        preserveAspectRatio="xMidYMid meet"
        className={cn('h-full w-full touch-none select-none', spaceHeld ? 'cursor-grab' : tool === 'select' ? 'cursor-default' : 'cursor-crosshair')}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => endGesture(true)}
        onPointerCancel={() => endGesture(false)}
        onPointerEnter={() => {
          overCanvas.current = true
        }}
        onPointerLeave={() => {
          overCanvas.current = false
          setCursor(null)
        }}
        onDoubleClick={() => setWallStart(null)}
        onDragOver={e => {
          if (e.dataTransfer.types.includes(TOOL_DRAG_MIME) || e.dataTransfer.types.includes(TABLE_DRAG_MIME)) e.preventDefault()
        }}
        onDrop={onDrop}
      >
        <FloorDrawing area={area} tables={tables} elements={elements} selected={selected} ghost={ghost} interactive />
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
      </svg>

      {tool !== 'select' && (
        <div className="pointer-events-none absolute left-3 top-3 rounded-full border border-input bg-background/90 px-3 py-1 text-xs text-muted-foreground shadow-sm">
          {tool === 'WALL' ? t('tools.wallHint') : t('tools.placeHint')}
        </div>
      )}

      <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full border border-input bg-background/90 p-1 shadow-sm">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8 cursor-pointer"
          aria-label={t('canvas.zoomOut')}
          onClick={() => setView(v => zoomAround(v, viewCenter(v), 1.25, { cols, rows }))}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8 cursor-pointer"
          aria-label={t('canvas.zoomIn')}
          onClick={() => setView(v => zoomAround(v, viewCenter(v), 0.8, { cols, rows }))}
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 cursor-pointer" aria-label={t('canvas.fit')} onClick={() => setView(fitView(cols, rows))}>
          <Maximize className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
