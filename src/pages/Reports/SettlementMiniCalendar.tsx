import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarClock, Check, ChevronDown, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GlassCard } from '@/components/ui/glass-card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import type { SettlementCalendarDay } from '@/services/reports/salesSummary.service'

interface Props {
  days: SettlementCalendarDay[]
  formatCurrency: (n: number) => string
  className?: string
}

/** Parse a bare YYYY-MM-DD (already in venue timezone) as a local calendar date
 *  so formatting never shifts the day across the UTC boundary. */
function formatDayLabel(dateStr: string, locale: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1)
  return dt.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })
}

const STATUS_META: Record<SettlementCalendarDay['status'], { icon: typeof Check; tone: string }> = {
  settled: { icon: Check, tone: 'text-muted-foreground' },
  pending: { icon: Clock, tone: 'text-amber-600 dark:text-amber-400' },
  projected: { icon: CalendarClock, tone: 'text-blue-600 dark:text-blue-400' },
}

/**
 * Settlement mini-calendar (Entrega 2) — "¿cuándo cae el dinero de tarjeta?".
 * The date-range picker scopes WHICH sales; this shows WHEN that card money
 * lands, per day, broken down by merchant. Estimate only (rule-based until a
 * bank API confirms). Cash is excluded — it is already in hand.
 */
export function SettlementMiniCalendar({ days, formatCurrency, className }: Props) {
  const { t, i18n } = useTranslation('reports')
  const [open, setOpen] = useState(false)

  const incoming = useMemo(() => days.filter(d => d.status !== 'settled').reduce((s, d) => s + d.totalNet, 0), [days])

  if (days.length === 0) return null

  return (
    <GlassCard className={cn('border-input', className)}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex w-full items-center justify-between gap-4 rounded-2xl p-4 text-left transition-colors hover:bg-muted/30">
            <div className="flex items-center gap-3 min-w-0">
              <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', !open && '-rotate-90')} />
              <div className="min-w-0">
                <h3 className="text-sm font-semibold tracking-tight">{t('salesSummary.settlement.calendar.title')}</h3>
                <p className="text-xs text-muted-foreground">{t('salesSummary.settlement.calendar.subtitle')}</p>
              </div>
            </div>
            {incoming > 0 && (
              <div className="text-right shrink-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t('salesSummary.settlement.calendar.incoming')}
                </p>
                <p className="text-base font-semibold tabular-nums">{formatCurrency(incoming)}</p>
              </div>
            )}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="space-y-3 px-4 pb-4">
            {days.map(day => {
              const Meta = STATUS_META[day.status]
              const Icon = Meta.icon
              return (
                <div key={day.date} className="rounded-lg border border-input p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 text-sm font-medium capitalize">
                      <Icon className={cn('h-3.5 w-3.5', Meta.tone)} aria-hidden />
                      {formatDayLabel(day.date, i18n.language)}
                    </span>
                    <span className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold tabular-nums">{formatCurrency(day.totalNet)}</span>
                      <span className={cn('text-[11px]', Meta.tone)}>{t(`salesSummary.settlement.calendar.status.${day.status}`)}</span>
                    </span>
                  </div>
                  <div className="mt-2 space-y-1">
                    {day.byMerchant.map(m => (
                      <div key={m.merchantAccountId} className="flex items-center justify-between gap-3 pl-5 text-xs text-muted-foreground">
                        <span className="truncate">{m.displayName}</span>
                        <span className="tabular-nums">
                          {t('salesSummary.settlement.calendar.merchantLine', {
                            fee: formatCurrency(m.platformFee),
                            net: formatCurrency(m.netToReceive),
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
            <p className="text-[11px] leading-relaxed text-muted-foreground">{t('salesSummary.settlement.calendar.note')}</p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </GlassCard>
  )
}
