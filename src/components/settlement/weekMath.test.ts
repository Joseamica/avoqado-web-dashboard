import { describe, expect, it } from 'vitest'
import { addWeeks, currentWeekStart, weekDays, weekStartOf } from './weekMath'

describe('weekStartOf', () => {
  it('returns the Monday of the week containing the date', () => {
    expect(weekStartOf('2026-07-08')).toBe('2026-07-06') // Wed → Mon
    expect(weekStartOf('2026-07-06')).toBe('2026-07-06') // Monday itself
    expect(weekStartOf('2026-07-12')).toBe('2026-07-06') // Sunday → same Monday
    expect(weekStartOf('2026-07-13')).toBe('2026-07-13') // next Monday
  })
})

describe('addWeeks', () => {
  it('shifts a week-start by whole weeks, across month boundaries', () => {
    expect(addWeeks('2026-07-06', -1)).toBe('2026-06-29')
    expect(addWeeks('2026-07-06', 1)).toBe('2026-07-13')
    expect(addWeeks('2026-07-06', 0)).toBe('2026-07-06')
  })
})

describe('weekDays', () => {
  it('returns the 7 Mon…Sun days', () => {
    expect(weekDays('2026-07-06')).toEqual(['2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09', '2026-07-10', '2026-07-11', '2026-07-12'])
  })
})

describe('currentWeekStart', () => {
  it('returns a Monday (its own week-start is itself)', () => {
    const ws = currentWeekStart('America/Mexico_City')
    expect(ws).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(weekStartOf(ws)).toBe(ws) // idempotent → it is a Monday
  })
})
