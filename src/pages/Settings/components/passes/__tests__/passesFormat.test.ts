import { describe, expect, it } from 'vitest'
import { hhmm, isValidSpots, readSpots, toStartMinute } from '../passesFormat'

describe('passesFormat', () => {
  it('hhmm: minutos locales → HH:mm; null → null (todo el día)', () => {
    expect(hhmm(540)).toBe('09:00')
    expect(hhmm(0)).toBe('00:00')
    expect(hhmm(1439)).toBe('23:59')
    expect(hhmm(null)).toBeNull()
  })

  it('toStartMinute: HH:mm → minutos; vacío o inválido → null', () => {
    expect(toStartMinute('09:00')).toBe(540)
    expect(toStartMinute('23:59')).toBe(1439)
    expect(toStartMinute('')).toBeNull()
    expect(toStartMinute('9:00')).toBeNull()
    expect(toStartMinute('24:00')).toBeNull()
    expect(toStartMinute('12:60')).toBeNull()
  })

  // 0 es un valor válido (ningún lugar), vacío no; el tope es el del server (500).
  it('isValidSpots: entero de 0 a 500', () => {
    expect(isValidSpots(0)).toBe(true)
    expect(isValidSpots(500)).toBe(true)
    expect(isValidSpots(null)).toBe(false)
    expect(isValidSpots(-1)).toBe(false)
    expect(isValidSpots(501)).toBe(false)
    expect(isValidSpots(1.5)).toBe(false)
  })

  // R2b-39: el campo es texto con teclado numérico y sólo acepta dígitos. Vacío (de verdad) = sin regla; lo demás se filtra.
  it('readSpots: sólo dígitos; vacío → null; «e», «-», «+», «.» se descartan', () => {
    expect(readSpots('')).toBeNull()
    expect(readSpots('e')).toBeNull()
    expect(readSpots('-')).toBeNull()
    expect(readSpots('0')).toBe(0)
    expect(readSpots('4e')).toBe(4)
    expect(readSpots('e2')).toBe(2)
    expect(readSpots('-3')).toBe(3)
    expect(readSpots('+7')).toBe(7)
    expect(readSpots('600')).toBe(600) // fuera de rango lo rechaza isValidSpots
  })
})
