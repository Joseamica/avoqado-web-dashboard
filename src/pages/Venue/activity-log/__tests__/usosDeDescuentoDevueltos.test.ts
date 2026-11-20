import { describe, expect, it } from 'vitest'
import es from '@/locales/es/organization.json'
import en from '@/locales/en/organization.json'
import { actionTone, toDetailRows } from '../formatActivity'

type Bitacora = { activityLog: { actions: Record<string, string>; detailKeys: Record<string, string> } }

// Contrato del SERVIDOR (hz:e82938e1:D24, `orderCancelGuard.ts` → `devolverUsosDeVentaAnuladaEnTx`): al anular una venta
// sin cobrar, si bajó el contador de usos de un descuento de cuenta, escribe sobre `Order`
// `ORDER_CANCEL_DISCOUNT_USES_RETURNED` con `data: { camino, usosDevueltos, porDescuento }`.
// Sin su texto, la bitácora la mostraba en inglés («Order cancel discount uses returned», hz:e82938e1:D27).
const ACCION = 'ORDER_CANCEL_DISCOUNT_USES_RETURNED'
const CAMPOS = ['camino', 'usosDevueltos', 'porDescuento'] as const

describe('bitácora: usos de descuento devueltos al cancelar la cuenta (D24)', () => {
  for (const [lng, bundle] of [
    ['es', es],
    ['en', en],
  ] as const) {
    const b = (bundle as unknown as Bitacora).activityLog
    it(`${lng}: la acción y sus campos tienen texto`, () => {
      expect(b.actions[ACCION]).toEqual(expect.stringMatching(/\S/))
      for (const c of CAMPOS) expect(b.detailKeys[c], c).toEqual(expect.stringMatching(/\S/))
    })
  }

  it('en español se lee como su hermana de lealtad', () => {
    const b = (es as unknown as Bitacora).activityLog
    expect(b.actions[ACCION]).toBe('Usos de descuento devueltos al cancelar la cuenta')
    expect(b.actions.ORDER_CANCEL_LOYALTY_RETURNED).toBe('Lealtad devuelta al cancelar la cuenta')
  })

  it('el detalle sale con etiquetas en español, no con el nombre crudo del campo', () => {
    const b = (es as unknown as Bitacora).activityLog
    const filas = toDetailRows(
      { camino: 'cancelOrder', usosDevueltos: 2, porDescuento: { cmdesc0000000000000000001: 2 } },
      key => b.detailKeys[key] ?? null,
      w => w,
    )
    expect(filas.map(f => f.label)).toEqual(['Desde', 'Usos devueltos', 'Descuentos'])
    expect(filas[1].value).toBe('2')
  })

  it('no se pinta de rojo: devolver un uso no es borrar nada', () => {
    expect(actionTone(ACCION)).toBe(actionTone('ORDER_CANCEL_LOYALTY_RETURNED'))
    expect(actionTone(ACCION)).toBe('neutral')
  })
})
