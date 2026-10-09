import { memo, useId } from 'react'
import { cn } from '@/lib/utils'
import { gridOf, openOrderDot, tableSizeCells } from '../model/floorGeometry'
import type { DraftArea, DraftElement, DraftTable } from '../model/types'

export interface FloorDrawingProps {
  area: DraftArea
  tables: DraftTable[]
  elements: DraftElement[]
  selected?: ReadonlySet<string>
  /** Vista del mesero: mesas pintadas como ocupadas de ejemplo. */
  busyKeys?: ReadonlySet<string>
  /** Arrastre en curso: sólo desplaza el dibujo; el borrador cambia al soltar. */
  ghost?: { keys: ReadonlySet<string>; dx: number; dy: number } | null
  /** Mesas encimadas con otra: borde de advertencia (el dueño las separa; el editor no las mueve solo). */
  warnKeys?: ReadonlySet<string>
  showGrid?: boolean
  interactive?: boolean
}

type Offset = { dx: number; dy: number }
const NO_OFFSET: Offset = { dx: 0, dy: 0 }

/**
 * Libre en la vista del mesero. Va con la variable `--success` porque el @theme no registra `--color-success`:
 * `fill-success/20` y `stroke-success` no se generan y la mesa saldría con el negro por defecto de SVG.
 */
const FREE_FILL = 'fill-(--success)/20'
const FREE_STROKE = 'stroke-(--success)'

/** Tamaño de letra para que un nombre derecho quepa en su caja (~0.6 em por letra), sin pasar de 1.2 cuadros. */
const fitLabel = (label: string, w: number, h: number) => Math.min(1.2, h * 0.45, (w * 0.9) / (0.6 * Math.max(1, label.length)))

/** El plano en unidades de CUADRO (1 = un cuadro de la cuadrícula). Sin interacción: la pone FloorCanvas. */
export const FloorDrawing = memo(function FloorDrawing({
  area,
  tables,
  elements,
  selected,
  busyKeys,
  ghost,
  warnKeys,
  showGrid = true,
  interactive = false,
}: FloorDrawingProps) {
  // Único por instancia (la vista del mesero dibuja la misma área dos veces) y sin caracteres que rompan `url(#…)`.
  const gridId = `floor-grid-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const { cols, rows } = gridOf(area.floorShape)
  const offsetOf = (key: string): Offset => (ghost?.keys.has(key) ? { dx: ghost.dx, dy: ghost.dy } : NO_OFFSET)
  return (
    <g>
      <defs>
        {/* Punto entero al centro de cada mosaico, y el patrón corrido medio cuadro: cae en las esquinas de la cuadrícula. */}
        <pattern id={gridId} x={-0.5} y={-0.5} width={1} height={1} patternUnits="userSpaceOnUse">
          <circle cx={0.5} cy={0.5} r={0.07} className="fill-muted-foreground/40" />
        </pattern>
      </defs>
      <rect x={0} y={0} width={cols} height={rows} rx={0.4} className="fill-background" />
      {showGrid && <rect x={0} y={0} width={cols} height={rows} fill={`url(#${gridId})`} />}
      <rect x={0} y={0} width={cols} height={rows} rx={0.4} className="fill-none stroke-border" strokeWidth={0.15} />
      {elements.map(el => (
        <ElementShape key={el.key} el={el} offset={offsetOf(el.key)} selected={!!selected?.has(el.key)} interactive={interactive} />
      ))}
      {tables
        .filter(t => t.x !== null && t.y !== null)
        .map(t => (
          <TableShape
            key={t.key}
            t={t}
            offset={offsetOf(t.key)}
            selected={!!selected?.has(t.key)}
            busy={busyKeys?.has(t.key)}
            warn={!!warnKeys?.has(t.key)}
            interactive={interactive}
          />
        ))}
    </g>
  )
})

function TableShape({
  t,
  offset,
  selected,
  busy,
  warn,
  interactive,
}: {
  t: DraftTable
  offset: Offset
  selected: boolean
  busy?: boolean
  warn: boolean
  interactive: boolean
}) {
  const { w, h } = tableSizeCells(t.shape, t.capacity)
  const cx = (t.x as number) + offset.dx
  const cy = (t.y as number) + offset.dy
  const tone = busy === undefined ? 'fill-card' : busy ? 'fill-destructive/20' : FREE_FILL
  // Seleccionada manda; si no, encimada se avisa en ámbar (el mismo tono que el punto de cuenta abierta: «revísame»).
  const edge = selected ? 'stroke-primary' : warn ? 'stroke-warning' : busy === undefined ? 'stroke-border' : busy ? 'stroke-destructive' : FREE_STROKE
  const shapeClass = cn(tone, edge)
  const strokeWidth = selected ? 0.28 : warn ? 0.24 : 0.16
  const dot = openOrderDot(t.shape, t.capacity, t.rotation)
  return (
    <g data-floor-key={t.key} data-testid={`floor-table-${t.number}`} transform={`rotate(${t.rotation} ${cx} ${cy})`} className={cn(interactive && 'cursor-move')}>
      {t.shape === 'ROUND' ? (
        <circle cx={cx} cy={cy} r={w / 2} className={shapeClass} strokeWidth={strokeWidth} strokeDasharray={warn && !selected ? '0.5 0.3' : undefined} />
      ) : (
        <rect
          x={cx - w / 2}
          y={cy - h / 2}
          width={w}
          height={h}
          rx={0.6}
          className={shapeClass}
          strokeWidth={strokeWidth}
          strokeDasharray={warn && !selected ? '0.5 0.3' : undefined}
        />
      )}
      {/* El texto y el punto de cuenta abierta se contra-giran: se leen derechos y el punto queda arriba a la derecha. */}
      <g transform={`rotate(${-t.rotation} ${cx} ${cy})`} className="pointer-events-none select-none">
        <text
          x={cx}
          y={Math.min(w, h) >= 4 ? cy - 0.35 : cy}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={Math.min(1.5, Math.min(w, h) * 0.42)}
          className="fill-foreground font-semibold"
        >
          {t.number}
        </text>
        {Math.min(w, h) >= 4 && (
          <text x={cx} y={cy + 0.95} textAnchor="middle" dominantBaseline="central" fontSize={0.75} className="fill-muted-foreground">
            {t.capacity}p
          </text>
        )}
        {t.hasOpenOrder && <circle data-testid={`floor-open-order-${t.number}`} cx={cx + dot.dx} cy={cy + dot.dy} r={0.38} className="fill-warning stroke-background" strokeWidth={0.1} />}
      </g>
    </g>
  )
}

/**
 * Abatimiento de la puerta, con la bisagra en una esquina: la hoja abierta sale perpendicular al claro y el arco
 * (cuarto de círculo alrededor de la bisagra) cierra sobre el otro extremo del claro.
 * - Acostada (w ≥ h): claro en el borde de abajo, bisagra abajo a la izquierda, abre hacia arriba.
 * - Parada (h > w, la acostada girada 90° a la derecha): claro en el borde izquierdo, bisagra arriba a la izquierda,
 *   abre hacia la derecha.
 * Las puertas no guardan 90/270: giran intercambiando lados, y 180 las voltea (R13).
 */
function doorSwingPath(x: number, y: number, w: number, h: number): string {
  if (h > w) return `M ${x} ${y} L ${x + h} ${y} A ${h} ${h} 0 0 1 ${x} ${y + h}`
  return `M ${x} ${y + h} L ${x} ${y + h - w} A ${w} ${w} 0 0 1 ${x + w} ${y + h}`
}

function ElementShape({ el, offset, selected, interactive }: { el: DraftElement; offset: Offset; selected: boolean; interactive: boolean }) {
  const x = el.x + offset.dx
  const y = el.y + offset.dy
  const common = { 'data-floor-key': el.key, 'data-testid': `floor-element-${el.key}` }
  if (el.type === 'WALL') {
    return (
      <line
        {...common}
        x1={x}
        y1={y}
        x2={(el.x2 ?? el.x) + offset.dx}
        y2={(el.y2 ?? el.y) + offset.dy}
        strokeWidth={0.6}
        strokeLinecap="round"
        className={cn(selected ? 'stroke-primary' : 'stroke-foreground/80', interactive && 'cursor-move')}
      />
    )
  }
  if (el.type === 'LABEL') {
    return (
      <text
        {...common}
        x={x}
        y={y}
        dominantBaseline="hanging"
        fontSize={1.4}
        className={cn('font-medium', selected ? 'fill-primary' : 'fill-muted-foreground', interactive && 'cursor-move select-none')}
      >
        {el.label}
      </text>
    )
  }
  // Barra, zona de servicio y puerta: su caja sin girar es la que se ve (giro 0, o 180 en la puerta).
  const w = el.w ?? 1
  const h = el.h ?? 1
  const cx = x + w / 2
  const cy = y + h / 2
  return (
    <g {...common} transform={`rotate(${el.rotation} ${cx} ${cy})`} className={cn(interactive && 'cursor-move')}>
      {el.type === 'BAR_COUNTER' && <rect x={x} y={y} width={w} height={h} rx={0.35} className="fill-foreground/85" />}
      {el.type === 'SERVICE_AREA' && (
        <rect x={x} y={y} width={w} height={h} rx={0.25} className="fill-muted stroke-muted-foreground/60" strokeWidth={0.12} strokeDasharray="0.5 0.35" />
      )}
      {el.type === 'DOOR' && (
        <>
          <rect x={x} y={y} width={w} height={h} className="fill-background stroke-muted-foreground" strokeWidth={0.12} />
          <path d={doorSwingPath(x, y, w, h)} className="fill-none stroke-muted-foreground" strokeWidth={0.1} strokeDasharray="0.3 0.2" />
        </>
      )}
      {el.label && el.type !== 'DOOR' && (
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={fitLabel(el.label, w, h)}
          className={cn('pointer-events-none select-none', el.type === 'BAR_COUNTER' ? 'fill-background' : 'fill-muted-foreground')}
        >
          {el.label}
        </text>
      )}
      {selected && <rect x={x - 0.3} y={y - 0.3} width={w + 0.6} height={h + 0.6} rx={0.35} className="fill-none stroke-primary" strokeWidth={0.15} strokeDasharray="0.4 0.3" />}
    </g>
  )
}
