/**
 * El importe de un reembolso por artículo es EXACTAMENTE el que devolverá el servidor
 * (`getUnitRefundCents`, avoqado-server refund.dashboard.service.ts): reparte los centavos del
 * renglón entre sus piezas — $10 / 3 = [3.34, 3.33, 3.33] — y empieza en la pieza que sigue a
 * lo ya devuelto. Prorratear y redondear mostraba $3.33 donde el servidor devuelve $3.34
 * (auditoría de Codex, 29-sep-2026). Mismos casos que Android e iOS.
 */
import { describe, expect, it } from 'vitest'

import { lineRefundAmount } from '../refundAmount'

const linea = (priorRefundedQty = 0) => ({ total: 10, quantity: 3, priorRefundedQty })

describe('lineRefundAmount — espejo del reparto de centavos del servidor', () => {
  it('la línea completa es el total exacto', () => {
    expect(lineRefundAmount(linea(), 3)).toBe(10)
  })

  it('la primera pieza lleva el centavo sobrante ($3.34, no $3.33)', () => {
    expect(lineRefundAmount(linea(), 1)).toBe(3.34)
  })

  it('dos piezas sin devoluciones previas', () => {
    expect(lineRefundAmount(linea(), 2)).toBe(6.67)
  })

  it('tras devolver una pieza, las dos que quedan son $6.66', () => {
    expect(lineRefundAmount(linea(1), 2)).toBe(6.66)
  })

  it('la última pieza tras dos devoluciones es $3.33', () => {
    expect(lineRefundAmount(linea(2), 1)).toBe(3.33)
  })

  it('las tres devoluciones de una en una suman el total', () => {
    expect(lineRefundAmount(linea(0), 1) + lineRefundAmount(linea(1), 1) + lineRefundAmount(linea(2), 1)).toBeCloseTo(10, 10)
  })

  it('una línea ya devuelta completa no suma', () => {
    expect(lineRefundAmount(linea(3), 1)).toBe(0)
  })
})
