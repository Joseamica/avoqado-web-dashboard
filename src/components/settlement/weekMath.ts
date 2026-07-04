/**
 * Monday–Sunday week helpers for the settlement week strip. All keys are bare
 * `yyyy-MM-dd` strings (venue-local calendar dates). Computed via UTC date parts
 * so they never shift across a timezone boundary — the strings ARE the dates.
 */

function fmt(dt: Date): string {
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

/** `yyyy-MM-dd` of the Monday of the week containing `dateKey`. */
export function weekStartOf(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0=Sun … 6=Sat
  const sinceMonday = (dow + 6) % 7
  return fmt(new Date(Date.UTC(y, m - 1, d - sinceMonday)))
}

/** Today's week-start (Monday) in the given IANA timezone. */
export function currentWeekStart(timeZone: string): string {
  const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date()) // yyyy-MM-dd
  return weekStartOf(todayKey)
}

/** Shift a week-start by `n` weeks (negative goes back). */
export function addWeeks(weekStart: string, n: number): string {
  const [y, m, d] = weekStart.split('-').map(Number)
  return fmt(new Date(Date.UTC(y, m - 1, d + n * 7)))
}

/** The 7 `yyyy-MM-dd` days (Mon…Sun) of the week. */
export function weekDays(weekStart: string): string[] {
  const [y, m, d] = weekStart.split('-').map(Number)
  return Array.from({ length: 7 }, (_, i) => fmt(new Date(Date.UTC(y, m - 1, d + i))))
}
