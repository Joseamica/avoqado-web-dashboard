import { describe, expect, it } from 'vitest'

import { totalesDelRecibo } from '@/components/receipts/totalesDelRecibo'

/** IVA por producto, plan 7 (D3; r1 #8; A7-R6): el visor muestra lo de ESE cobro y siempre cuadra. */
const centavos = (n: number | undefined) => Math.round((n ?? 0) * 100)
const cuadra = (t: ReturnType<typeof totalesDelRecibo>) =>
  centavos(t.subtotal) - centavos(t.discount) + centavos(t.serviceCharge) + centavos(t.addedTax) + centavos(t.tip) === centavos(t.total)

describe('totalesDelRecibo', () => {
  it('un recibo nuevo: los totales congelados por el servidor, tal cual', () => {
    const t = { kind: 'COBRO' as const, desglosado: true, subtotal: 100, serviceCharge: 15, addedTax: 16, tip: 10, total: 141 }
    expect(totalesDelRecibo({ payment: { amount: 131, tipAmount: 10 } as never, ticketTotals: t })).toEqual(t)
  })

  it('🔴 A7-R6: un recibo nuevo con descuento: el subtotal BRUTO y el descuento congelados, tal cual, y cuadra', () => {
    const t = {
      kind: 'COBRO' as const,
      desglosado: true,
      subtotal: 100,
      discount: 10,
      serviceCharge: 15,
      addedTax: 16,
      tip: 10,
      total: 131,
    }
    const r = totalesDelRecibo({ payment: { amount: 121, tipAmount: 10 } as never, ticketTotals: t })
    expect(r).toEqual(t)
    expect(cuadra(r)).toBe(true)
  })

  it('🔴 un recibo viejo de un cobro PARCIAL de $50 (orden de $116): $50, sin IVA, sin cargo', () => {
    const t = totalesDelRecibo({ payment: { amount: 50, tipAmount: 0 } as never })
    expect(t).toEqual({ kind: 'COBRO', desglosado: false, subtotal: 50, serviceCharge: 0, addedTax: 0, tip: 0, total: 50 })
    expect(cuadra(t)).toBe(true)
  })

  it('🔴 un recibo viejo de una devolución con propina: magnitudes y DEVOLUCION', () => {
    const t = totalesDelRecibo({ payment: { amount: -116, tipAmount: -10 } as never })
    expect(t).toMatchObject({ kind: 'DEVOLUCION', subtotal: 116, tip: 10, total: 126 })
    expect(cuadra(t)).toBe(true)
  })

  it('🔴 r2 R2-6: un recibo viejo de una devolución de SÓLO propina ($0, −$10): DEVOLUCION por $10', () => {
    expect(totalesDelRecibo({ payment: { amount: 0, tipAmount: -10 } as never })).toMatchObject({
      kind: 'DEVOLUCION',
      subtotal: 0,
      tip: 10,
      total: 10,
    })
  })
})
