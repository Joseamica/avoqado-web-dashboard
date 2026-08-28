import { describe, expect, it } from 'vitest'
import { crossesMidnight, shiftWeek, shiftWeekOffset, weekStart } from '@/pages/Attendance/shiftWeek'

// 2026-08-27 es jueves · 2026-08-24 lunes · 2026-08-30 domingo
describe('shiftWeek', () => {
  it('la semana va de lunes a domingo y contiene la fecha ancla', () => {
    expect(shiftWeek('2026-08-27')).toEqual({ from: '2026-08-24', to: '2026-08-30', days: ['2026-08-24', '2026-08-25', '2026-08-26', '2026-08-27', '2026-08-28', '2026-08-29', '2026-08-30'] })
  })
  it('🔴 el domingo pertenece a la semana que EMPEZÓ el lunes anterior (no a la siguiente)', () => {
    expect(weekStart('2026-08-30')).toBe('2026-08-24')
  })
  it('un lunes es su propio inicio', () => {
    expect(weekStart('2026-08-24')).toBe('2026-08-24')
  })
  it('cruza de mes y de año sin Date con zona', () => {
    expect(shiftWeekOffset(shiftWeek('2026-12-31'), 1).from).toBe('2027-01-04')
    expect(shiftWeekOffset(shiftWeek('2026-08-27'), -1)).toMatchObject({ from: '2026-08-17', to: '2026-08-23' })
  })
  it('un turno que termina antes de empezar cruza la medianoche (misma regla que el servidor)', () => {
    expect(crossesMidnight('22:00', '06:00')).toBe(true)
    expect(crossesMidnight('09:00', '18:00')).toBe(false)
  })
})
