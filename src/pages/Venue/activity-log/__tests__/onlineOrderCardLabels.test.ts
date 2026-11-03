import { describe, expect, it } from 'vitest'
import es from '@/locales/es/organization.json'
import en from '@/locales/en/organization.json'
import { actionTone } from '../formatActivity'

type Bitacora = { activityLog: { actions: Record<string, string> } }

// Las 18 acciones de la tarjeta en línea (contrato del servidor, fase 2 de pedidos en línea).
const ALERTA = [
  'ONLINE_ORDER_CARD_CAPTURE_FAILED',
  'ONLINE_ORDER_CARD_CONFIRM_STUCK',
  'ONLINE_ORDER_CARD_CAPTURE_STUCK',
  'ONLINE_ORDER_CARD_RELEASE_STUCK',
  'ONLINE_ORDER_CARD_CAPTURED_OUTSIDE',
  'ONLINE_ORDER_CARD_DOUBLE_PAYMENT',
  'ONLINE_ORDER_CARD_REFUND_FAILED',
  'ONLINE_ORDER_CARD_REFUND_STUCK',
  'ONLINE_ORDER_CARD_REFUND_REVERSED',
  'ONLINE_ORDER_CARD_REFUND_STAMP_STUCK',
] as const
const NEUTRAS = ['ONLINE_ORDERING_CARD_TOGGLED', 'ONLINE_ORDER_CARD_AUTHORIZED', 'ONLINE_ORDER_CARD_CAPTURED', 'ONLINE_ORDER_CARD_RELEASED'] as const
// Las devoluciones se pintan como TODO reembolso de la bitácora (familia REFUND ⇒ «revisar»), igual que PAYMENT_REFUNDED.
const DEVOLUCIONES = [
  'ONLINE_ORDER_CARD_REFUNDED',
  'ONLINE_ORDER_CARD_REFUND_RESOLVED',
  'ONLINE_ORDER_CARD_REFUND_VIA_MCP',
  'ONLINE_ORDER_CARD_REFUND_RESOLVED_VIA_MCP',
] as const
const TODAS = [...ALERTA, ...NEUTRAS, ...DEVOLUCIONES]

describe('bitácora: tarjeta en línea de pedidos en línea', () => {
  it('son las 18 del contrato', () => {
    expect(new Set(TODAS).size).toBe(18)
  })

  for (const [lng, bundle] of [
    ['es', es],
    ['en', en],
  ] as const) {
    it(`${lng}: cada acción tiene su etiqueta`, () => {
      const { actions } = (bundle as unknown as Bitacora).activityLog
      for (const a of TODAS) expect(actions[a], a).toEqual(expect.stringMatching(/\S/))
    })
  }

  it('las etiquetas en español son las del contrato', () => {
    const { actions } = (es as unknown as Bitacora).activityLog
    expect(actions.ONLINE_ORDER_CARD_CAPTURED_OUTSIDE).toBe(
      'Tarjeta cobrada fuera de Avoqado (antes de ser pedido, o en un pedido rechazado/vencido/cancelado): devolverla',
    )
    expect(actions.ONLINE_ORDER_CARD_REFUND_REVERSED).toBe('La devolución falló después: devolver por otro medio')
  })

  it('🔴 atorado, fallido, revertido, cobrado fuera y cobro doble se pintan en alerta (nunca neutro ni verde)', () => {
    for (const a of ALERTA) expect(['attention', 'destructive'], a).toContain(actionTone(a))
  })

  it('prender/apagar, apartar, cobrar y liberar la tarjeta son neutros', () => {
    for (const a of NEUTRAS) expect(actionTone(a), a).toBe('neutral')
  })

  it('las devoluciones, como cualquier reembolso de la bitácora', () => {
    for (const a of DEVOLUCIONES) expect(actionTone(a), a).toBe(actionTone('PAYMENT_REFUNDED'))
  })
})
