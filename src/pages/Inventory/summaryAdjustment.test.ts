import { describe, expect, it } from 'vitest'
import { buildSummaryAdjustment, isSummaryAmountValid } from './summaryAdjustment'

const k = () => 'k-1'

describe('buildSummaryAdjustment — el cuerpo de cada acción del «Resumen de existencias»', () => {
  it('🔴 «Pérdida» RESTA: viaja negativa (antes iba positiva y el servidor la SUMABA a la existencia)', () => {
    expect(buildSummaryAdjustment('LOSS', 3, {}, k)).toEqual({ type: 'LOSS', quantity: -3, reasonCode: 'MISSING', idempotencyKey: 'k-1' })
  })

  it('Daño y Robo son merma con su código y folio; no mandan costo ni texto en inglés', () => {
    expect(buildSummaryAdjustment('DAMAGE', 2, { unitCost: 10 }, k)).toEqual({
      type: 'LOSS',
      quantity: -2,
      reasonCode: 'DEFECTIVE',
      idempotencyKey: 'k-1',
    })
    expect(buildSummaryAdjustment('THEFT', 1, {}, k)).toEqual({ type: 'LOSS', quantity: -1, reasonCode: 'THEFT', idempotencyKey: 'k-1' })
  })

  it('cada merma estrena folio', () => {
    const a = buildSummaryAdjustment('DAMAGE', 1)
    const b = buildSummaryAdjustment('DAMAGE', 1)
    expect(a.idempotencyKey).not.toBe(b.idempotencyKey)
  })

  it('Recibir y Devolución siguen como hoy: compra positiva con su texto, costo y proveedor', () => {
    expect(buildSummaryAdjustment('RECEIVE', 5, { unitCost: 12, supplier: 'Acme' }, k)).toEqual({
      type: 'PURCHASE',
      quantity: 5,
      reason: 'Stock Received',
      unitCost: 12,
      supplier: 'Acme',
    })
    expect(buildSummaryAdjustment('RETURN', -4, { unitCost: 12 }, k)).toEqual({
      type: 'PURCHASE',
      quantity: 4,
      reason: 'Customer Return',
      unitCost: 12,
      supplier: undefined,
    })
  })

  it('Recuento sigue como hoy: manda la DIFERENCIA tal cual', () => {
    expect(buildSummaryAdjustment('COUNT', -2, { unitCost: 12 }, k)).toEqual({
      type: 'COUNT',
      quantity: -2,
      reason: 'Physical Count',
      unitCost: 12,
      supplier: undefined,
    })
  })
})

/**
 * La cantidad que el editor rápido acepta. Una merma de 0 no es merma: `-Math.abs(0)` viaja como 0,
 * el servidor no la manda al libro de merma (exige cantidad NEGATIVA) sino al ajuste viejo, que
 * escribe un movimiento de 0 sin folio — y cada reintento suma otra fila. Mismo defecto que cerró la
 * ronda 1 de la Task 3 en el diálogo de productos.
 */
describe('isSummaryAmountValid — qué cantidad deja guardar el editor rápido', () => {
  it('🔴 una merma de 0 (o vacía) NO se puede guardar', () => {
    for (const action of ['LOSS', 'DAMAGE', 'THEFT'] as const) {
      expect(isSummaryAmountValid(action, '0')).toBe(false)
      expect(isSummaryAmountValid(action, '')).toBe(false)
    }
  })

  it('una merma con cantidad sí se puede guardar', () => {
    expect(isSummaryAmountValid('LOSS', '2.5')).toBe(true)
    expect(isSummaryAmountValid('DAMAGE', '1')).toBe(true)
  })

  it('un RECUENTO de 0 se sigue pudiendo guardar (dejar la existencia en cero es válido), vacío no', () => {
    expect(isSummaryAmountValid('COUNT', '0')).toBe(true)
    expect(isSummaryAmountValid('COUNT', '')).toBe(false)
  })

  it('Recibir y Devolución siguen exigiendo cantidad, como hoy', () => {
    expect(isSummaryAmountValid('RECEIVE', '0')).toBe(false)
    expect(isSummaryAmountValid('RECEIVE', '3')).toBe(true)
    expect(isSummaryAmountValid('RETURN', '')).toBe(false)
  })
})
