import { describe, expect, it } from 'vitest'
import { depositoEsperado, diaDelNegocio, diaEnElFiltro, seQuedaConElFiltro, ventasSonDelFiltro } from '../auditoriaDePromotores'

const MX = 'America/Mexico_City'

describe('D6 · Auditoría de Promotores', () => {
  describe('con un filtro de fecha, ¿la fila se queda?', () => {
    it('con checadas en el rango, sí (como siempre)', () => {
      expect(seQuedaConElFiltro(1, 0, false)).toBe(true)
    })
    it('sin checadas pero con una devolución de su venta (ventas negativas) del periodo, sí: antes desaparecía', () => {
      expect(seQuedaConElFiltro(0, -25, true)).toBe(true)
    })
    it('sin checadas pero con ventas del periodo, sí', () => {
      expect(seQuedaConElFiltro(0, 120, true)).toBe(true)
    })
    it('Codex D6 r1: sin checadas y con ventas que NO son del periodo («antes de»/«después de»: el servidor responde con hoy), no', () => {
      expect(seQuedaConElFiltro(0, 100, false)).toBe(false)
    })
    it('sin checadas ni ventas, no', () => {
      expect(seQuedaConElFiltro(0, 0, true)).toBe(false)
    })
  })

  describe('¿las ventas que manda el servidor son exactamente las del filtro?', () => {
    it('sí con «el día» y «entre» (el servidor acota por los mismos días)', () => {
      expect(ventasSonDelFiltro('on')).toBe(true)
      expect(ventasSonDelFiltro('between')).toBe(true)
    })
    it('no con «antes de» / «después de» (una sola fecha: el servidor responde con hoy) ni sin filtro', () => {
      expect(ventasSonDelFiltro('before')).toBe(false)
      expect(ventasSonDelFiltro('after')).toBe(false)
      expect(ventasSonDelFiltro(undefined)).toBe(false)
    })
    it('Codex D6 r2: no con «últimos N» (el servidor manda días completos aunque el filtro sea «la última hora»)', () => {
      expect(ventasSonDelFiltro('last')).toBe(false)
    })
  })

  describe('el día de la checada, en la zona del negocio', () => {
    it('Codex D6 r1: una checada del 1-nov a las 09:00 en México es del 1-nov (antes, `new Date("2026-11-01")` la descartaba)', () => {
      const dia = diaDelNegocio('2026-11-01T15:00:00.000Z', MX)
      expect(dia).toBe('2026-11-01')
      expect(diaEnElFiltro(dia!, { operator: 'on', value: '2026-11-01' })).toBe(true)
    })
    it('una checada del 31-oct a las 22:00 en México es del 31-oct aunque en UTC ya sea 1-nov', () => {
      expect(diaDelNegocio('2026-11-01T04:00:00.000Z', MX)).toBe('2026-10-31')
    })
    it('entre, antes de y después de comparan días del negocio', () => {
      expect(diaEnElFiltro('2026-10-15', { operator: 'between', value: '2026-10-01', value2: '2026-10-31' })).toBe(true)
      expect(diaEnElFiltro('2026-10-31', { operator: 'between', value: '2026-10-01', value2: '2026-10-31' })).toBe(true)
      expect(diaEnElFiltro('2026-11-01', { operator: 'between', value: '2026-10-01', value2: '2026-10-31' })).toBe(false)
      expect(diaEnElFiltro('2026-09-30', { operator: 'before', value: '2026-10-01' })).toBe(true)
      expect(diaEnElFiltro('2026-10-01', { operator: 'before', value: '2026-10-01' })).toBe(false)
      expect(diaEnElFiltro('2026-10-02', { operator: 'after', value: '2026-10-01' })).toBe(true)
      expect(diaEnElFiltro('2026-10-01', { operator: 'after', value: '2026-10-01' })).toBe(false)
    })
    it('una fecha que no se entiende no cae en ningún día', () => {
      expect(diaDelNegocio('no-es-fecha', MX)).toBeNull()
    })
  })

  describe('el depósito que se espera', () => {
    it('es el EFECTIVO cobrado, no todas las ventas, con la foto real del comprobante', () => {
      expect(depositoEsperado({ cashSales: 165, depositPhotoUrl: 'https://storage/deposito.jpg' })).toEqual({
        esperado: 165,
        comprobante: 'https://storage/deposito.jpg',
      })
    })
    it('sin efectivo ni foto: $0 y sin comprobante (nunca una foto de muestra)', () => {
      expect(depositoEsperado({})).toEqual({ esperado: 0, comprobante: undefined })
      expect(depositoEsperado({ cashSales: null, depositPhotoUrl: null })).toEqual({ esperado: 0, comprobante: undefined })
    })
  })
})
