import { describe, it, expect } from 'vitest'
import { decimalToPercent, percentToDecimal } from '../fees'

describe('fees', () => {
  it('decimalToPercent / percentToDecimal round-trip sin drift de punto flotante', () => {
    expect(decimalToPercent(0.015)).toBe(1.5)
    expect(decimalToPercent(0.0285)).toBe(2.85)
    expect(decimalToPercent(0.0115)).toBe(1.15)
    expect(percentToDecimal(1.5)).toBe(0.015)
    expect(percentToDecimal(2.85)).toBe(0.0285)
    expect(percentToDecimal(1.15)).toBe(0.0115)
    for (const d of [0.015, 0.018, 0.025, 0.028, 0.0042]) {
      expect(percentToDecimal(decimalToPercent(d))).toBe(d)
    }
  })

  it('decimalToPercent handles 0, null-ish and very small values', () => {
    expect(decimalToPercent(0)).toBe(0)
    expect(decimalToPercent(0.00001)).toBe(0.001)
  })
})
