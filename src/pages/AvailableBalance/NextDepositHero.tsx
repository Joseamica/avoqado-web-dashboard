import { useMemo } from 'react'
import { DateTime } from 'luxon'
import { useTranslation } from 'react-i18next'
import { Clock } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { cn } from '@/lib/utils'

interface Props {
  /** estimatedNextSettlement.date from the balance summary (UTC ISO) — null when nothing is scheduled */
  nextDate: string | null
  nextAmount: number
  /** Total money still in transit (pendingSettlement) */
  pendingAmount: number
  /** Number of upcoming deposit days carrying that money (0 = unknown/outside window) */
  pendingCount: number
  timezone: string
  formatCurrency: (n: number) => string
  className?: string
}

/**
 * Answers the page's core question — "¿cuándo me llega mi dinero?" — in one
 * sentence: amount + relative day + full date. Non-technical users think in
 * "hoy / mañana / el lunes", not in calendar grids; the calendar below is
 * supporting detail.
 */
export function NextDepositHero({ nextDate, nextAmount, pendingAmount, pendingCount, timezone, formatCurrency, className }: Props) {
  const { t, i18n } = useTranslation('availableBalance')

  const dateInfo = useMemo(() => {
    if (!nextDate) return null
    const dt = DateTime.fromISO(nextDate, { zone: 'utc' }).setZone(timezone)
    if (!dt.isValid) return null
    const today = DateTime.now().setZone(timezone).startOf('day')
    const diffDays = Math.round(dt.startOf('day').diff(today, 'days').days)
    const label = dt.setLocale(i18n.language).toLocaleString({ weekday: 'long', day: 'numeric', month: 'long' })
    return { diffDays, label }
  }, [nextDate, timezone, i18n.language])

  const relativeWord = dateInfo ? (dateInfo.diffDays === 0 ? t('hero.today') : dateInfo.diffDays === 1 ? t('hero.tomorrow') : null) : null

  const inTransitLine = pendingAmount > 0 && (
    <p className="mt-2 text-sm text-muted-foreground">
      {t('hero.inTransit', { amount: formatCurrency(pendingAmount) })}
      {pendingCount > 0 && <> {t('hero.inTransitCount', { count: pendingCount })}</>}
    </p>
  )

  return (
    <GlassCard className={cn('px-4 py-4 sm:px-6 sm:py-5', className)} data-tour="balance-next-deposit">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{t('hero.title')}</p>
      {dateInfo ? (
        <>
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-3xl font-bold tracking-tight tabular-nums">{formatCurrency(nextAmount)}</span>
            <span className="text-base font-medium">
              {relativeWord && <>{relativeWord} · </>}
              {dateInfo.label}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
              <Clock className="h-3 w-3" aria-hidden />
              {t('hero.estimated')}
            </span>
          </div>
          {inTransitLine}
        </>
      ) : (
        <>
          <p className="mt-1.5 text-base font-medium">{t('hero.noUpcoming')}</p>
          {inTransitLine || <p className="mt-1 text-sm text-muted-foreground">{t('hero.noUpcomingHint')}</p>}
        </>
      )}
    </GlassCard>
  )
}
