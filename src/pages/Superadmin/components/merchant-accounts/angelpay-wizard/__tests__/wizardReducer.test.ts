import { describe, it, expect } from 'vitest'
import {
  wizardReducer,
  initialState,
  isPricingRequired,
  type AngelPayWizardState,
} from '../wizardReducer'

describe('wizardReducer', () => {
  it('initialState generates a fresh idempotencyKey each call', () => {
    expect(initialState().idempotencyKey).not.toBe(initialState().idempotencyKey)
  })

  it('SET_VENUE on a new venue resets every downstream step', () => {
    let s: AngelPayWizardState = initialState()
    s = wizardReducer(s, { type: 'SET_VENUE', venue: { id: 'v1', name: 'V1', slug: 'v1' } })
    s = wizardReducer(s, {
      type: 'SET_MERCHANT',
      merchant: { mode: 'create', externalMerchantId: '9814275', name: 'X', affiliation: 'A', displayName: 'X', idConfirmed: true },
    })
    s = wizardReducer(s, {
      type: 'SET_TERMINALS',
      terminals: { skipped: false, terminalIds: ['t1', 't2'] },
    })

    // Change venue → downstream wiped.
    s = wizardReducer(s, { type: 'SET_VENUE', venue: { id: 'v2', name: 'V2', slug: 'v2' } })
    expect(s.venue?.id).toBe('v2')
    expect(s.merchant.externalMerchantId).toBe('')
    expect(s.merchant.idConfirmed).toBe(false)
    expect(s.terminals.terminalIds).toEqual([])
  })

  it('SET_VENUE with the SAME venue keeps downstream state', () => {
    let s = initialState()
    s = wizardReducer(s, { type: 'SET_VENUE', venue: { id: 'v1', name: 'V1', slug: 'v1' } })
    s = wizardReducer(s, {
      type: 'SET_MERCHANT',
      merchant: { mode: 'create', externalMerchantId: '999', name: 'X', affiliation: 'A', displayName: 'X', idConfirmed: true },
    })
    s = wizardReducer(s, { type: 'SET_VENUE', venue: { id: 'v1', name: 'V1 renamed', slug: 'v1' } })
    expect(s.merchant.externalMerchantId).toBe('999') // preserved
  })

  it('switching the slot to replace mode forces pricing to be required', () => {
    let s = initialState()
    // Operator first marks pricing as skipped...
    s = wizardReducer(s, { type: 'SET_PRICING', pricing: { ...s.pricing, skipped: true } })
    expect(s.pricing.skipped).toBe(true)
    // ...then picks replace mode — pricing must become required again.
    s = wizardReducer(s, {
      type: 'SET_SLOT',
      slot: { accountType: 'PRIMARY', mode: 'replace', replacedAccountId: 'acc1' },
    })
    expect(s.pricing.skipped).toBe(false)
    expect(isPricingRequired(s)).toBe(true)
  })

  it('a non-invalidating slot change preserves already-typed pricing rates', () => {
    let s = initialState()
    s = wizardReducer(s, { type: 'SET_PRICING', pricing: { ...s.pricing, debitRate: 0.02, creditRate: 0.03 } })
    s = wizardReducer(s, { type: 'SET_SLOT', slot: { accountType: 'SECONDARY', mode: 'fill' } })
    expect(s.pricing.debitRate).toBe(0.02)
    expect(s.pricing.creditRate).toBe(0.03)
    expect(s.slot.accountType).toBe('SECONDARY')
  })

  it('replace-mode slot change also preserves typed pricing rates', () => {
    let s = initialState()
    s = wizardReducer(s, { type: 'SET_PRICING', pricing: { ...s.pricing, debitRate: 0.025 } })
    s = wizardReducer(s, {
      type: 'SET_SLOT',
      slot: { accountType: 'PRIMARY', mode: 'replace', replacedAccountId: 'acc1' },
    })
    expect(s.pricing.debitRate).toBe(0.025)
    expect(s.pricing.skipped).toBe(false)
  })

  it('RESET returns a clean state', () => {
    let s = initialState()
    s = wizardReducer(s, { type: 'SET_VENUE', venue: { id: 'v1', name: 'V1', slug: 'v1' } })
    s = wizardReducer(s, { type: 'RESET' })
    expect(s.venue).toBeNull()
  })
})
