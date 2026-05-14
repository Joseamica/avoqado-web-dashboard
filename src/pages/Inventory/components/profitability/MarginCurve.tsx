import { useMemo, useState } from 'react'
import type { DerivedRow, ProfitabilityStatus } from '../../types/profitability'
import { STATUS_THRESHOLDS } from '../../types/profitability'
import { cn } from '@/lib/utils'

interface Props {
  rows: DerivedRow[]
  /** Currently filtered status (highlights its band, dims the rest). */
  activeStatus?: ProfitabilityStatus | null
  onZoneClick?: (status: ProfitabilityStatus) => void
}

// Hex format so we can append alpha (`${color}cc`) directly in CSS.
const ZONE_COLOR: Record<Exclude<ProfitabilityStatus, 'UNDEFINED'>, string> = {
  POOR: '#f43f5e',         // rose-500
  ACCEPTABLE: '#f59e0b',   // amber-500
  HEALTHY: '#14b8a6',      // teal-500
  EXCELLENT: '#10b981',    // emerald-500
}

const ZONE_BAND: Array<{ status: Exclude<ProfitabilityStatus, 'UNDEFINED'>; from: number; to: number; label: string }> = [
  { status: 'POOR', from: 0, to: STATUS_THRESHOLDS.ACCEPTABLE, label: 'Pobre' },
  { status: 'ACCEPTABLE', from: STATUS_THRESHOLDS.ACCEPTABLE, to: STATUS_THRESHOLDS.HEALTHY, label: 'Aceptable' },
  { status: 'HEALTHY', from: STATUS_THRESHOLDS.HEALTHY, to: STATUS_THRESHOLDS.EXCELLENT, label: 'Saludable' },
  { status: 'EXCELLENT', from: STATUS_THRESHOLDS.EXCELLENT, to: 1, label: 'Excelente' },
]

const HEIGHT = 88

export function MarginCurve({ rows, activeStatus = null, onZoneClick }: Props) {
  const [hover, setHover] = useState<{ row: DerivedRow; x: number } | null>(null)

  // Only rows with a real margin go on the curve — UNDEFINED rows have no x-axis position.
  const sorted = useMemo(
    () =>
      rows
        .filter((r): r is DerivedRow & { marginPct: number } => r.marginPct !== null)
        .sort((a, b) => a.marginPct - b.marginPct),
    [rows],
  )
  const median = useMemo(() => {
    if (!sorted.length) return 0
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 ? sorted[mid].marginPct : (sorted[mid - 1].marginPct + sorted[mid].marginPct) / 2
  }, [sorted])

  // Each bar is a fixed-width tick so products with similar margins stack
  // naturally at the same x position — this produces the density profile the
  // owner reads at a glance.
  const TICK_WIDTH_PCT = 0.6

  return (
    <section className="relative rounded-2xl border border-border/60 bg-card p-5">
      {/* Subtle grid backdrop — gives it the "instrument" feel without being loud.
          rounded-2xl + overflow-hidden keep the grid clipped to the card; the
          tooltip lives outside this layer so it can extend past the card edge. */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.035] pointer-events-none rounded-2xl overflow-hidden"
        style={{
          backgroundImage:
            'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      <header className="relative flex items-end justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium tracking-tight">Curva de margen del catálogo</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cada barra es un producto · {sorted.length} en total · mediana {(median * 100).toFixed(1)}%
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground">
          {ZONE_BAND.map(z => (
            <button
              key={z.status}
              onClick={() => onZoneClick?.(z.status)}
              className={cn(
                'flex items-center gap-1.5 transition-opacity hover:opacity-100',
                activeStatus && activeStatus !== z.status ? 'opacity-40' : 'opacity-80',
              )}
            >
              <span className="inline-block h-1.5 w-3 rounded-sm" style={{ background: ZONE_COLOR[z.status] }} />
              {z.label}
            </button>
          ))}
        </div>
      </header>

      <div className="relative" style={{ height: HEIGHT }}>
        {/* Zone backgrounds — wash of color tinting each band */}
        {ZONE_BAND.map(z => (
          <button
            key={z.status}
            onClick={() => onZoneClick?.(z.status)}
            className={cn(
              'absolute inset-y-0 transition-opacity cursor-pointer hover:opacity-100 border-r border-border/30 last:border-r-0',
              activeStatus && activeStatus !== z.status ? 'opacity-30' : 'opacity-100',
            )}
            style={{
              left: `${z.from * 100}%`,
              width: `${(z.to - z.from) * 100}%`,
              background: `linear-gradient(to top, ${ZONE_COLOR[z.status]}1f, ${ZONE_COLOR[z.status]}08)`,
            }}
            aria-label={`Filtrar ${z.label}`}
          />
        ))}

        {/* Median marker */}
        <div
          aria-hidden
          className="absolute inset-y-0 border-l border-dashed border-foreground/30"
          style={{ left: `${median * 100}%` }}
        >
          <span className="absolute -top-3 -translate-x-1/2 text-[10px] tabular-nums text-foreground/70 bg-card px-1 rounded">
            mediana
          </span>
        </div>

        {/* Vertical product bars — plotted at their REAL margin %.
            Products with similar margins stack on the same x, producing a
            natural density profile (more saturated = more products there). */}
        {sorted.map(row => {
          const x = Math.max(0, Math.min(1, row.marginPct)) * 100
          const status = row.status === 'UNDEFINED' ? 'POOR' : row.status
          const color = ZONE_COLOR[status]
          const dimmed = activeStatus && activeStatus !== row.status
          return (
            <button
              key={row.productId}
              className={cn(
                'absolute bottom-0 rounded-t-sm transition-all',
                dimmed ? 'opacity-20' : 'opacity-90 hover:opacity-100 hover:z-10',
              )}
              style={{
                left: `${x}%`,
                width: `${TICK_WIDTH_PCT}%`,
                minWidth: 2,
                height: '100%',
                background: `linear-gradient(to top, ${color}f2, ${color}80)`,
                transform: 'translateX(-50%)',
              }}
              onMouseEnter={() => setHover({ row, x })}
              onMouseLeave={() => setHover(null)}
              aria-label={`${row.name} · margen ${(row.marginPct * 100).toFixed(1)}%`}
            />
          )
        })}

        {/* Hover tooltip — anchored to the closest edge to avoid clipping at extremes */}
        {hover && (() => {
          const anchorLeft = hover.x < 15
          const anchorRight = hover.x > 85
          // Default center; clamp at edges so tooltip never extends past card
          const transformX = anchorLeft ? 'translateX(0)' : anchorRight ? 'translateX(-100%)' : 'translateX(-50%)'
          return (
            <div
              className="absolute -top-1 z-20 -translate-y-full pointer-events-none"
              style={{ left: `${hover.x}%`, transform: `${transformX} translateY(-100%)` }}
            >
              <div className="rounded-md border border-border/80 bg-popover px-2.5 py-1.5 shadow-md text-[11px] whitespace-nowrap">
                <div className="font-medium">{hover.row.name}</div>
                <div className="text-muted-foreground tabular-nums">
                  margen {((hover.row.marginPct ?? 0) * 100).toFixed(1)}% · ${(hover.row.marginAmount ?? 0).toFixed(2)}
                </div>
              </div>
            </div>
          )
        })()}
      </div>

      {/* Axis ticks */}
      <div className="relative mt-2 h-4 text-[10px] tabular-nums text-muted-foreground">
        {[0, 0.25, 0.5, 0.75, 1].map(t => (
          <span key={t} className="absolute -translate-x-1/2" style={{ left: `${t * 100}%` }}>
            {Math.round(t * 100)}%
          </span>
        ))}
      </div>
    </section>
  )
}
