import type { OperatingHours } from '@/types/reservation'

export const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
export type DayKey = (typeof DAY_KEYS)[number]

export type HoursError = 'dayNeedsRange' | 'sameTime' | 'incompleteRange'

/** Mismas reglas que el servidor: día abierto con ≥1 rango, rangos completos y open ≠ close (close < open = madrugada). */
export function validateWeek(hours: OperatingHours | null): HoursError[] {
  if (!hours) return []
  const errors = new Set<HoursError>()
  for (const day of DAY_KEYS) {
    const d = hours[day]
    if (!d?.enabled) continue
    if (d.ranges.length === 0) errors.add('dayNeedsRange')
    for (const r of d.ranges) {
      if (!r.open || !r.close) errors.add('incompleteRange')
      else if (r.open === r.close) errors.add('sameTime')
    }
  }
  return [...errors]
}

/** Rangos que cierran después de medianoche: «viernes cierra a las 2:00 del sábado». */
export function overnightNotes(hours: OperatingHours | null): { day: DayKey; nextDay: DayKey; close: string }[] {
  if (!hours) return []
  const notes: { day: DayKey; nextDay: DayKey; close: string }[] = []
  DAY_KEYS.forEach((day, i) => {
    const d = hours[day]
    if (!d?.enabled) return
    for (const r of d.ranges) {
      if (r.open && r.close && r.close < r.open) {
        notes.push({ day, nextDay: DAY_KEYS[(i + 1) % 7], close: r.close.replace(/^0/, '') })
      }
    }
  })
  return notes
}

export const defaultWeek = (): OperatingHours =>
  Object.fromEntries(DAY_KEYS.map(d => [d, { enabled: true, ranges: [{ open: '09:00', close: '22:00' }] }])) as unknown as OperatingHours
