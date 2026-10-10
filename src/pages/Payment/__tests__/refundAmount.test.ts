/**
 * El importe de un reembolso por artículo es EXACTAMENTE el que devolverá el servidor
 * (`getUnitRefundCents`, avoqado-server refund.dashboard.service.ts): reparte los centavos del
 * renglón entre sus piezas — $10 / 3 = [3.34, 3.33, 3.33] — y empieza en la pieza que sigue a
 * lo ya devuelto. Prorratear y redondear mostraba $3.33 donde el servidor devuelve $3.34
 * (auditoría de Codex, 29-sep-2026). Mismos casos que Android e iOS.
 */
import { describe, expect, it } from 'vitest'

import { lineRefundAmount, refundableItemsFromOrder } from '../refundAmount'

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

// Decisión A del founder (9-oct, IVA C2): la devolución por artículos devuelve lo COBRADO del renglón, no el bruto. El
// servidor manda `chargedTotal` por artículo y reparte ESOS centavos con el mismo `parteDeUnidades`.
describe('lineRefundAmount — devuelve lo COBRADO (chargedTotal) cuando el servidor lo manda', () => {
  // Bruto $12 (3 × $4) que cobró $10 tras su descuento.
  const cobrada = (priorRefundedQty = 0) => ({ total: 12, chargedTotal: 10, quantity: 3, priorRefundedQty })

  it('A total $100 que cobró $90 ⇒ $90', () => {
    expect(lineRefundAmount({ total: 100, chargedTotal: 90, quantity: 1 }, 1)).toBe(90)
  })

  it('cantidad 3 que cobró $10: 3.34 / 3.33 / 3.33, empezando en la pieza que sigue a lo ya devuelto', () => {
    expect(lineRefundAmount(cobrada(0), 1)).toBe(3.34)
    expect(lineRefundAmount(cobrada(1), 1)).toBe(3.33)
    expect(lineRefundAmount(cobrada(2), 1)).toBe(3.33)
  })

  it('encadenadas (1 y luego 2) suman exactamente lo cobrado; la línea completa es lo cobrado', () => {
    expect(lineRefundAmount(cobrada(1), 2)).toBe(6.66)
    expect(lineRefundAmount(cobrada(0), 1) + lineRefundAmount(cobrada(1), 2)).toBeCloseTo(10, 10)
    expect(lineRefundAmount(cobrada(), 3)).toBe(10)
  })

  it('cortesía: cobró $0 ⇒ $0, no el bruto', () => {
    expect(lineRefundAmount({ total: 50, chargedTotal: 0, quantity: 1 }, 1)).toBe(0)
  })

  it('control — sin el campo (omitido o null) ⇒ el total de siempre', () => {
    expect(lineRefundAmount({ total: 100, quantity: 1 }, 1)).toBe(100)
    expect(lineRefundAmount({ total: 100, chargedTotal: null, quantity: 1 }, 1)).toBe(100)
  })
})

describe('refundableItemsFromOrder — renglones del detalle del cobro para la hoja', () => {
  const pan = { id: 'oi1', productId: 'p1', productName: 'Pan', quantity: 1, unitPrice: '100.00', total: '100.00' }

  it('pasa chargedTotal del artículo (número, o texto decimal)', () => {
    const [a, b] = refundableItemsFromOrder(
      [
        { ...pan, chargedTotal: 90 },
        { ...pan, id: 'oi2', chargedTotal: '58.50' },
      ],
      [],
    )
    expect(a.chargedTotal).toBe(90)
    expect(b.chargedTotal).toBe(58.5)
    expect(lineRefundAmount(a, 1)).toBe(90)
  })

  it('cortesía: chargedTotal 0 se conserva como 0 (no cae al bruto)', () => {
    const [a] = refundableItemsFromOrder([{ ...pan, chargedTotal: 0 }], [])
    expect(a.chargedTotal).toBe(0)
    expect(lineRefundAmount(a, 1)).toBe(0)
  })

  it('control — sin el campo, null, vacío o no numérico ⇒ sin chargedTotal (nunca 0) y la hoja usa el total', () => {
    for (const extra of [{}, { chargedTotal: null }, { chargedTotal: 'n/a' }, { chargedTotal: '' }]) {
      const [a] = refundableItemsFromOrder([{ ...pan, ...extra }], [])
      expect(a.chargedTotal ?? null).toBeNull()
      expect(lineRefundAmount(a, 1)).toBe(100)
    }
  })

  it('control — suma lo ya devuelto del renglón en los reembolsos previos', () => {
    const refunds = [
      { processorData: { refundedItems: [{ orderItemId: 'oi1', quantity: 1, amount: 3.34 }] } },
      {
        processorData: {
          refundedItems: [
            { orderItemId: 'oi1', quantity: 1, amount: 3.33 },
            { orderItemId: 'x', quantity: 9, amount: 9 },
          ],
        },
      },
      { processorData: null },
    ]
    const [a] = refundableItemsFromOrder([{ ...pan, quantity: 3, total: '10.00' }], refunds)
    expect(a.priorRefundedQty).toBe(2)
    expect(a.priorRefundedAmount).toBeCloseTo(6.67, 10)
    expect(lineRefundAmount(a, 1)).toBe(3.33)
  })
})
