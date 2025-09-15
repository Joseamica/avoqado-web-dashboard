import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import Sparkline from './Sparkline'
import { useTranslation } from 'react-i18next'
import { getIntlLocale } from '@/utils/i18n-locale'
import { useCurrentVenue } from '@/hooks/use-current-venue'

type Props = {
  title: string
  value: number | string | null
  format?: 'currency' | 'percent' | 'number'
  delta?: { label?: string; value: number; positiveIsGood?: boolean }
  tooltip?: string
  trend?: number[]
  currency?: string // optional currency override (e.g., 'USD', 'MXN')
}

export default function KpiCard({ title, value, format = 'number', delta, tooltip, trend, currency }: Props) {
  const { i18n } = useTranslation()
  const { venue } = useCurrentVenue()
  const locale = getIntlLocale(i18n.language)
  const currencyCode = currency || venue?.currency || 'USD'

  const display = (() => {
    if (value === null) return '—'
    if (typeof value === 'string') return value
    if (format === 'currency')
      return Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode, maximumFractionDigits: 0 }).format(value)
    if (format === 'percent') return Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(value)
    return Intl.NumberFormat(locale).format(value)
  })()

  const deltaText = (() => {
    if (!delta) return null
    const pct = Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(delta.value)
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
