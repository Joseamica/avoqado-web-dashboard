import { describe, it, expect } from 'vitest'
import { assemblePayload } from '../assemblePayload'
import { initialState } from '../useSetupReducer'

describe('assemblePayload', () => {
  it('directo (no aggregator) shape — happy path', () => {
    const s = initialState()
    s.venue = { id: 'v1', name: 'V1', slug: 'v1' }
    s.login = { mode: 'new', email: 'a@b.com', pin: '123456', environment: 'QA' }
    s.merchant = {
      mode: 'create',
      externalMerchantId: '9814275',
      name: 'X',
      affiliation: 'A',
      displayName: 'X',
      idConfirmed: true,
    }
    s.slot = { accountType: 'PRIMARY', mode: 'fill' }
    s.cost = { ...s.cost, debitRate: 0.015, creditRate: 0.02, amexRate: 0.035, internationalRate: 0.038, effectiveFrom: '2026-05-23' }
    s.pricing = { ...s.pricing, debitRate: 0.03, creditRate: 0.04, amexRate: 0.05, internationalRate: 0.06, effectiveFrom: '2026-05-23' }
    const payload = assemblePayload(s)
    expect(payload.venueId).toBe('v1')
    expect(payload.login).toEqual({ mode: 'new', email: 'a@b.com', pin: '123456', environment: 'QA' })
    expect(payload.merchant.mode).toBe('create')
    expect(payload.cost?.debitRate).toBe(0.015)
    expect(payload.settlement?.settlementDaysByCard).toEqual({ DEBIT: 1, CREDIT: 1, AMEX: 3, INTERNATIONAL: 3 })
    expect(payload.idempotencyKey).toBe(s.idempotencyKey)
  })

  it('skipped cards yield undefined in payload', () => {
    const s = initialState()
    s.venue = { id: 'v1', name: 'V1', slug: 'v1' }
    // Login + merchant required by the mapper (it throws on empty). Cards we
    // explicitly want to test as "skipped" are: terminals, cost, pricing,
    // settlement, revenueShare.
    s.login = { mode: 'new', email: 'a@b.com', pin: '123456', environment: 'QA' }
    s.merchant = { ...s.merchant, mode: 'existing', existingMerchantId: 'm1' }
    s.slot = { accountType: 'PRIMARY', mode: 'fill' }
    s.terminals.skipped = true
    s.cost.skipped = true
    s.pricing.skipped = true
    s.settlement.skipped = true
    const payload = assemblePayload(s)
    expect(payload.terminalIds).toBeUndefined()
    expect(payload.cost).toBeUndefined()
    expect(payload.pricing).toBeUndefined()
    expect(payload.settlement).toBeUndefined()
    expect(payload.aggregatorId).toBeUndefined()
  })

  it('throws when venue is missing', () => {
    const s = initialState()
    // No venue set
    expect(() => assemblePayload(s)).toThrow(/venue/i)
  })
})
