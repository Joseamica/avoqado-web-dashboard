import { DateTime } from 'luxon'

/**
 * Sort ISO year-week keys ("2026-W26") ascending and build a human label in
 * Spanish: "22–28 jun" (same month) or "29 jun–5 jul" (crossing months).
 * Week boundaries were already decided in venue tz on the backend, so the label
 * is computed tz-independently (UTC) from the key.
 */
export function weekBucketsAsc(keys: string[]): { key: string; label: string }[] {
  const sorted = keys.slice().sort((a, b) => a.localeCompare(b))
  return sorted.map(key => {
    const m = key.match(/^(\d{4})-W(\d{2})$/)
    if (!m) return { key, label: key }
    const start = DateTime.fromObject(
      { weekYear: Number(m[1]), weekNumber: Number(m[2]) },
      { zone: 'utc' },
    ).setLocale('es')
    const end = start.plus({ days: 6 })
    const label =
      start.month === end.month
        ? `${start.toFormat('d')}–${end.toFormat('d LLL')}`
        : `${start.toFormat('d LLL')}–${end.toFormat('d LLL')}`
    return { key, label: label.replace(/\./g, '') } // Luxon es short months can carry a dot
  })
}
