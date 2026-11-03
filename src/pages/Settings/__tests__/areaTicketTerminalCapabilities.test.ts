import { describe, expect, it } from 'vitest'

import { cambioDeCapacidad, tieneEmitirYCobrar } from '../areaTicketTerminalCapabilities'

// D5, opción A (founder, 2-nov-2026): un aparato emite vales O los cobra. Con las dos, su botón siempre emite y la casilla
// «Cobrar» no hacía nada. El panel apaga la otra al prender una y lo explica.
describe('cambioDeCapacidad', () => {
  const caja = { canIssueAreaTickets: false, canCheckoutAreaTickets: true }
  const emisor = { canIssueAreaTickets: true, canCheckoutAreaTickets: false }

  it('prender «Emitir» en una caja apaga «Cobrar» en el mismo cambio', () => {
    expect(cambioDeCapacidad(caja, 'canIssueAreaTickets', true)).toEqual({
      input: { canIssueAreaTickets: true, canCheckoutAreaTickets: false },
      apagada: 'canCheckoutAreaTickets',
    })
  })

  it('prender «Cobrar» en un emisor apaga «Emitir»', () => {
    expect(cambioDeCapacidad(emisor, 'canCheckoutAreaTickets', true)).toEqual({
      input: { canCheckoutAreaTickets: true, canIssueAreaTickets: false },
      apagada: 'canIssueAreaTickets',
    })
  })

  it('apagar una casilla o tocar «Entregar» no toca las demás', () => {
    expect(cambioDeCapacidad(caja, 'canCheckoutAreaTickets', false)).toEqual({ input: { canCheckoutAreaTickets: false }, apagada: null })
    expect(cambioDeCapacidad(emisor, 'canDeliverAreaTickets', true)).toEqual({ input: { canDeliverAreaTickets: true }, apagada: null })
  })

  it('prender «Emitir» en un aparato sin nada no apaga nada', () => {
    expect(cambioDeCapacidad({ canIssueAreaTickets: false, canCheckoutAreaTickets: false }, 'canIssueAreaTickets', true)).toEqual({
      input: { canIssueAreaTickets: true },
      apagada: null,
    })
  })
})

describe('tieneEmitirYCobrar', () => {
  it('avisa sólo cuando el aparato ya tiene las dos', () => {
    expect(tieneEmitirYCobrar({ canIssueAreaTickets: true, canCheckoutAreaTickets: true })).toBe(true)
    expect(tieneEmitirYCobrar({ canIssueAreaTickets: true, canCheckoutAreaTickets: false })).toBe(false)
  })
})
