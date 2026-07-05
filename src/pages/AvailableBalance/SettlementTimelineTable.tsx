import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { History } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useVenueDateTime } from '@/utils/datetime'
import { cn } from '@/lib/utils'
import type { TimelineEntry } from '@/services/availableBalance.service'

interface Props {
  data: TimelineEntry[]
  formatCurrency: (n: number) => string
  cardTypeLabel: (key: string) => string
}

const CARD_TYPE_KEYS = ['CASH', 'DEBIT', 'CREDIT', 'AMEX', 'INTERNATIONAL', 'OTHER'] as const

/** Days shown by default: last week + today + everything upcoming. */
const RECENT_WINDOW_DAYS = 7

interface DayGroup {
  dayKey: string // yyyy-MM-dd in venue tz
  entries: TimelineEntry[]
  net: number
  txns: number
}

/**
 * Settlement timeline as a bank-statement: one bordered block PER DAY (so "Jun 7"
 * reads as one day, not three loose rows), a day header with the day's net total,
 * and compact per-card-type lines inside. Everything is an automatic ESTIMATE by
 * settlement rules — there is no manual confirmation anywhere.
 */
export function SettlementTimelineTable({ data, formatCurrency, cardTypeLabel }: Props) {
  const { t, i18n } = useTranslation('availableBalance')
  const { formatDate, venueTimezone } = useVenueDateTime()
  const [cardTypeFilter, setCardTypeFilter] = useState<string>('all')
  const [showEarlier, setShowEarlier] = useState(false)

  const dayKeyOf = useMemo(() => {
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: venueTimezone }) // yyyy-MM-dd
    return (iso: string) => fmt.format(new Date(iso))
  }, [venueTimezone])
  const todayKey = useMemo(() => dayKeyOf(new Date().toISOString()), [dayKeyOf])

  const dayLabelOf = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(i18n.language, { timeZone: venueTimezone, weekday: 'short', day: 'numeric', month: 'short' })
    return (iso: string) => fmt.format(new Date(iso))
  }, [i18n.language, venueTimezone])

  const filtered = useMemo(() => {
    if (cardTypeFilter === 'all') return data
    return data.filter(d => d.cardType === cardTypeFilter)
  }, [data, cardTypeFilter])

  const presentCardTypes = useMemo(() => {
    const set = new Set<string>()
    for (const d of data) set.add(d.cardType)
    return CARD_TYPE_KEYS.filter(k => set.has(k))
  }, [data])

  // Group by venue-local transaction day, chronological (past → today → future).
  const dayGroups = useMemo<DayGroup[]>(() => {
    const map = new Map<string, DayGroup>()
    for (const e of filtered) {
      const dayKey = dayKeyOf(e.date)
      let g = map.get(dayKey)
      if (!g) {
        g = { dayKey, entries: [], net: 0, txns: 0 }
        map.set(dayKey, g)
      }
      g.entries.push(e)
      g.net += e.netAmount
      g.txns += e.transactionCount
    }
    const groups = Array.from(map.values()).sort((a, b) => (a.dayKey < b.dayKey ? -1 : a.dayKey > b.dayKey ? 1 : 0))
    for (const g of groups) g.entries.sort((a, b) => b.netAmount - a.netAmount)
    return groups
  }, [filtered, dayKeyOf])

  // Default window: last RECENT_WINDOW_DAYS days + today + future. Older days sit
  // behind one "show earlier" button so the relevant part is visible immediately.
  const windowStartKey = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - RECENT_WINDOW_DAYS)
    return dayKeyOf(d.toISOString())
  }, [dayKeyOf])
  const earlierCount = useMemo(() => dayGroups.filter(g => g.dayKey < windowStartKey).length, [dayGroups, windowStartKey])
  const visibleGroups = useMemo(
    () => (showEarlier ? dayGroups : dayGroups.filter(g => g.dayKey >= windowStartKey)),
    [dayGroups, showEarlier, windowStartKey],
  )

  const filteredTotal = useMemo(() => filtered.reduce((s, r) => s + r.netAmount, 0), [filtered])

  const gridCols = 'md:grid-cols-[minmax(0,1.3fr)_4rem_8rem_9rem_10rem]'

  return (
    <div className="space-y-3" data-testid="settlement-timeline">
      {/* Toolbar: card-type filter + summary */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={cardTypeFilter} onValueChange={setCardTypeFilter}>
          <SelectTrigger className="h-9 w-[180px] text-sm">
            <SelectValue placeholder={t('timeline.filterAll')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('timeline.filterAll')}</SelectItem>
            {presentCardTypes.map(k => (
              <SelectItem key={k} value={k}>
                {cardTypeLabel(k)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
          {t('timeline.daysSummary', { count: dayGroups.length, net: formatCurrency(filteredTotal) })}
        </span>
      </div>

      {earlierCount > 0 && !showEarlier && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowEarlier(true)}
          className="w-full justify-center gap-2 text-xs text-muted-foreground"
          data-testid="settlement-timeline-earlier"
        >
          <History className="h-3.5 w-3.5" />
          {t('timeline.showEarlier', { count: earlierCount })}
        </Button>
      )}

      {/* Shared column header (desktop) — groups below share the same grid */}
      <div className={cn('hidden gap-2 px-4 text-[10px] font-medium uppercase tracking-wider text-muted-foreground md:grid', gridCols)}>
        <span>{t('timeline.table.type')}</span>
        <span className="text-right">{t('timeline.table.transactions')}</span>
        <span className="text-right">{t('timeline.table.fees')}</span>
        <span className="text-right">{t('timeline.table.net')}</span>
        <span className="text-right">{t('timeline.table.settlementDate')}</span>
      </div>

      {/* One bordered block per day — the border is the day boundary */}
      {visibleGroups.map(g => {
        const isToday = g.dayKey === todayKey
        return (
          <section
            key={g.dayKey}
            className={cn('overflow-hidden rounded-xl border', isToday ? 'border-amber-500/40' : 'border-input')}
            data-testid={`timeline-day-${g.dayKey}`}
          >
            <header
              className={cn(
                'flex items-baseline justify-between gap-3 border-b px-4 py-2',
                isToday ? 'border-amber-500/30 bg-amber-500/5' : 'border-input bg-muted/30',
              )}
            >
              <span className="flex items-center gap-2 text-sm font-semibold capitalize">
                {dayLabelOf(g.entries[0].date)}
                {isToday && (
                  <Badge variant="outline" className="h-4 border-amber-500/50 px-1.5 text-[10px] text-amber-600 dark:text-amber-400">
                    {t('timeline.today')}
                  </Badge>
                )}
              </span>
              <span className="shrink-0 text-sm tabular-nums">
                <span className="font-semibold">{formatCurrency(g.net)}</span>
                <span className="ml-2 text-xs text-muted-foreground">{t('timeline.txns', { count: g.txns })}</span>
              </span>
            </header>

            <div className="divide-y divide-input/60">
              {g.entries.map((e, i) => {
                const liq = e.cardType === 'CASH' ? t('instant') : e.estimatedSettlementDate ? `~${formatDate(e.estimatedSettlementDate)}` : '—'
                return (
                  <div key={`${e.cardType}-${i}`}>
                    {/* Desktop: aligned grid sharing the column header above */}
                    <div className={cn('hidden items-center gap-2 px-4 py-2.5 md:grid', gridCols)}>
                      <span className="text-sm">{cardTypeLabel(e.cardType)}</span>
                      <span className="text-right text-sm tabular-nums text-muted-foreground">{e.transactionCount}</span>
                      <span className="text-right text-sm tabular-nums text-muted-foreground">
                        {e.fees > 0 ? `−${formatCurrency(e.fees)}` : '—'}
                      </span>
                      <span className={cn('text-right text-sm font-semibold tabular-nums', e.netAmount < 0 && 'text-destructive')}>
                        {formatCurrency(e.netAmount)}
                      </span>
                      <span className="text-right text-sm tabular-nums text-muted-foreground">{liq}</span>
                    </div>
                    {/* Mobile: two compact lines */}
                    <div className="px-4 py-2.5 md:hidden">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm">{cardTypeLabel(e.cardType)}</span>
                        <span className={cn('text-sm font-semibold tabular-nums', e.netAmount < 0 && 'text-destructive')}>
                          {formatCurrency(e.netAmount)}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
                        <span className="tabular-nums">
                          {t('timeline.txns', { count: e.transactionCount })}
                          {e.fees > 0 && <> · −{formatCurrency(e.fees)}</>}
                        </span>
                        <span className="tabular-nums">{liq}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}

      {visibleGroups.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{t('timeline.table.noData')}</p>}

      {/* Honesty note: everything above is an estimate, never a confirmed deposit */}
      <p className="text-[11px] leading-relaxed text-muted-foreground">{t('timeline.estimatedNote')}</p>
    </div>
  )
}
