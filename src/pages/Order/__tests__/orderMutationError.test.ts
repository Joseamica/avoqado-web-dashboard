import { describe, expect, it } from 'vitest'

import { describeOrderMutationError } from '../orderMutationError'

const t = (key: string) => `t:${key}`
const axiosError = (status: number, data: Record<string, unknown>) =>
  Object.assign(new Error(`Request failed with status code ${status}`), { response: { status, data } })

describe('describeOrderMutationError', () => {
  it('un cobro de terminal en curso muestra el texto propio traducido, no el genérico de axios', () => {
    const error = axiosError(409, {
      message: 'Hay un cobro en curso…',
      code: 'ORDER_CANCEL_BLOCKED_BY_TERMINAL_CHARGE',
      details: { requestId: 'r1' },
    })
    expect(describeOrderMutationError(error, t)).toBe('t:cancelBlockedByTerminalCharge')
  })

  it('cualquier otro rechazo muestra el motivo real del server (antes salía «Request failed with status code 400»)', () => {
    const error = axiosError(400, {
      message: 'Esta orden tiene pagos registrados. Reembolsa primero; una orden pagada no se puede eliminar.',
    })
    expect(describeOrderMutationError(error, t)).toBe(
      'Esta orden tiene pagos registrados. Reembolsa primero; una orden pagada no se puede eliminar.',
    )
  })

  it('sin respuesta del server cae al mensaje del error', () => {
    expect(describeOrderMutationError(new Error('Network Error'), t)).toBe('Network Error')
  })
})
