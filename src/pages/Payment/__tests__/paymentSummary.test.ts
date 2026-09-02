/**
 * Pestañas y tarjetas de /payments a partir de los grupos del resumen del servidor
 * (2026-09-01). Fija la semántica de las pestañas — incluida la corrección de
 * «Completados», que comparaba contra 'PAID' y siempre decía 0.
 */
import { describe, expect, it } from 'vitest'

import { paymentCardsForTab, paymentRowMatchesTab, paymentTabCounts, paymentTabOfRow, type PaymentSummaryGroup } from '../paymentSummary'

const groups: PaymentSummaryGroup[] = [
  { status: 'COMPLETED', type: 'REGULAR', count: 6, amount: 653.49, tipAmount: 55.25 },
  { status: 'COMPLETED', type: 'FAST', count: 2, amount: 100, tipAmount: 0 },
  { status: 'COMPLETED', type: 'REFUND', count: 1, amount: -50, tipAmount: 0 },
  { status: 'REFUNDED', type: 'REGULAR', count: 1, amount: 70, tipAmount: 0 },
  { status: 'PROCESSING', type: 'REGULAR', count: 1, amount: 20, tipAmount: 0 },
  { status: 'FAILED', type: 'REGULAR', count: 1, amount: 30, tipAmount: 0 },
]

describe('paymentTabOfRow — la semántica de las pestañas', () => {
  it('reembolsado = type REFUND o status REFUNDED (sin cambio)', () => {
    expect(paymentTabOfRow({ status: 'COMPLETED', type: 'REFUND' })).toBe('refunded')
    expect(paymentTabOfRow({ status: 'REFUNDED', type: 'REGULAR' })).toBe('refunded')
  })

  it('🔴 completado = status COMPLETED (el servidor NUNCA emite "PAID"; la pestaña decía 0)', () => {
    expect(paymentTabOfRow({ status: 'COMPLETED', type: 'REGULAR' })).toBe('completed')
    expect(paymentTabOfRow({ status: 'COMPLETED', type: 'FAST' })).toBe('completed')
    expect(paymentTabOfRow({ status: 'PAID', type: 'REGULAR' })).toBe('other')
  })

  it('pendiente = PENDING o PROCESSING; FAILED no cae en ninguna pestaña', () => {
    expect(paymentTabOfRow({ status: 'PROCESSING', type: 'REGULAR' })).toBe('pending')
    expect(paymentTabOfRow({ status: 'PENDING', type: null })).toBe('pending')
    expect(paymentTabOfRow({ status: 'FAILED', type: 'REGULAR' })).toBe('other')
  })

  it('paymentRowMatchesTab: "all" acepta todo, y una fila cargada usa la MISMA regla que el conteo', () => {
    expect(paymentRowMatchesTab({ status: 'FAILED' }, 'all')).toBe(true)
    expect(paymentRowMatchesTab({ status: 'COMPLETED', type: 'REFUND' }, 'completed')).toBe(false)
    expect(paymentRowMatchesTab({ status: 'COMPLETED', type: 'REFUND' }, 'refunded')).toBe(true)
  })
})

describe('paymentTabCounts', () => {
  it('suma los grupos por pestaña; "todos" cuenta también lo que no cae en ninguna (FAILED)', () => {
    expect(paymentTabCounts(groups)).toEqual({ all: 12, completed: 8, pending: 1, refunded: 2 })
  })

  it('sin datos todavía: ceros, no undefined (la pestaña pinta "0" mientras carga)', () => {
    expect(paymentTabCounts(undefined)).toEqual({ all: 0, completed: 0, pending: 0, refunded: 0 })
    expect(paymentTabCounts([])).toEqual({ all: 0, completed: 0, pending: 0, refunded: 0 })
  })
})

describe('paymentCardsForTab', () => {
  it('"todos": el reembolso con monto negativo se resta solo de lo cobrado y de las ventas netas', () => {
    const c = paymentCardsForTab(groups, 'all')
    expect(c.count).toBe(12)
    // 653.49 + 55.25 + 100 − 50 + 70 + 20 + 30 = 878.74
    expect(c.totalCollected).toBeCloseTo(878.74, 2)
    // 653.49 + 100 − 50 + 70 + 20 + 30 = 823.49
    expect(c.netSales).toBeCloseTo(823.49, 2)
  })

  it('"completados": sólo COMPLETED sin reembolsos', () => {
    const c = paymentCardsForTab(groups, 'completed')
    expect(c).toEqual({ count: 8, totalCollected: 808.74, netSales: 753.49 })
  })

  it('"reembolsados": moderno (−50) y legacy (70) juntos', () => {
    expect(paymentCardsForTab(groups, 'refunded')).toEqual({ count: 2, totalCollected: 20, netSales: 20 })
  })

  it('"pendientes" y sin datos', () => {
    expect(paymentCardsForTab(groups, 'pending')).toEqual({ count: 1, totalCollected: 20, netSales: 20 })
    expect(paymentCardsForTab(undefined, 'all')).toEqual({ count: 0, totalCollected: 0, netSales: 0 })
  })
})
