import { describe, expect, it } from 'vitest'
import { hoyEnSede } from '../hoyEnSede'

describe('hoyEnSede — el «hoy» del negocio, no el del navegador en UTC', () => {
  it('a las 22:30 de CDMX (04:30 UTC del día siguiente) sigue siendo hoy en la sede', () => {
    expect(hoyEnSede('America/Mexico_City', new Date('2026-10-03T04:30:00Z'))).toBe('2026-10-02')
  })
  it('a media mañana coincide con la fecha UTC', () => {
    expect(hoyEnSede('America/Mexico_City', new Date('2026-10-03T16:00:00Z'))).toBe('2026-10-03')
  })
  it('una zona inválida cae a CDMX en vez de reventar', () => {
    expect(hoyEnSede('No/Existe', new Date('2026-10-03T04:30:00Z'))).toBe('2026-10-02')
  })
})
