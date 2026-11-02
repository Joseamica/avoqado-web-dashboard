import { describe, expect, it } from 'vitest'
import { depositoEsperado, seQuedaConElFiltro } from '../auditoriaDePromotores'

describe('D6 · Auditoría de Promotores', () => {
  describe('con un filtro de fecha, ¿la fila se queda?', () => {
    it('con checadas en el rango, sí (como siempre)', () => {
      expect(seQuedaConElFiltro(1, 0)).toBe(true)
    })
    it('sin checadas pero con una devolución de su venta (ventas negativas), sí: antes desaparecía', () => {
      expect(seQuedaConElFiltro(0, -25)).toBe(true)
    })
    it('sin checadas pero con ventas, sí', () => {
      expect(seQuedaConElFiltro(0, 120)).toBe(true)
    })
    it('sin checadas ni ventas, no', () => {
      expect(seQuedaConElFiltro(0, 0)).toBe(false)
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
