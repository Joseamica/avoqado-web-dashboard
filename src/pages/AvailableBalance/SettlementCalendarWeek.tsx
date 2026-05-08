import { useMemo, useState } from 'react'
import { DateTime } from 'luxon'
import { GlassCard } from '@/components/ui/glass-card'
import { Button } from '@/components/ui/button'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
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

    return Array.from({ length: windowDays }, (_, i) => {
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
        entry: entryByDate.get(iso) ?? null,
      }
    })
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

  const rangeLabel = currentWeek.length
    ? `${currentWeek[0].dt.setLocale('es').toFormat("d 'de' MMM")} — ${currentWeek[currentWeek.length - 1].dt.setLocale('es').toFormat("d 'de' MMM")}`
    : ''

  return (
    <GlassCard className={cn('overflow-hidden', className)}>
      <header className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6 sm:py-5">
        <div>
          <h3 className="text-base font-semibold tracking-tight">
            {weeks.length > 1 ? (activeWeek === 0 ? 'Esta semana' : 'Próxima semana') : 'Próximas liquidaciones'}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Liquidaciones programadas · {rangeLabel}
          </p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total semana</p>
            <p className="text-base font-semibold tabular-nums">{formatCurrency(weekTotal)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Transacciones</p>
            <p className="text-base font-semibold tabular-nums">{weekTxns}</p>
          </div>
        </div>
      </header>

      {weeks.length > 1 && (
        <div className="flex items-center gap-1 border-y border-border/50 bg-muted/30 px-4 py-2 sm:px-6">
          {weeks.map((_, idx) => (
            <Button
              key={idx}
              size="sm"
              variant={activeWeek === idx ? 'secondary' : 'ghost'}
              className="h-7 text-xs"
              onClick={() => setActiveWeek(idx as 0 | 1)}
            >
              {idx === 0 ? 'Esta semana' : 'Próxima semana'}
            </Button>
          ))}
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {formatCurrency(totalAcrossWindow)} · {txnsAcrossWindow} txns en 14 días
          </span>
        </div>
      )}

      <div className="grid grid-cols-7 divide-x divide-border/40 border-t border-border/50">
        {currentWeek.map(day => (
          <DayColumn key={day.iso} day={day} formatCurrency={formatCurrency} cardTypeLabel={cardTypeLabel} />
        ))}
      </div>
    </GlassCard>
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
  const hasData = !!day.entry && day.entry.totalNetAmount > 0

  const column = (
    <div
      className={cn(
        'relative flex min-h-[180px] flex-col px-3 py-4',
        day.isToday && 'bg-primary/5',
        hasData && 'cursor-default',
      )}
    >
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
        {day.isToday && <span className="text-[10px] font-medium uppercase tracking-wider text-primary">Hoy</span>}
      </div>

      <div className="mt-auto pt-4">
        {hasData ? (
          <>
            <p className="text-sm font-semibold tabular-nums">{formatCurrency(day.entry!.totalNetAmount)}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {day.entry!.transactionCount} {day.entry!.transactionCount === 1 ? 'tx' : 'txs'}
            </p>
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
        ) : (
          <p className="text-[11px] text-muted-foreground/70">Sin liquidaciones</p>
        )}
      </div>
    </div>
  )

  if (!hasData) return column

  const sortedBreakdown = [...day.entry!.byCardType].sort((a, b) => b.netAmount - a.netAmount)
  const fullDate = day.dt.setLocale('es').toFormat("EEEE d 'de' MMMM")

  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>{column}</HoverCardTrigger>
      <HoverCardContent align="center" sideOffset={6} className="w-72 p-0">
        <div className="border-b border-border/50 px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{fullDate}</p>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <p className="text-base font-semibold tabular-nums">{formatCurrency(day.entry!.totalNetAmount)}</p>
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {day.entry!.transactionCount} {day.entry!.transactionCount === 1 ? 'transacción' : 'transacciones'}
            </p>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Monto neto a depositar</p>
        </div>
        <ul className="max-h-64 overflow-y-auto px-4 py-3">
          {sortedBreakdown.map(c => (
            <li key={c.cardType} className="flex items-baseline justify-between gap-3 py-1.5 text-xs">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{cardTypeLabel(c.cardType)}</p>
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  {c.transactionCount} {c.transactionCount === 1 ? 'tx' : 'txs'}
                </p>
              </div>
              <span className="tabular-nums">{formatCurrency(c.netAmount)}</span>
            </li>
          ))}
        </ul>
      </HoverCardContent>
    </HoverCard>
  )
}
