import { useMemo } from 'react'
import { GlassCard } from '@/components/ui/glass-card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export interface CardTypeBreakdownItem {
  cardType: string
  netAmount: number
  fees: number
  transactionCount: number
  settlementDays: number | null
}

interface Props {
  items: CardTypeBreakdownItem[]
  formatCurrency: (n: number) => string
  cardTypeLabel: (key: string) => string
  cashKey?: string // identifies which cardType is CASH (for "Inmediato" label)
  title?: string
  description?: string
  className?: string
}

const PROPORTION_COLORS: Record<string, string> = {
  // Neutral, theme-aware shades — match existing chart palette without
  // reintroducing the loud purple/blue badges from the previous iteration.
  CREDIT: 'bg-foreground/70',
  DEBIT: 'bg-foreground/55',
  AMEX: 'bg-foreground/40',
  INTERNATIONAL: 'bg-foreground/25',
  OTHER: 'bg-foreground/15',
  CASH: 'bg-emerald-500/70',
}

export function CardTypeBreakdownStrip({
  items,
  formatCurrency,
  cardTypeLabel,
  cashKey = 'CASH',
  title = 'Desglose por tipo de tarjeta',
  description = 'Distribución del monto neto por método de pago',
  className,
}: Props) {
  const total = useMemo(() => items.reduce((s, c) => s + c.netAmount, 0), [items])
  const sorted = useMemo(() => [...items].sort((a, b) => b.netAmount - a.netAmount), [items])

  if (items.length === 0) return null

  return (
    <GlassCard className={cn('p-4 sm:p-5 space-y-4', className)}>
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total neto</p>
          <p className="text-base font-semibold tabular-nums">{formatCurrency(total)}</p>
        </div>
      </header>

      {/* Stacked proportion bar */}
      <TooltipProvider delayDuration={100}>
        <div className="flex h-7 w-full overflow-hidden rounded-full bg-muted">
          {sorted.map(card => {
            const pct = total > 0 ? (card.netAmount / total) * 100 : 0
            if (pct < 0.01) return null
            const isCash = card.cardType === cashKey
            const label = cardTypeLabel(card.cardType)
            return (
              <Tooltip key={card.cardType}>
                <TooltipTrigger asChild>
                  <div
                    style={{ width: `${pct}%` }}
                    className={cn(
                      'flex h-full cursor-default items-center justify-center overflow-hidden px-1.5 transition-opacity hover:opacity-90',
                      PROPORTION_COLORS[card.cardType] ?? 'bg-foreground/30',
                      isCash ? 'text-emerald-50' : 'text-background',
                    )}
                    aria-label={`${label}: ${pct.toFixed(1)}%`}
                  >
                    {pct >= 10 ? (
                      <span className="truncate text-[10px] font-semibold uppercase tracking-wider">
                        {label} · {pct.toFixed(1)}%
                      </span>
                    ) : pct >= 4 ? (
                      <span className="truncate text-[10px] font-semibold uppercase tracking-wider">{pct.toFixed(0)}%</span>
                    ) : null}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="space-y-1 px-3 py-2">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider">
                    <span
                      aria-hidden
                      className={cn('h-2 w-2 rounded-full', PROPORTION_COLORS[card.cardType] ?? 'bg-foreground/30')}
                    />
                    {label}
                    <span className="text-background/70">· {pct.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between gap-6 text-[11px] tabular-nums">
                    <span className="text-background/70">Monto</span>
                    <span className="font-semibold">{formatCurrency(card.netAmount)}</span>
                  </div>
                  <div className="flex justify-between gap-6 text-[11px] tabular-nums">
                    <span className="text-background/70">Txns</span>
                    <span className="font-semibold">{card.transactionCount}</span>
                  </div>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </TooltipProvider>

      {/* Tabular rows — info-only */}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/40 text-[10px] uppercase tracking-wider text-muted-foreground">
            <th className="py-2 pr-2 text-left font-medium">Método</th>
            <th className="py-2 px-2 text-right font-medium">Monto neto</th>
            <th className="hidden py-2 px-2 text-right font-medium sm:table-cell">%</th>
            <th className="hidden py-2 px-2 text-right font-medium md:table-cell">Txns</th>
            <th className="hidden py-2 px-2 text-right font-medium md:table-cell">Comisiones</th>
            <th className="py-2 pl-2 text-right font-medium">Liquidación</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(card => {
            const pct = total > 0 ? (card.netAmount / total) * 100 : 0
            const isCash = card.cardType === cashKey
            return (
              <tr key={card.cardType} className="border-b border-border/20 last:border-0">
                <td className="py-2 pr-2">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className={cn('h-2 w-2 shrink-0 rounded-full', PROPORTION_COLORS[card.cardType] ?? 'bg-foreground/30')}
                    />
                    <span className="font-medium">{cardTypeLabel(card.cardType)}</span>
                  </div>
                </td>
                <td className="py-2 px-2 text-right font-medium tabular-nums">{formatCurrency(card.netAmount)}</td>
                <td className="hidden py-2 px-2 text-right tabular-nums text-muted-foreground sm:table-cell">
                  {pct.toFixed(1)}%
                </td>
                <td className="hidden py-2 px-2 text-right tabular-nums text-muted-foreground md:table-cell">
                  {card.transactionCount}
                </td>
                <td className="hidden py-2 px-2 text-right tabular-nums text-muted-foreground md:table-cell">
                  {isCash ? '—' : `-${formatCurrency(card.fees)}`}
                </td>
                <td className="py-2 pl-2 text-right text-xs text-muted-foreground">
                  {isCash
                    ? 'Inmediato'
                    : card.settlementDays !== null
                      ? `${card.settlementDays} ${card.settlementDays === 1 ? 'día háb.' : 'días háb.'}`
                      : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </GlassCard>
  )
}
