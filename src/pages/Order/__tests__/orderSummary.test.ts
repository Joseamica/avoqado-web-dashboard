/**
 * Pestañas y tarjetas de /orders a partir de los grupos del resumen del servidor
 * (2026-09-01). La semántica de las pestañas es la de siempre.
 */
import { describe, expect, it } from 'vitest'

import { orderCardsForTab, orderRowMatchesTab, orderTabCounts, type OrderSummaryGroup } from '../orderSummary'

const groups: OrderSummaryGroup[] = [
  { status: 'COMPLETED', count: 9, total: 798.49, tipAmount: 57.25 },
  { status: 'CONFIRMED', count: 2, total: 50, tipAmount: 0 },
  { status: 'READY', count: 1, total: 80, tipAmount: 8 },
  { status: 'PREPARING', count: 1, total: 10, tipAmount: 0 },
  { status: 'CANCELLED', count: 3, total: 33, tipAmount: 0 },
]

describe('orderRowMatchesTab', () => {
  it('activo = PENDING/CONFIRMED/PREPARING/READY; completado; cancelado; "all" acepta todo', () => {
    expect(orderRowMatchesTab({ status: 'READY' }, 'active')).toBe(true)
    expect(orderRowMatchesTab({ status: 'COMPLETED' }, 'active')).toBe(false)
    expect(orderRowMatchesTab({ status: 'COMPLETED' }, 'completed')).toBe(true)
    expect(orderRowMatchesTab({ status: 'CANCELLED' }, 'cancelled')).toBe(true)
    expect(orderRowMatchesTab({ status: 'DELETED' }, 'all')).toBe(true)
    expect(orderRowMatchesTab({ status: 'COMPLETED' }, 'inexistente')).toBe(false)
  })
})

describe('orderTabCounts', () => {
  it('suma los grupos por pestaña', () => {
    expect(orderTabCounts(groups)).toEqual({ all: 16, active: 4, completed: 9, cancelled: 3 })
  })
  it('sin datos: ceros', () => {
    expect(orderTabCounts(undefined)).toEqual({ all: 0, active: 0, completed: 0, cancelled: 0 })
  })
})

describe('orderCardsForTab', () => {
  it('"todos": conteo, total y ticket promedio', () => {
    const c = orderCardsForTab(groups, 'all')
    expect(c.count).toBe(16)
    expect(c.total).toBeCloseTo(971.49, 2)
    expect(c.avgTicket).toBeCloseTo(971.49 / 16, 6)
  })
  it('"activos" y "completados"', () => {
    expect(orderCardsForTab(groups, 'active')).toEqual({ count: 4, total: 140, avgTicket: 35 })
    const c = orderCardsForTab(groups, 'completed')
    expect(c.count).toBe(9)
    expect(c.avgTicket).toBeCloseTo(798.49 / 9, 6)
  })
  it('sin datos: el promedio es 0, no NaN', () => {
    expect(orderCardsForTab([], 'all')).toEqual({ count: 0, total: 0, avgTicket: 0 })
  })
})
