import { describe, expect, it } from 'vitest'

import { actionOutcome } from './actionOutcome'

const http = (status: number, data: object) => ({ isAxiosError: true, response: { status, data } })

describe('actionOutcome', () => {
  it('409 ORDER_STATE_CHANGED ya en el estado pedido ⇒ success (el reintento de api.ts sobre un POST que sí llegó)', () => {
    expect(actionOutcome(http(409, { success: false, code: 'ORDER_STATE_CHANGED', status: 'ACCEPTED', error: 'x' }), 'ACCEPTED')).toBe(
      'success',
    )
  })

  it('409 ORDER_STATE_CHANGED en OTRO estado ⇒ gone', () => {
    expect(actionOutcome(http(409, { success: false, code: 'ORDER_STATE_CHANGED', status: 'EXPIRED', error: 'x' }), 'ACCEPTED')).toBe('gone')
  })

  it('404 ⇒ gone', () => {
    expect(actionOutcome(http(404, { success: false, code: 'ORDER_NOT_FOUND', error: 'x' }), 'READY')).toBe('gone')
  })

  it('PAYMENT_REQUIRED ⇒ paymentRequired', () => {
    expect(actionOutcome(http(409, { success: false, code: 'PAYMENT_REQUIRED', error: 'x' }), 'COMPLETED')).toBe('paymentRequired')
  })

  it('ORDER_HAS_PAYMENTS ⇒ hasPayments', () => {
    expect(actionOutcome(http(409, { success: false, code: 'ORDER_HAS_PAYMENTS', error: 'x' }), 'CANCELLED_BY_STAFF')).toBe('hasPayments')
  })

  it('sin respuesta ⇒ network', () => {
    expect(actionOutcome({ isAxiosError: true, message: 'Network Error', code: 'ERR_NETWORK' }, 'ACCEPTED')).toBe('network')
  })

  it('lo demás (ORDER_CANCEL_BLOCKED_BY_TERMINAL_CHARGE, 500) ⇒ error', () => {
    expect(actionOutcome(http(409, { message: 'Hay un cobro en la terminal', code: 'ORDER_CANCEL_BLOCKED_BY_TERMINAL_CHARGE' }), 'CANCELLED_BY_STAFF')).toBe(
      'error',
    )
    expect(actionOutcome(http(500, { message: 'boom' }), 'READY')).toBe('error')
  })
})
