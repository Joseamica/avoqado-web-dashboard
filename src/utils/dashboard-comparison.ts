import { DateTime, type DurationLikeObject } from 'luxon'

export type RangeKind = 'day' | 'week' | 'month' | 'year' | 'custom'

export interface DateRange {
  from: Date
  to: Date
}

export interface CompareOption {
  /** Stable identifier used for translation key + state */
  id: string
  /** Translation key under `newHome.compareOptions` */
  labelKey: string
  /** Resolved sublabel showing the actual period (e.g. "mar, 5 may") */
  sublabel: string
  /** Computed compare range */
  range: DateRange
  /** Maps to legacy `compareType` field consumed by useDashboardData */
  compareType: 'day' | 'week' | 'month' | 'custom'
}

/**
 * Detect whether the selected range corresponds to a single day, an aligned
 * week (Mon→Sun), a full calendar month, a full calendar year, or a custom range.
 * Tolerates start-of-day/end-of-day boundaries by comparing on the date level.
 */
export function detectRangeKind(range: DateRange, timezone: string): RangeKind {
  const from = DateTime.fromJSDate(range.from).setZone(timezone)
  const to = DateTime.fromJSDate(range.to).setZone(timezone)
  if (!from.isValid || !to.isValid) return 'custom'

  if (from.hasSame(to, 'day')) return 'day'

  const fromStartOfDay = from.startOf('day')
  const toEndOfDay = to.endOf('day')
  const days = Math.round(toEndOfDay.diff(fromStartOfDay, 'days').days)

  if (days >= 6.9 && days < 7.1 && from.weekday === 1 && to.weekday === 7) return 'week'

  if (
    from.day === 1 &&
    to.day === to.daysInMonth &&
    from.hasSame(to, 'month') &&
    from.hasSame(to, 'year')
  )
    return 'month'

  if (from.month === 1 && from.day === 1 && to.month === 12 && to.day === 31 && from.hasSame(to, 'year')) return 'year'

  return 'custom'
}

const subtract = (range: DateRange, timezone: string, dur: DurationLikeObject): DateRange => {
  const from = DateTime.fromJSDate(range.from).setZone(timezone).minus(dur)
  const to = DateTime.fromJSDate(range.to).setZone(timezone).minus(dur)
  return { from: from.toJSDate(), to: to.toJSDate() }
}

const formatDayLabel = (date: Date, timezone: string, locale: string): string =>
  DateTime.fromJSDate(date).setZone(timezone).setLocale(locale).toFormat('ccc, d LLL')

const formatMonthLabel = (date: Date, timezone: string, locale: string): string =>
  DateTime.fromJSDate(date).setZone(timezone).setLocale(locale).toFormat('LLL yyyy')

const formatYearLabel = (date: Date, timezone: string): string =>
  DateTime.fromJSDate(date).setZone(timezone).toFormat('yyyy')

const formatRangeLabel = (range: DateRange, timezone: string, locale: string): string => {
  const from = DateTime.fromJSDate(range.from).setZone(timezone).setLocale(locale)
  const to = DateTime.fromJSDate(range.to).setZone(timezone).setLocale(locale)
  if (from.hasSame(to, 'year')) return `${from.toFormat('d LLL')} – ${to.toFormat('d LLL yyyy')}`
  return `${from.toFormat('d LLL yyyy')} – ${to.toFormat('d LLL yyyy')}`
}

/**
 * Build the list of comparison options Square-style, varying by the range kind.
 * Each option resolves to a concrete sublabel + compare range based on the
 * current selected range and venue timezone.
 */
export function buildCompareOptions(range: DateRange, timezone: string, locale: string): CompareOption[] {
  const kind = detectRangeKind(range, timezone)

  if (kind === 'day') {
    const weekdayLabel = DateTime.fromJSDate(range.from).setZone(timezone).setLocale(locale).toFormat('cccc')
    const day = subtract(range, timezone, { days: 1 })
    const weekday = subtract(range, timezone, { weeks: 1 })
    const weeks4 = subtract(range, timezone, { weeks: 4 })
    const weeks52 = subtract(range, timezone, { weeks: 52 })
    const year = subtract(range, timezone, { years: 1 })
    return [
      { id: 'day', labelKey: 'day', sublabel: formatDayLabel(day.from, timezone, locale), range: day, compareType: 'day' },
      {
        id: 'weekday',
        labelKey: 'weekday',
        sublabel: formatDayLabel(weekday.from, timezone, locale),
        range: weekday,
        compareType: 'week',
        // weekdayLabel is interpolated in the i18n key consumer
      } as CompareOption & { weekdayLabel: string },
      { id: 'weeks4', labelKey: 'weeks4', sublabel: formatDayLabel(weeks4.from, timezone, locale), range: weeks4, compareType: 'custom' },
      { id: 'weeks52', labelKey: 'weeks52', sublabel: formatDayLabel(weeks52.from, timezone, locale), range: weeks52, compareType: 'custom' },
      {
        id: 'year',
        labelKey: 'year',
        sublabel: DateTime.fromJSDate(year.from).setZone(timezone).setLocale(locale).toFormat('d LLL yyyy'),
        range: year,
        compareType: 'custom',
      },
    ].map(opt =>
      opt.id === 'weekday' ? { ...opt, weekdayLabel } : opt,
    ) as CompareOption[]
  }

  if (kind === 'week') {
    const week = subtract(range, timezone, { weeks: 1 })
    const weeks4 = subtract(range, timezone, { weeks: 4 })
    const year = subtract(range, timezone, { years: 1 })
    return [
      { id: 'week', labelKey: 'week', sublabel: formatRangeLabel(week, timezone, locale), range: week, compareType: 'week' },
      { id: 'weeks4', labelKey: 'weeks4', sublabel: formatRangeLabel(weeks4, timezone, locale), range: weeks4, compareType: 'custom' },
      { id: 'year', labelKey: 'year', sublabel: formatRangeLabel(year, timezone, locale), range: year, compareType: 'custom' },
    ]
  }

  if (kind === 'month') {
    const month = subtract(range, timezone, { months: 1 })
    const year = subtract(range, timezone, { years: 1 })
    return [
      { id: 'month', labelKey: 'month', sublabel: formatMonthLabel(month.from, timezone, locale), range: month, compareType: 'month' },
      { id: 'year', labelKey: 'year', sublabel: formatMonthLabel(year.from, timezone, locale), range: year, compareType: 'custom' },
    ]
  }

  if (kind === 'year') {
    const year1 = subtract(range, timezone, { years: 1 })
    const year2 = subtract(range, timezone, { years: 2 })
    const year3 = subtract(range, timezone, { years: 3 })
    return [
      { id: 'year', labelKey: 'year', sublabel: formatYearLabel(year1.from, timezone), range: year1, compareType: 'custom' },
      { id: 'years2', labelKey: 'years2', sublabel: formatYearLabel(year2.from, timezone), range: year2, compareType: 'custom' },
      { id: 'years3', labelKey: 'years3', sublabel: formatYearLabel(year3.from, timezone), range: year3, compareType: 'custom' },
    ]
  }

  // custom: previous period of equal length + previous year
  const fromDt = DateTime.fromJSDate(range.from).setZone(timezone)
  const toDt = DateTime.fromJSDate(range.to).setZone(timezone)
  const days = Math.max(1, Math.round(toDt.endOf('day').diff(fromDt.startOf('day'), 'days').days))
  const period: DateRange = {
    from: fromDt.minus({ days }).toJSDate(),
    to: toDt.minus({ days }).toJSDate(),
  }
  const year = subtract(range, timezone, { years: 1 })
  return [
    { id: 'period', labelKey: 'period', sublabel: formatRangeLabel(period, timezone, locale), range: period, compareType: 'custom' },
    { id: 'year', labelKey: 'year', sublabel: formatRangeLabel(year, timezone, locale), range: year, compareType: 'custom' },
  ]
}
