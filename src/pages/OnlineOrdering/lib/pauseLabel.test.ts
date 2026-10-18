import { describe, expect, it } from 'vitest'

import { pauseLabel } from './pauseLabel'

const fmt = (iso: string) => `T(${iso})`
const store = (over: Record<string, unknown> = {}) => ({ status: 'PAUSED', reason: 'MANUAL_PAUSE', pausedUntil: null, manualPause: false, ...over })

describe('pauseLabel', () => {
  it('sin pausa (o sin tienda) ⇒ null', () => {
    expect(pauseLabel(null, fmt)).toBeNull()
    expect(pauseLabel(store({ status: 'OPEN', reason: 'OPEN' }), fmt)).toBeNull()
    expect(pauseLabel(store({ status: 'DISABLED', reason: 'NOT_ENABLED', manualPause: true }), fmt)).toBeNull()
  })

  it('TOO_BUSY ⇒ muchos pedidos por aceptar (nunca «desde Configuración»)', () => {
    expect(pauseLabel(store({ reason: 'TOO_BUSY' }), fmt)).toEqual({ key: 'settings.status.pausedBusy' })
  })

  it('la pausa del gerente gana aunque traiga hora', () => {
    expect(pauseLabel(store({ manualPause: true, pausedUntil: '2026-10-17T18:30:00.000Z' }), fmt)).toEqual({
      key: 'settings.status.pausedManual',
    })
  })

  it('pausa con hora ⇒ «Pausada hasta HH:MM» en la zona del negocio', () => {
    expect(pauseLabel(store({ pausedUntil: '2026-10-17T18:30:00.000Z' }), fmt)).toEqual({
      key: 'settings.status.pausedUntil',
      params: { time: 'T(2026-10-17T18:30:00.000Z)' },
    })
  })

  it('pausada sin motivo conocido ⇒ null (la UI dice «Pausada»)', () => {
    expect(pauseLabel(store({ reason: 'ALGO_NUEVO' }), fmt)).toBeNull()
  })
})
