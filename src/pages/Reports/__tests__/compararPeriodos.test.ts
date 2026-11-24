/**
 * Carril F2 (hz:fefa11b6:D7): cómo se dice la comparación. La ventana exacta de cada lado (con horas si alguno no es de días completos;
 * con desfase en un día con cambio de horario) y el color del cambio según el sentido del renglón.
 */
import { describe, expect, it } from 'vitest'
import { DateTime } from 'luxon'
import { sonDiasCompletos, tonoDelCambio, ventanaDelPeriodo } from '../compararPeriodos'

const MX = 'America/Mexico_City'
const HOY = new Date('2026-11-23T20:00:00.000Z')
const iso = (s: string, zona = MX) => DateTime.fromISO(s, { zone: zona }).toUTC().toISO()!

describe('tonoDelCambio', () => {
  it('🔴 más ventas es mejora; más devoluciones o comisiones es empeora; lo informativo no tiene color', () => {
    expect(tonoDelCambio('subeBien', 200)).toBe('mejora')
    expect(tonoDelCambio('subeBien', -50)).toBe('empeora')
    expect(tonoDelCambio('subeMal', 30)).toBe('empeora')
    // Un reverso de comisión (baja el costo) es mejora.
    expect(tonoDelCambio('subeMal', -50)).toBe('mejora')
    expect(tonoDelCambio('neutro', 999)).toBe('neutro')
    expect(tonoDelCambio('subeBien', 0)).toBe('igual')
  })
})

describe('ventanaDelPeriodo', () => {
  it('días completos: sólo las fechas; el año sólo si no es el de hoy', () => {
    const semana = { startDate: iso('2026-11-16T00:00'), endDate: iso('2026-11-22T23:59:59.999') }
    expect(sonDiasCompletos(semana, MX)).toBe(true)
    expect(ventanaDelPeriodo(semana, MX, false, 'es', HOY)).toBe('lun 16 nov – dom 22 nov')
    const anioPasado = { startDate: iso('2025-11-17T00:00'), endDate: iso('2025-11-23T23:59:59.999') }
    expect(ventanaDelPeriodo(anioPasado, MX, false, 'es', HOY)).toBe('lun 17 nov 2025 – dom 23 nov 2025')
  })

  it('🔴 a la mitad: fecha y horas exactas («hasta las 2:00 p. m.»)', () => {
    const hoy = { startDate: iso('2026-11-23T00:00'), endDate: iso('2026-11-23T14:00') }
    expect(sonDiasCompletos(hoy, MX)).toBe(false)
    expect(ventanaDelPeriodo(hoy, MX, true, 'es', HOY)).toMatch(/^lun 23 nov, 0?0:00 – 2:00\s?p\.\s?m\.$|^lun 23 nov, 0?0:00 – 14:00$/)
  })

  it('🔴 un atajo con horas (14:00 → 14:00) dice las horas de los dos días', () => {
    const r = { startDate: iso('2026-11-09T14:00'), endDate: iso('2026-11-23T14:00') }
    expect(ventanaDelPeriodo(r, MX, true, 'es', HOY)).toContain('lun 9 nov,')
    expect(ventanaDelPeriodo(r, MX, true, 'es', HOY)).toContain('lun 23 nov,')
  })

  it('🔴 Tijuana, la 1:30 repetida del 1-nov-2026: cada una con su desfase', () => {
    const tj = 'America/Tijuana'
    const primera = DateTime.fromISO('2026-11-01T08:30:00.000Z').setZone(tj) // 01:30 UTC−7
    const segunda = DateTime.fromISO('2026-11-01T09:30:00.000Z').setZone(tj) // 01:30 UTC−8
    const de = (fin: DateTime) => ventanaDelPeriodo({ startDate: iso('2026-11-01T00:00', tj), endDate: fin.toUTC().toISO()! }, tj, true, 'es', HOY)
    expect(de(primera)).toContain('(UTC−7)')
    expect(de(segunda)).toContain('(UTC−8)')
  })

  it('un día normal no lleva desfase', () => {
    expect(ventanaDelPeriodo({ startDate: iso('2026-11-23T00:00'), endDate: iso('2026-11-23T14:00') }, MX, true, 'es', HOY)).not.toContain('UTC')
  })
})
