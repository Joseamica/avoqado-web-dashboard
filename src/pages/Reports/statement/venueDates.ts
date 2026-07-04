/**
 * Venue-local date helpers for the period statement.
 *
 * Settlement dates arrive as bare `YYYY-MM-DD` strings that are ALREADY in the
 * venue timezone. Formatting them via `new Date(str)` would parse them as UTC
 * midnight and shift the day backwards in negative-offset timezones (Mexico is
 * UTC-6). So we split the parts and build a local `Date`, which never shifts.
 *
 * Extracted from the old MerchantBreakdownPanel / SettlementMiniCalendar, which
 * each carried their own copy of this logic.
 */

/** Format a bare `YYYY-MM-DD` (already venue-local) as e.g. "Fri, Jul 3" — no timezone shift. */
export function formatVenueDate(dateStr: string, locale: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

/** Today as `YYYY-MM-DD` in the venue timezone (en-CA formats ISO-style). */
export function todayInVenue(timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date())
}

/** "1 día hábil" / "3 días hábiles" via the shared settlement i18n keys. */
export function formatBusinessDays(days: number, t: (key: string, opts?: Record<string, unknown>) => string): string {
  return days <= 1
    ? t('salesSummary.settlement.businessDay', { count: days })
    : t('salesSummary.settlement.businessDays', { count: days })
}
