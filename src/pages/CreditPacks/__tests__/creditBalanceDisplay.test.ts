/**
 * D679 · Paquete «Ilimitado». Por dentro un Ilimitado es un saldo de 99,999 con la marca `unlimited`; ninguna pantalla del
 * panel enseña ese número. Estas dos funciones deciden qué se pinta en compras, ficha de la clienta y movimientos.
 */
import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
import es from '@/locales/es/creditPacks.json'
import en from '@/locales/en/creditPacks.json'
import type { CreditItemBalance, CreditTransaction } from '@/types/creditPack'
import { describeBalance, describeMovement, faltasText } from '../creditBalanceDisplay'

const saldo = (over: Partial<CreditItemBalance>): CreditItemBalance => ({
  id: 'b1',
  productId: 'p1',
  product: { id: 'p1', name: 'Lagree', type: 'CLASS' },
  originalQuantity: 10,
  remainingQuantity: 10,
  ...over,
})

const movimiento = (over: Partial<CreditTransaction>): CreditTransaction => ({
  id: 't1',
  venueId: 'v1',
  customerId: 'c1',
  customer: { firstName: 'Ana' },
  type: 'REDEEM',
  quantity: -1,
  createdAt: '2026-11-22T10:00:00.000Z',
  ...over,
})

describe('describeBalance', () => {
  it('Ilimitado 99999/99996: usó 3, nunca el número', () => {
    const d = describeBalance(saldo({ unlimited: true, originalQuantity: 99999, remainingQuantity: 99996 }), 'ACTIVE')
    expect(d).toEqual({ kind: 'unlimited', used: 3 })
  })

  it('Ilimitado reembolsado: used null (no «usó 99,999»)', () => {
    const d = describeBalance(saldo({ unlimited: true, originalQuantity: 99999, remainingQuantity: 0 }), 'REFUNDED')
    expect(d).toEqual({ kind: 'unlimited', used: null })
  })

  it('Ilimitado vencido sigue diciendo cuánto usó', () => {
    const d = describeBalance(saldo({ unlimited: true, originalQuantity: 99999, remainingQuantity: 99990 }), 'EXPIRED')
    expect(d).toEqual({ kind: 'unlimited', used: 9 })
  })

  it('paquete normal: restante y total como hoy', () => {
    expect(describeBalance(saldo({ remainingQuantity: 4 }), 'ACTIVE')).toEqual({
      kind: 'count',
      remaining: 4,
      total: 10,
      adjusted: false,
    })
  })

  it('paquete normal ajustado por arriba del original: adjusted como hoy', () => {
    expect(describeBalance(saldo({ originalQuantity: 1, remainingQuantity: 6 }), 'ACTIVE')).toEqual({
      kind: 'count',
      remaining: 6,
      total: 1,
      adjusted: true,
    })
  })

  it('sin la llave (servidor viejo) es normal aunque tenga 99999', () => {
    expect(describeBalance(saldo({ originalQuantity: 99999, remainingQuantity: 99999 }), 'ACTIVE').kind).toBe('count')
  })
})

describe('describeMovement', () => {
  const ilimitado = { unlimited: true, product: { id: 'p1', name: 'Lagree' } }

  it('compra de un Ilimitado → «Ilimitado»', () => {
    expect(describeMovement(movimiento({ type: 'PURCHASE', quantity: 99999, creditItemBalance: ilimitado }))).toBe('label')
  })

  it('anulación de un Ilimitado (reembolso de la compra) → «Ilimitado anulado»', () => {
    expect(describeMovement(movimiento({ type: 'REFUND', quantity: -99997, creditItemBalance: ilimitado }))).toBe('voided')
  })

  it('canje −1 y devolución +1 de un Ilimitado: el número se pinta como hoy', () => {
    expect(describeMovement(movimiento({ type: 'REDEEM', quantity: -1, creditItemBalance: ilimitado }))).toBeNull()
    expect(describeMovement(movimiento({ type: 'REFUND', quantity: 1, creditItemBalance: ilimitado }))).toBeNull()
  })

  it('paquete normal: siempre el número', () => {
    expect(
      describeMovement(movimiento({ type: 'PURCHASE', quantity: 10, creditItemBalance: { product: { id: 'p1', name: 'Lagree' } } })),
    ).toBeNull()
    expect(describeMovement(movimiento({ type: 'PURCHASE', quantity: 10 }))).toBeNull()
  })
})

// D687: «1 cancelaciones tardías» → cada número con su singular o plural, con i18next real y las traducciones de verdad.
describe('faltasText (D687)', () => {
  it.each([
    ['es', { noLlego: 0, cancelTarde: 1 }, 'Faltas: 0 sin llegar · 1 cancelación tardía'],
    ['es', { noLlego: 1, cancelTarde: 2 }, 'Faltas: 1 sin llegar · 2 cancelaciones tardías'],
    ['es', { noLlego: 2, cancelTarde: 0 }, 'Faltas: 2 sin llegar · 0 cancelaciones tardías'],
    ['en', { noLlego: 1, cancelTarde: 1 }, 'Missed: 1 no-show · 1 late cancellation'],
    ['en', { noLlego: 2, cancelTarde: 0 }, 'Missed: 2 no-shows · 0 late cancellations'],
  ] as const)('%s %o → «%s»', async (lng, faltas, esperado) => {
    const i18n = i18next.createInstance()
    await i18n.init({ lng, resources: { es: { creditPacks: es }, en: { creditPacks: en } }, interpolation: { escapeValue: false } })
    expect(faltasText(i18n.getFixedT(lng, 'creditPacks'), faltas)).toBe(esperado)
  })
})
