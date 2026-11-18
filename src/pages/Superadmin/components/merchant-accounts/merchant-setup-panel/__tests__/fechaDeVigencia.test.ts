import { afterEach, describe, expect, it, vi } from 'vitest'
import { fechaDeVigenciaOHoy } from '../fechaDeVigencia'

// hz:nube0000:naeba3d5: con «Vigente desde» vacío, la tarjeta de tarifa (y la de costo) mandaba la fecha en UTC. De 18:00 a
// 23:59 en México eso ya es MAÑANA: la tarjeta enseñaba «vigente desde mañana» y, al volver a guardar con esa fecha, el
// SERVIDOR chocaba con la versión que acababa de crear. «Vacío = hoy» es hoy en México.
describe('fechaDeVigenciaOHoy', () => {
  afterEach(() => vi.useRealTimers())

  it('🔴 vacía a las 20:00 de México (02:00 UTC del día siguiente) ⇒ la fecha de HOY en México', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-18T02:00:00Z')) // 17-nov 20:00 en CDMX
    expect(fechaDeVigenciaOHoy('')).toBe('2026-11-17')
  })

  it('🔴 vacía a las 23:59 de México ⇒ sigue siendo hoy', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-18T05:59:00Z')) // 17-nov 23:59 en CDMX
    expect(fechaDeVigenciaOHoy('')).toBe('2026-11-17')
  })

  it('control — vacía a las 00:30 de México ⇒ ya es el día nuevo', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-18T06:30:00Z')) // 18-nov 00:30 en CDMX
    expect(fechaDeVigenciaOHoy('')).toBe('2026-11-18')
  })

  it('control — una fecha escrita se manda tal cual', () => {
    expect(fechaDeVigenciaOHoy('2026-12-01')).toBe('2026-12-01')
  })
})
