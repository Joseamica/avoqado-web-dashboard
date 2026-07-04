import { describe, it, expect } from 'vitest'
import { connectStrategyFor } from '../connectStrategies'

describe('connectStrategyFor', () => {
  it('DIRECT_CREDENTIAL usa el form de credenciales', () => {
    expect(connectStrategyFor('DIRECT_CREDENTIAL')).toBe('credential-form')
  })

  it('DIRECT_OAUTH y AGGREGATOR no están soportados todavía', () => {
    expect(connectStrategyFor('DIRECT_OAUTH')).toBe('not-implemented')
    expect(connectStrategyFor('AGGREGATOR')).toBe('not-implemented')
  })

  it('fail-closed: un connectionType inesperado (typo, enum nuevo, vacío) nunca cae en el form de credenciales', () => {
    expect(connectStrategyFor('')).toBe('not-implemented')
    expect(connectStrategyFor('direct_credential')).toBe('not-implemented') // typo de casing
    expect(connectStrategyFor('SOME_FUTURE_TYPE')).toBe('not-implemented')
    // El backend hoy garantiza el campo (NOT NULL), pero el switch debe degradar con gracia
    // si algún día llega undefined en vez de crashear.
    expect(connectStrategyFor(undefined as unknown as string)).toBe('not-implemented')
  })
})
