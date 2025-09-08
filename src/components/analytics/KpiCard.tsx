import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import Sparkline from './Sparkline'

type Props = {
  title: string
  value: number | string | null
  format?: 'currency' | 'percent' | 'number'
  delta?: { label?: string; value: number; positiveIsGood?: boolean }
  tooltip?: string
  trend?: number[]
}

export default function KpiCard({ title, value, format = 'number', delta, tooltip, trend }: Props) {
  const display = (() => {
    if (value === null) return '—'
    if (typeof value === 'string') return value
    if (format === 'currency')
      return Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
    if (format === 'percent') return `${(value * 100).toFixed(1)}%`
    return Intl.NumberFormat().format(value)
  })()

  const deltaText = (() => {
    if (!delta) return null
    const pct = `${(delta.value * 100).toFixed(1)}%`
    const up = delta.value >= 0
    const ok = delta.positiveIsGood ? up : !up
    return (
      <span className={`text-xs font-medium ${ok ? 'text-emerald-600' : 'text-rose-600'}`}>
        {up ? '+' : ''}
        {pct}
        {delta.label ? ` ${delta.label}` : ''}
      </span>
    )
  })()

  return (
    <div className="group relative overflow-hidden rounded-xl border bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>{title}</span>
          {tooltip && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button aria-label={`About ${title}`} className="text-muted-foreground/70 hover:text-foreground">
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs leading-relaxed">{tooltip}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        {trend && trend.length > 2 && (
          <div className="opacity-70">
            <Sparkline data={trend} width={84} height={28} stroke="#6366f1" />
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <div className="text-2xl font-semibold tracking-tight">{display}</div>
        {deltaText}
      </div>
    </div>
  )
}
