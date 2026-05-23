import { describe, it, expect } from 'vitest'
import { initialState, setupReducer, isCardValid, isRequiredComplete } from '../useSetupReducer'
import type { SetupState } from '../types'
import { DRAFT_SCHEMA_VERSION } from '../types'

describe('initialState', () => {
  it('returns empty state with current schema version + unique idempotencyKey', () => {
    const a = initialState()
    const b = initialState()
    expect(a.schemaVersion).toBe(DRAFT_SCHEMA_VERSION)
    expect(a.venue.id).toBeNull()
    expect(a.login).toEqual({ mode: 'empty' })
    expect(a.merchant.mode).toBe('empty')
    expect(a.slot.mode).toBe('empty')
    expect(a.idempotencyKey).not.toBe(b.idempotencyKey)
  })
})

describe('setupReducer · SET_VENUE', () => {
  it('writes venue + resets downstream when venue changes', () => {
    let s = initialState()
    s = setupReducer(s, { type: 'SET_MERCHANT', merchant: { ...s.merchant, mode: 'create', externalMerchantId: '999', idConfirmed: true } })
    expect(s.merchant.externalMerchantId).toBe('999')
    s = setupReducer(s, { type: 'SET_VENUE', venue: { id: 'v1', name: 'V1', slug: 'v1' } })
    expect(s.venue.id).toBe('v1')
    expect(s.merchant.mode).toBe('empty')        // downstream reset
    expect(s.merchant.externalMerchantId).toBe('')
  })

  it('does NOT reset downstream when same venue is reselected', () => {
    let s = initialState()
    s = setupReducer(s, { type: 'SET_VENUE', venue: { id: 'v1', name: 'V1', slug: 'v1' } })
    s = setupReducer(s, { type: 'SET_MERCHANT', merchant: { ...s.merchant, mode: 'create', externalMerchantId: '999', idConfirmed: true } })
    s = setupReducer(s, { type: 'SET_VENUE', venue: { id: 'v1', name: 'V1 renamed', slug: 'v1' } })
    expect(s.merchant.externalMerchantId).toBe('999')
  })
})

describe('setupReducer · SET_LOGIN', () => {
  it('changing login resets the merchant choice (a merchant belongs to a login)', () => {
    let s = initialState()
    s = setupReducer(s, { type: 'SET_LOGIN', login: { mode: 'existing', angelpayUserAccountId: 'u1' } })
    s = setupReducer(s, { type: 'SET_MERCHANT', merchant: { ...s.merchant, mode: 'existing', existingMerchantId: 'm1' } })
    s = setupReducer(s, { type: 'SET_LOGIN', login: { mode: 'existing', angelpayUserAccountId: 'u2' } })
    expect(s.merchant.mode).toBe('empty')
  })
})

describe('setupReducer · SET_SLOT', () => {
  it('when slot moves to replace mode, pricing is forced un-skipped', () => {
    let s = initialState()
    s = setupReducer(s, { type: 'SET_PRICING', pricing: { ...s.pricing, skipped: true } })
    s = setupReducer(s, { type: 'SET_SLOT', slot: { accountType: 'PRIMARY', mode: 'replace', replacedAccountId: 'acc1' } })
    expect(s.pricing.skipped).toBe(false)
  })
})

describe('isCardValid', () => {
  it('venue card requires venue.id', () => {
    let s = initialState()
    expect(isCardValid(s, 'venue')).toBe(false)
    s = setupReducer(s, { type: 'SET_VENUE', venue: { id: 'v1', name: 'V1', slug: 'v1' } })
    expect(isCardValid(s, 'venue')).toBe(true)
  })

  it('login card requires email+pin in "new" mode', () => {
    let s = initialState()
    s = setupReducer(s, { type: 'SET_LOGIN', login: { mode: 'new', email: '', pin: '', environment: 'QA' } })
    expect(isCardValid(s, 'login')).toBe(false)
    s = setupReducer(s, { type: 'SET_LOGIN', login: { mode: 'new', email: 'a@b.com', pin: '123456', environment: 'QA' } })
    expect(isCardValid(s, 'login')).toBe(true)
  })

  it('slot card: empty invalid; fill OK at reducer level; replace requires replacedAccountId', () => {
    let s = initialState()
    expect(isCardValid(s, 'slot')).toBe(false)                            // empty
    s = setupReducer(s, { type: 'SET_SLOT', slot: { accountType: 'PRIMARY', mode: 'fill' } })
    expect(isCardValid(s, 'slot')).toBe(true)                             // fill OK at reducer level
    s = setupReducer(s, { type: 'SET_SLOT', slot: { accountType: 'PRIMARY', mode: 'replace' } })
    expect(isCardValid(s, 'slot')).toBe(false)                            // replace without replacedAccountId
  })

  it('cost card requires all 4 card rates set + not skipped', () => {
    let s = initialState()
    expect(isCardValid(s, 'cost')).toBe(false)
    s = setupReducer(s, { type: 'SET_COST', cost: { ...s.cost, debitRate: 0.015, creditRate: 0.02, amexRate: 0.035, internationalRate: 0.038 } })
    expect(isCardValid(s, 'cost')).toBe(true)
  })

  it('pricing card requires all 4 card rates set + not skipped', () => {
    let s = initialState()
    expect(isCardValid(s, 'pricing')).toBe(false)
    s = setupReducer(s, { type: 'SET_PRICING', pricing: { ...s.pricing, debitRate: 0.03, creditRate: 0.04, amexRate: 0.05, internationalRate: 0.06 } })
    expect(isCardValid(s, 'pricing')).toBe(true)
  })

  it('settlement card requires all 4 day values set + not skipped', () => {
    const s = initialState()
    // Default state has skipped=false and all 4 day values pre-populated, so it should be valid out of the box.
    expect(isCardValid(s, 'settlement')).toBe(true)
  })
})

describe('isRequiredComplete', () => {
  it('false until all 7 required cards are valid', () => {
    const s = initialState()
    expect(isRequiredComplete(s)).toBe(false)
  })
})

describe('LOAD_DRAFT', () => {
  it('replaces state with the loaded draft', () => {
    let s = initialState()
    const draft: SetupState = {
      ...initialState(),
      venue: { id: 'v1', name: 'V1', slug: 'v1' },
    }
    s = setupReducer(s, { type: 'LOAD_DRAFT', state: draft })
    expect(s.venue.id).toBe('v1')
  })
})

describe('RESET', () => {
  it('returns a fresh state with no remnants from before', () => {
    let s = initialState()
    s = setupReducer(s, { type: 'SET_VENUE', venue: { id: 'v1', name: 'V1', slug: 'v1' } })
    s = setupReducer(s, { type: 'RESET' })
    expect(s.venue.id).toBeNull()
  })
})
