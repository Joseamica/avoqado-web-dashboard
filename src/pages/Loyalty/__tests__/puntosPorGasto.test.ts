import { describe, expect, it } from 'vitest'

import { puntosPorGasto, tieneHastaDosDecimales } from '../puntosPorGasto'

describe('puntos por lo gastado (igual que el SERVIDOR: hacia abajo)', () => {
  it('0.01 por peso: 1 punto por cada $100, redondeado hacia abajo', () => {
    expect(puntosPorGasto(500, 0.01)).toBe(5)
    expect(puntosPorGasto(250, 0.01)).toBe(2) // 2.5 → 2
    expect(puntosPorGasto(99.99, 0.01)).toBe(0)
  })

  it('nunca redondea hacia arriba (antes la vista previa usaba Math.round)', () => {
    expect(puntosPorGasto(500, 0.33)).toBe(165)
    expect(puntosPorGasto(150, 0.5)).toBe(75)
    expect(puntosPorGasto(151, 0.5)).toBe(75) // 75.5 → 75
  })

  it('sin el error de los decimales en binario: 0.29 × $100 = 29, no 28', () => {
    expect(puntosPorGasto(100, 0.29)).toBe(29)
    expect(puntosPorGasto(500, 1)).toBe(500)
  })

  it('vacío, cero o negativo da 0', () => {
    expect(puntosPorGasto(500, Number.NaN)).toBe(0)
    expect(puntosPorGasto(500, 0)).toBe(0)
    expect(puntosPorGasto(0, 1)).toBe(0)
  })

  it('dos decimales como máximo (la columna del servidor)', () => {
    expect(tieneHastaDosDecimales(0.01)).toBe(true)
    expect(tieneHastaDosDecimales(1.5)).toBe(true)
    expect(tieneHastaDosDecimales(0.29)).toBe(true)
    expect(tieneHastaDosDecimales(0.015)).toBe(false)
  })
})
