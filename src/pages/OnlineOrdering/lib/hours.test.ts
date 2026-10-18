import { describe, it, expect } from 'vitest'
import { defaultWeek, overnightNotes, validateWeek } from './hours'

const week = (friday: { open: string; close: string }[], enabled = true) => ({ ...defaultWeek(), friday: { enabled, ranges: friday } })

describe('hours', () => {
  it('semana por omisión es válida y sin madrugadas', () => {
    expect(validateWeek(defaultWeek())).toEqual([])
    expect(overnightNotes(defaultWeek())).toEqual([])
  })
  it('null (sin horario) no valida nada', () => {
    expect(validateWeek(null)).toEqual([])
    expect(overnightNotes(null)).toEqual([])
  })
  it('09:00–09:00 es error', () => {
    expect(validateWeek(week([{ open: '09:00', close: '09:00' }]))).toEqual(['sameTime'])
  })
  it('día abierto sin rangos y rango vacío son error; día cerrado sin rangos no', () => {
    expect(validateWeek(week([]))).toEqual(['dayNeedsRange'])
    expect(validateWeek(week([{ open: '', close: '' }]))).toEqual(['incompleteRange'])
    expect(validateWeek(week([], false))).toEqual([])
  })
  it('viernes 22:00–02:00 cierra el sábado a las 2:00', () => {
    const w = week([{ open: '22:00', close: '02:00' }])
    expect(validateWeek(w)).toEqual([])
    expect(overnightNotes(w)).toEqual([{ day: 'friday', nextDay: 'saturday', close: '2:00' }])
  })
  it('domingo en madrugada cierra el lunes', () => {
    const w = { ...defaultWeek(), sunday: { enabled: true, ranges: [{ open: '20:00', close: '01:30' }] } }
    expect(overnightNotes(w)).toEqual([{ day: 'sunday', nextDay: 'monday', close: '1:30' }])
  })
})
