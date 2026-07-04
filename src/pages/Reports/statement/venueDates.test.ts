import { describe, expect, it } from 'vitest'
import { formatBusinessDays, formatVenueDate, todayInVenue } from './venueDates'

describe('formatVenueDate', () => {
  it('never shifts the day across the UTC boundary (parses as local, not UTC)', () => {
    // 2026-07-03 must read as the 3rd, not the 2nd, even in a UTC-6 environment.
    const out = formatVenueDate('2026-07-03', 'en-US')
    expect(out).toContain('Jul')
    expect(out).toContain('3')
    expect(out).not.toContain('2,') // guards against the -1 day shift bug
  })

  it('respects locale (es renders Spanish month)', () => {
    expect(formatVenueDate('2026-07-03', 'es-MX').toLowerCase()).toContain('jul')
  })
})

describe('todayInVenue', () => {
  it('returns an ISO YYYY-MM-DD string', () => {
    expect(todayInVenue('America/Mexico_City')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('can differ from the browser day near midnight in a far timezone', () => {
    // Both are valid ISO dates; we only assert the format holds for a distant tz.
    expect(todayInVenue('Pacific/Kiritimati')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('formatBusinessDays', () => {
  const t = (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${opts.count}` : key)

  it('uses the singular key for 1 (or fewer) days', () => {
    expect(formatBusinessDays(1, t)).toBe('salesSummary.settlement.businessDay:1')
    expect(formatBusinessDays(0, t)).toBe('salesSummary.settlement.businessDay:0')
  })

  it('uses the plural key for 2+ days', () => {
    expect(formatBusinessDays(3, t)).toBe('salesSummary.settlement.businessDays:3')
  })
})
