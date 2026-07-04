import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, CircleDashed, CircleDot, Diamond } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Currency } from '@/utils/currency'
import { GlassCard } from '@/components/ui/glass-card'
import { useSettlementWeek } from '@/hooks/useSettlementWeek'
import type { SettlementWeekDay } from '@/services/availableBalance.service'
import { addWeeks, currentWeekStart, weekDays } from './weekMath'

interface Props {
  venueId: string
  /** IANA venue timezone (decides today + how dates read). */
  venueTimezone: string
  className?: string
}

const CARD_TYPE_LABEL_KEYS: Record<string, string> = {
  CREDIT: 'salesSummary.controls.filterBy.cardType.options.credit',
  DEBIT: 'salesSummary.controls.filterBy.cardType.options.debit',
  AMEX: 'salesSummary.controls.filterBy.cardType.options.amex',
  INTERNATIONAL: 'salesSummary.controls.filterBy.cardType.options.international',
}
// All statuses are ESTIMATES (no bank confirmation exists yet). Past days use a
// dashed circle — "estimated it landed", NOT a ✓ that would imply a confirmed deposit.
const STATUS_META: Record<SettlementWeekDay['status'], { icon: typeof CircleDashed; tone: string }> = {
  settled: { icon: CircleDashed, tone: 'text-muted-foreground' },
  today: { icon: CircleDot, tone: 'text-amber-600 dark:text-amber-400' },
  projected: { icon: Diamond, tone: 'text-blue-600 dark:text-blue-400' },
}

/** Today's yyyy-MM-dd in the venue timezone (en-CA formats ISO-style). */
function todayInVenue(timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date())
}
/** Compact weekday + day-number for a bare yyyy-MM-dd (no timezone shift). */
function dayLabel(dateKey: string, locale: string): { weekday: string; day: string } {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1)
  return { weekday: dt.toLocaleDateString(locale, { weekday: 'short' }), day: String(d) }
}
function rangeLabel(weekStart: string, weekEnd: string, locale: string): string {
  const fmt = (k: string) => {
    const [y, m, d] = k.split('-').map(Number)
    return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
  }
  return `${fmt(weekStart)} – ${fmt(weekEnd)}`
}

/**
 * Shared weekly settlement calendar — how much card money lands in the bank each
 * day of a Monday–Sunday week (by settlement date). Navigable ‹ › by week. Used
 * identically in Saldo Disponible and the Sales Summary statement. Cash is not
 * shown here (it's immediate, in hand the sale day).
 */
export function SettlementWeekStrip({ venueId, venueTimezone, className }: Props) {
  const { t, i18n } = useTranslation('reports')
  const locale = i18n.language
  const [weekStart, setWeekStart] = useState(() => currentWeekStart(venueTimezone))
  const [openDate, setOpenDate] = useState<string | null>(null)
  const { data, isLoading } = useSettlementWeek(venueId, weekStart)

  const byDate = useMemo(() => new Map((data?.days ?? []).map(d => [d.date, d])), [data])
  const cells = useMemo(() => weekDays(weekStart), [weekStart])
  const todayKey = useMemo(() => todayInVenue(venueTimezone), [venueTimezone])

  const statusOf = (dateKey: string): SettlementWeekDay['status'] =>
    dateKey < todayKey ? 'settled' : dateKey === todayKey ? 'today' : 'projected'
  const openDay = openDate ? byDate.get(openDate) : undefined

  return (
    <GlassCard className={cn('p-5 sm:p-6 border-input', className)} data-tour="settlement-week" data-testid="settlement-week">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">{t('salesSummary.settlementWeek.title')}</h3>
          <p className="text-xs text-muted-foreground">{data ? rangeLabel(data.weekStart, data.weekEnd, locale) : rangeLabel(weekStart, addWeeks(weekStart, 0), locale)}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => { setWeekStart(w => addWeeks(w, -1)); setOpenDate(null) }}
            data-testid="settlement-week-prev"
            aria-label={t('salesSummary.settlementWeek.prev')}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-input text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => { setWeekStart(w => addWeeks(w, 1)); setOpenDate(null) }}
            data-testid="settlement-week-next"
            aria-label={t('salesSummary.settlementWeek.next')}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-input text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Week total */}
      {data && (
        <div className="mt-3 flex items-baseline justify-between gap-4 border-t border-input pt-3">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">{t('salesSummary.settlementWeek.weekTotal')}</span>
          <span className="text-base font-semibold tabular-nums" data-testid="settlement-week-total">{Currency(data.weekTotal.net)}</span>
        </div>
      )}

      {/* 7-day strip */}
      <div className="mt-3 flex snap-x gap-2 overflow-x-auto pb-2">
        {cells.map(dateKey => {
          const day = byDate.get(dateKey)
          const status = day?.status ?? statusOf(dateKey)
          const Meta = STATUS_META[status]
          const Icon = Meta.icon
          const { weekday, day: dnum } = dayLabel(dateKey, locale)
          const hasMoney = !!day && day.net !== 0
          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => day && setOpenDate(prev => (prev === dateKey ? null : dateKey))}
              disabled={!day}
              data-testid={`settlement-week-day-${dateKey}`}
              className={cn(
                'flex min-w-[92px] shrink-0 snap-start flex-col items-center gap-1 rounded-lg border p-2.5 text-center transition-colors',
                openDate === dateKey ? 'border-blue-500/50 bg-muted/30' : 'border-input',
                day ? 'cursor-pointer hover:bg-muted/30' : 'opacity-60',
              )}
            >
              <span className="text-[11px] capitalize text-muted-foreground">{weekday} {dnum}</span>
              {hasMoney ? <Icon className={cn('h-4 w-4', Meta.tone)} aria-hidden /> : <span className="h-4" />}
              <span className={cn('text-sm font-semibold tabular-nums', !hasMoney && 'text-muted-foreground')}>{Currency(day?.net ?? 0)}</span>
              {hasMoney && day && <span className="text-[10px] tabular-nums text-muted-foreground">{Currency(day.gross)}</span>}
            </button>
          )
        })}
      </div>

      {/* Per-day detail */}
      {openDay && (
        <div className="mt-2 rounded-lg border border-input p-3" data-testid="settlement-week-detail">
          <div className="space-y-1">
            {openDay.byMerchant.map(m => (
              <div key={m.merchantAccountId} className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-foreground">{m.displayName}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {t('salesSummary.settlementWeek.merchantLine', { commission: Currency(m.commission), net: Currency(m.net) })}
                </span>
              </div>
            ))}
          </div>
          {openDay.byCardType.length > 1 && (
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-input pt-2">
              {openDay.byCardType.map(c => (
                <span key={c.cardType} className="text-[11px] text-muted-foreground">
                  {t(CARD_TYPE_LABEL_KEYS[c.cardType] ?? c.cardType)} <span className="tabular-nums text-foreground">{Currency(c.net)}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {!isLoading && data && data.days.length === 0 && (
        <p className="mt-3 text-xs text-muted-foreground" data-testid="settlement-week-empty">{t('salesSummary.settlementWeek.empty')}</p>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{t('salesSummary.settlementWeek.note')}</p>
    </GlassCard>
  )
}
