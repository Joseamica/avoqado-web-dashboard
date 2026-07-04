import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Check, CircleDot, Diamond } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useIsMobile } from '@/hooks/use-mobile'
import type { SettlementCalendarDay } from '@/services/reports/salesSummary.service'
import { formatVenueDate } from './venueDates'

interface Props {
  days: SettlementCalendarDay[]
  incoming: number
  unprojected: number
  formatCurrency: (n: number) => string
}

const STATUS_META: Record<SettlementCalendarDay['status'], { icon: typeof Check; tone: string }> = {
  settled: { icon: Check, tone: 'text-muted-foreground' },
  pending: { icon: CircleDot, tone: 'text-amber-600 dark:text-amber-400' },
  projected: { icon: Diamond, tone: 'text-blue-600 dark:text-blue-400' },
}

type TFn = (key: string, opts?: Record<string, unknown>) => string

function DayDetail({ day, formatCurrency, t }: { day: SettlementCalendarDay; formatCurrency: (n: number) => string; t: TFn }) {
  return (
    <ul className="space-y-1">
      {day.byMerchant.map(m => (
        <li key={m.merchantAccountId} className="flex items-center justify-between gap-3 text-xs">
          <span className="truncate text-foreground">{m.displayName}</span>
          <span className="shrink-0 tabular-nums text-muted-foreground">
            {t('salesSummary.statement.timeline.merchantLine', { fee: formatCurrency(m.platformFee), net: formatCurrency(m.netToReceive) })}
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Payout timeline — "when does the card money land?". Always visible (no
 * collapsible): a horizontal strip of settlement days with a status icon, the
 * date, and the amount. Honesty chip surfaces card money with no estimated date
 * so the totals reconcile. Estimate only until a bank API confirms.
 */
export function PayoutTimeline({ days, incoming, unprojected, formatCurrency }: Props) {
  const { t, i18n } = useTranslation('reports')
  const isMobile = useIsMobile()
  const [openDate, setOpenDate] = useState<string | null>(null)
  const locale = i18n.language

  if (days.length === 0 && unprojected <= 1) return null

  return (
    <div className="p-5 sm:p-6" data-tour="statement-timeline">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-sm font-semibold tracking-tight">{t('salesSummary.statement.timeline.title')}</h3>
        {incoming > 0 && (
          <div className="text-right">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('salesSummary.statement.timeline.incoming')} </span>
            <span className="text-sm font-semibold tabular-nums" data-testid="timeline-incoming">
              {formatCurrency(incoming)}
            </span>
          </div>
        )}
      </div>

      {unprojected > 1 && (
        <div
          className="mt-3 flex items-center gap-2 rounded-lg border border-amber-600/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:border-amber-400/30 dark:text-amber-300"
          data-testid="timeline-unprojected-chip"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{t('salesSummary.statement.timeline.unprojected', { amount: formatCurrency(unprojected) })}</span>
        </div>
      )}

      {days.length > 0 && (
        <>
          <div className="mt-3 flex snap-x gap-2 overflow-x-auto pb-2">
            {days.map(day => {
              const Meta = STATUS_META[day.status]
              const Icon = Meta.icon
              const node = (
                <button
                  type="button"
                  onClick={() => setOpenDate(prev => (prev === day.date ? null : day.date))}
                  data-testid={`timeline-day-${day.date}`}
                  className="flex min-w-[92px] shrink-0 snap-start cursor-pointer flex-col items-center gap-1 rounded-lg border border-input p-2.5 text-center transition-colors hover:bg-muted/30"
                >
                  <Icon className={cn('h-4 w-4', Meta.tone)} aria-hidden />
                  <span className="text-xs font-medium capitalize">{formatVenueDate(day.date, locale)}</span>
                  <span className="text-sm font-semibold tabular-nums">{formatCurrency(day.totalNet)}</span>
                  <span className={cn('text-[10px]', Meta.tone)}>{t(`salesSummary.statement.timeline.status.${day.status}`)}</span>
                </button>
              )
              // Desktop: hover/click popover. Mobile: inline panel below the strip.
              return isMobile ? (
                <div key={day.date}>{node}</div>
              ) : (
                <Popover key={day.date}>
                  <PopoverTrigger asChild>{node}</PopoverTrigger>
                  {day.byMerchant.length > 0 && (
                    <PopoverContent className="w-64" align="center">
                      <DayDetail day={day} formatCurrency={formatCurrency} t={t} />
                    </PopoverContent>
                  )}
                </Popover>
              )
            })}
          </div>

          {isMobile && openDate && (
            <div className="mt-2 rounded-lg border border-input p-3">
              {(() => {
                const day = days.find(d => d.date === openDate)
                return day && day.byMerchant.length > 0 ? <DayDetail day={day} formatCurrency={formatCurrency} t={t} /> : null
              })()}
            </div>
          )}
        </>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{t('salesSummary.statement.timeline.note')}</p>
    </div>
  )
}
