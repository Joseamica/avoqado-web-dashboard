import { useMemo, useState } from 'react'
import { DateTime } from 'luxon'
import { useTranslation } from 'react-i18next'
import { Check, Clock } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export interface SettlementCalendarBreakdown {
  cardType: string
  netAmount: number
  transactionCount: number
}

export interface SettlementCalendarEntry {
  settlementDate: string | Date
  totalNetAmount: number
  transactionCount: number
  /** SETTLED = el dinero ya se depositó · PENDING = estimado, en tránsito */
  status?: 'SETTLED' | 'PENDING'
  byCardType: SettlementCalendarBreakdown[]
}

interface Props {
  entries: SettlementCalendarEntry[]
  timezone: string
  formatCurrency: (value: number) => string
  cardTypeLabel: (key: string) => string
  /**
   * Number of days to display starting today.
   * Default 14 covers the longest settlement window — an INTERNATIONAL payment
   * made on a Friday takes 5 business days, landing the following Friday.
   */
  windowDays?: number
  className?: string
}

const WEEKDAYS_ES = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM']
const MONTHS_ES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']

interface DayCell {
  iso: string
  dt: DateTime
  weekday: string
  dayNumber: string
  month: string
  isToday: boolean
  isWeekend: boolean
  /** Teach why weekends are empty — only on the first empty day of each weekend, not both */
  showWeekendNote: boolean
  entry: SettlementCalendarEntry | null
}

export function SettlementCalendarWeek({
  entries,
  timezone,
  formatCurrency,
  cardTypeLabel,
  windowDays = 14,
  className,
}: Props) {
  const { t, i18n } = useTranslation('availableBalance')
  const [activeWeek, setActiveWeek] = useState<0 | 1>(0)

  const days: DayCell[] = useMemo(() => {
    const startOfToday = DateTime.now().setZone(timezone).startOf('day')

    const entryByDate = new Map<string, SettlementCalendarEntry>()
    for (const entry of entries) {
      const raw = entry.settlementDate
      const dt = typeof raw === 'string' ? DateTime.fromISO(raw, { zone: 'utc' }) : DateTime.fromJSDate(raw)
      const key = dt.setZone(timezone).toISODate()
      if (!key) continue
      const existing = entryByDate.get(key)
      if (!existing) {
        entryByDate.set(key, { ...entry, byCardType: [...entry.byCardType] })
        continue
      }
      existing.totalNetAmount += entry.totalNetAmount
      existing.transactionCount += entry.transactionCount
      // A day is only "deposited" when every entry that lands on it is settled.
      existing.status =
        existing.status === 'PENDING' || entry.status === 'PENDING'
          ? 'PENDING'
          : existing.status === 'SETTLED' && entry.status === 'SETTLED'
            ? 'SETTLED'
            : undefined
      const merged = new Map(existing.byCardType.map(c => [c.cardType, { ...c }]))
      for (const c of entry.byCardType) {
        const prev = merged.get(c.cardType)
        if (prev) {
          prev.netAmount += c.netAmount
          prev.transactionCount += c.transactionCount
        } else {
          merged.set(c.cardType, { ...c })
        }
      }
      existing.byCardType = Array.from(merged.values())
    }

    const cells = Array.from({ length: windowDays }, (_, i): DayCell => {
      const dt = startOfToday.plus({ days: i })
      const iso = dt.toISODate() ?? ''
      const weekdayIdx = dt.weekday - 1 // luxon: 1=Mon..7=Sun
      const monthIdx = dt.month - 1
      return {
        iso,
        dt,
        weekday: WEEKDAYS_ES[weekdayIdx],
        dayNumber: String(dt.day),
        month: MONTHS_ES[monthIdx],
        isToday: i === 0,
        isWeekend: dt.weekday === 6 || dt.weekday === 7,
        showWeekendNote: false,
        entry: entryByDate.get(iso) ?? null,
      }
    })

    let prevShowedNote = false
    for (const cell of cells) {
      if (cell.isWeekend && !cell.entry) {
        cell.showWeekendNote = !prevShowedNote
        prevShowedNote = true
      } else {
        prevShowedNote = false
      }
    }

    return cells
  }, [entries, timezone, windowDays])

  // Slice into weeks of 7 days each
  const weeks = useMemo(() => {
    const result: DayCell[][] = []
    for (let i = 0; i < days.length; i += 7) {
      result.push(days.slice(i, i + 7))
    }
    return result
  }, [days])

  const currentWeek = weeks[activeWeek] ?? weeks[0]
  const totalAcrossWindow = useMemo(
    () => days.reduce((sum, d) => sum + (d.entry?.totalNetAmount ?? 0), 0),
    [days],
  )
  const txnsAcrossWindow = useMemo(
    () => days.reduce((sum, d) => sum + (d.entry?.transactionCount ?? 0), 0),
    [days],
  )
  const weekTotal = useMemo(
    () => currentWeek.reduce((sum, d) => sum + (d.entry?.totalNetAmount ?? 0), 0),
    [currentWeek],
  )
  const weekTxns = useMemo(
    () => currentWeek.reduce((sum, d) => sum + (d.entry?.transactionCount ?? 0), 0),
    [currentWeek],
  )

  // Mobile agenda: the whole window as a flat list of days that actually carry money
  const daysWithData = useMemo(() => days.filter(d => d.entry && d.entry.totalNetAmount > 0), [days])

  const fmtShort = (dt: DateTime) => dt.setLocale(i18n.language).toLocaleString({ day: 'numeric', month: 'short' })
  const rangeLabel = currentWeek.length ? `${fmtShort(currentWeek[0].dt)} — ${fmtShort(currentWeek[currentWeek.length - 1].dt)}` : ''
  const windowRangeLabel = days.length ? `${fmtShort(days[0].dt)} — ${fmtShort(days[days.length - 1].dt)}` : ''

  return (
    <GlassCard className={cn('overflow-hidden', className)}>
      <header className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6 sm:py-5">
        <div>
          <h3 className="hidden text-base font-semibold tracking-tight sm:block">
            {weeks.length > 1 ? (activeWeek === 0 ? t('calendar.thisWeek') : t('calendar.nextWeek')) : t('calendar.upcoming')}
          </h3>
          <h3 className="text-base font-semibold tracking-tight sm:hidden">{t('calendar.upcoming')}</h3>
          <p className="mt-1 hidden text-xs text-muted-foreground sm:block">{t('calendar.scheduledRange', { range: rangeLabel })}</p>
          <p className="mt-1 text-xs text-muted-foreground sm:hidden">{t('calendar.scheduledRange', { range: windowRangeLabel })}</p>
        </div>
        <div className="hidden items-center gap-6 sm:flex">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{t('calendar.weekTotal')}</p>
            <p className="text-base font-semibold tabular-nums">{formatCurrency(weekTotal)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{t('calendar.transactions')}</p>
            <p className="text-base font-semibold tabular-nums">{weekTxns}</p>
          </div>
        </div>
        <div className="flex items-center gap-6 sm:hidden">
          <div className="text-left">
            <p className="text-xs text-muted-foreground">{t('calendar.next14Days')}</p>
            <p className="text-base font-semibold tabular-nums">{formatCurrency(totalAcrossWindow)}</p>
          </div>
          <div className="text-left">
            <p className="text-xs text-muted-foreground">{t('calendar.transactions')}</p>
            <p className="text-base font-semibold tabular-nums">{txnsAcrossWindow}</p>
          </div>
        </div>
      </header>

      {weeks.length > 1 && (
        <div className="hidden items-center gap-1 border-y border-border/50 bg-muted/30 px-4 py-2 sm:flex sm:px-6">
          {weeks.map((_, idx) => (
            <Button
              key={idx}
              size="sm"
              variant={activeWeek === idx ? 'secondary' : 'ghost'}
              className="h-7 text-xs"
              onClick={() => setActiveWeek(idx as 0 | 1)}
            >
              {idx === 0 ? t('calendar.thisWeek') : t('calendar.nextWeek')}
            </Button>
          ))}
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {formatCurrency(totalAcrossWindow)} · {txnsAcrossWindow} txns en 14 días
          </span>
        </div>
      )}

      {/* Desktop: week grid */}
      <div className="hidden grid-cols-7 divide-x divide-border/40 border-t border-border/50 sm:grid">
        {currentWeek.map(day => (
          <DayColumn key={day.iso} day={day} formatCurrency={formatCurrency} cardTypeLabel={cardTypeLabel} />
        ))}
      </div>

      {/* Mobile: agenda list over the full window — a 7-column grid is unreadable on a phone */}
      <div className="border-t border-border/50 sm:hidden">
        {daysWithData.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">{t('calendar.noUpcoming')}</p>
        ) : (
          <ul className="divide-y divide-border/40">
            {daysWithData.map(day => (
              <AgendaRow key={day.iso} day={day} formatCurrency={formatCurrency} cardTypeLabel={cardTypeLabel} />
            ))}
          </ul>
        )}
      </div>
    </GlassCard>
  )
}

function StatusBadge({ status, className }: { status?: 'SETTLED' | 'PENDING'; className?: string }) {
  const { t } = useTranslation('availableBalance')
  if (!status) return null
  const settled = status === 'SETTLED'
  const Icon = settled ? Check : Clock
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[10px] font-medium',
        settled ? 'text-muted-foreground' : 'text-amber-600 dark:text-amber-400',
        className,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {settled ? t('calendar.deposited') : t('calendar.estimated')}
    </span>
  )
}

function DayBreakdownContent({
  day,
  formatCurrency,
  cardTypeLabel,
}: {
  day: DayCell
  formatCurrency: (n: number) => string
  cardTypeLabel: (k: string) => string
}) {
  const { t, i18n } = useTranslation('availableBalance')
  const entry = day.entry!
  const sortedBreakdown = [...entry.byCardType].sort((a, b) => b.netAmount - a.netAmount)
  const fullDate = day.dt.setLocale(i18n.language).toLocaleString({ weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <>
      <div className="border-b border-border/50 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{fullDate}</p>
          <StatusBadge status={entry.status} />
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-2">
          <p className="text-base font-semibold tabular-nums">{formatCurrency(entry.totalNetAmount)}</p>
          <p className="text-[11px] text-muted-foreground tabular-nums">
            {t('calendar.transactionCount', { count: entry.transactionCount })}
          </p>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">{t('calendar.netToDeposit')}</p>
      </div>
      <ul className="max-h-64 overflow-y-auto px-4 py-3">
        {sortedBreakdown.map(c => (
          <li key={c.cardType} className="flex items-baseline justify-between gap-3 py-1.5 text-xs">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{cardTypeLabel(c.cardType)}</p>
              <p className="text-[11px] text-muted-foreground tabular-nums">{t('calendar.tx', { count: c.transactionCount })}</p>
            </div>
            <span className="tabular-nums">{formatCurrency(c.netAmount)}</span>
          </li>
        ))}
      </ul>
    </>
  )
}

function DayColumn({
  day,
  formatCurrency,
  cardTypeLabel,
}: {
  day: DayCell
  formatCurrency: (n: number) => string
  cardTypeLabel: (k: string) => string
}) {
  const { t } = useTranslation('availableBalance')
  const hasData = !!day.entry && day.entry.totalNetAmount > 0

  const inner = (
    <>
      {day.isToday && (
        <span aria-hidden className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-primary" />
      )}

      <div className="flex items-start justify-between gap-1">
        <div>
          <p
            className={cn(
              'text-[10px] font-semibold uppercase tracking-wider',
              day.isToday ? 'text-primary' : day.isWeekend ? 'text-muted-foreground/60' : 'text-muted-foreground',
            )}
          >
            {day.weekday}
          </p>
          <p className={cn('mt-1 text-2xl font-semibold leading-none tabular-nums', day.isToday && 'text-primary')}>
            {day.dayNumber}
          </p>
          <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{day.month}</p>
        </div>
        {day.isToday && (
          <span className="text-[10px] font-medium uppercase tracking-wider text-primary">{t('calendar.today')}</span>
        )}
      </div>

      <div className="mt-auto pt-4">
        {hasData ? (
          <>
            <p className="text-sm font-semibold tabular-nums">{formatCurrency(day.entry!.totalNetAmount)}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{t('calendar.tx', { count: day.entry!.transactionCount })}</p>
            <StatusBadge status={day.entry!.status} className="mt-1.5" />
            <ul className="mt-3 space-y-1 border-t border-border/30 pt-2">
              {[...day.entry!.byCardType]
                .sort((a, b) => b.netAmount - a.netAmount)
                .slice(0, 4)
                .map(c => (
                  <li key={c.cardType} className="flex items-baseline justify-between gap-2 text-[11px]">
                    <span className="truncate text-muted-foreground">{cardTypeLabel(c.cardType)}</span>
                    <span className="tabular-nums">{formatCurrency(c.netAmount)}</span>
                  </li>
                ))}
            </ul>
          </>
        ) : day.showWeekendNote ? (
          <p className="text-[11px] leading-snug text-muted-foreground/70">{t('calendar.weekendNote')}</p>
        ) : day.isWeekend ? (
          <p aria-hidden className="text-[11px] text-muted-foreground/50">
            —
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground/70">{t('calendar.noSettlements')}</p>
        )}
      </div>
    </>
  )

  if (!hasData) {
    return <div className={cn('relative flex min-h-[180px] flex-col px-3 py-4', day.isToday && 'bg-primary/5')}>{inner}</div>
  }

  // Click/tap-driven Popover (not HoverCard): works on touch, keyboard and mouse alike.
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'relative flex min-h-[180px] w-full cursor-pointer flex-col px-3 py-4 text-left transition-colors hover:bg-muted/30',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
            day.isToday && 'bg-primary/5',
          )}
        >
          {inner}
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" sideOffset={6} className="w-72 p-0">
        <DayBreakdownContent day={day} formatCurrency={formatCurrency} cardTypeLabel={cardTypeLabel} />
      </PopoverContent>
    </Popover>
  )
}

function AgendaRow({
  day,
  formatCurrency,
  cardTypeLabel,
}: {
  day: DayCell
  formatCurrency: (n: number) => string
  cardTypeLabel: (k: string) => string
}) {
  const { t, i18n } = useTranslation('availableBalance')
  const entry = day.entry!
  const dayLabel = day.dt.setLocale(i18n.language).toLocaleString({ weekday: 'short', day: 'numeric', month: 'short' })

  return (
    <li>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
            )}
          >
            <div>
              <p className="text-sm font-medium">
                {dayLabel}
                {day.isToday && (
                  <span className="ml-1.5 text-[10px] font-medium uppercase tracking-wider text-primary">{t('calendar.today')}</span>
                )}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{t('calendar.tx', { count: entry.transactionCount })}</p>
            </div>
            <div className="flex flex-col items-end">
              <p className="text-sm font-semibold tabular-nums">{formatCurrency(entry.totalNetAmount)}</p>
              <StatusBadge status={entry.status} className="mt-0.5" />
            </div>
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-0">
          <DayBreakdownContent day={day} formatCurrency={formatCurrency} cardTypeLabel={cardTypeLabel} />
        </PopoverContent>
      </Popover>
    </li>
  )
}
