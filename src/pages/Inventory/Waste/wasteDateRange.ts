import { DateTime } from 'luxon'
import type { DateFilter } from '@/components/filters/DateFilterContent'

/**
 * El filtro de fecha de la pantalla, traducido a lo que acepta GET …/inventory/waste-reports:
 * ISO 8601 CON zona (sin zona el servidor responde 422), en la zona del NEGOCIO (no la del
 * navegador), con bordes inclusivos. El servidor filtra por la fecha en que LLEGÓ la merma (L6).
 */
export function wasteDateRange(
  filter: DateFilter | null,
  timezone: string,
  now: DateTime = DateTime.now(),
): { startDate?: string; endDate?: string } {
  if (!filter) return {}
  const iso = (d: DateTime) => d.toISO({ includeOffset: true }) as string
  const day = (value: unknown): DateTime | null => {
    if (typeof value !== 'string' || !value) return null
    const d = DateTime.fromISO(value, { zone: timezone })
    return d.isValid ? d : null
  }

  switch (filter.operator) {
    case 'last': {
      const n = typeof filter.value === 'number' ? filter.value : parseInt(String(filter.value ?? ''), 10)
      if (!Number.isFinite(n) || n <= 0) return {}
      const unit = filter.unit ?? 'days'
      const back = unit === 'hours' ? { hours: n } : unit === 'weeks' ? { weeks: n } : unit === 'months' ? { months: n } : { days: n }
      return { startDate: iso(now.setZone(timezone).minus(back)) }
    }
    case 'on': {
      const d = day(filter.value)
      return d ? { startDate: iso(d.startOf('day')), endDate: iso(d.endOf('day')) } : {}
    }
    case 'before': {
      const d = day(filter.value)
      return d ? { endDate: iso(d.startOf('day').minus({ milliseconds: 1 })) } : {}
    }
    case 'after': {
      const d = day(filter.value)
      return d ? { startDate: iso(d.endOf('day').plus({ milliseconds: 1 })) } : {}
    }
    case 'between': {
      const a = day(filter.value)
      const b = day(filter.value2)
      if (!a || !b) return {}
      const [start, end] = a <= b ? [a, b] : [b, a]
      return { startDate: iso(start.startOf('day')), endDate: iso(end.endOf('day')) }
    }
    default:
      return {}
  }
}
