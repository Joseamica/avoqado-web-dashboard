import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { saveDraft, loadDraft, clearDraft, draftKey, findActiveDraft, isDraftNonEmpty } from '../useDraftStorage'
import { initialState } from '../useSetupReducer'
import { DRAFT_SCHEMA_VERSION } from '../types'

// The global setup (src/test/setup.ts) replaces window.localStorage with a vi.fn()
// stub that has no in-memory backing. Install a real Map-backed implementation on
// Storage.prototype for this suite so save/load round-trips work AND the
// "Storage.prototype.setItem throws" test below can override a real method.
const __store = new Map<string, string>()
const __originalProtoMethods = {
  getItem: Storage.prototype.getItem,
  setItem: Storage.prototype.setItem,
  removeItem: Storage.prototype.removeItem,
  clear: Storage.prototype.clear,
  key: Storage.prototype.key,
}
const __originalLengthDescriptor = Object.getOwnPropertyDescriptor(Storage.prototype, 'length')
beforeAll(() => {
  Storage.prototype.getItem = function (k: string) {
    return __store.has(k) ? (__store.get(k) as string) : null
  }
  Storage.prototype.setItem = function (k: string, v: string) {
    __store.set(k, String(v))
  }
  Storage.prototype.removeItem = function (k: string) {
    __store.delete(k)
  }
  Storage.prototype.clear = function () {
    __store.clear()
  }
  Storage.prototype.key = function (i: number) {
    return Array.from(__store.keys())[i] ?? null
  }
  Object.defineProperty(Storage.prototype, 'length', {
    configurable: true,
    get() {
      return __store.size
    },
  })
  // Install a Storage-prototype-linked object as window.localStorage so the
  // prototype methods above are reachable via `localStorage.xxx`.
  const fakeLocalStorage = Object.create(Storage.prototype) as Storage
  Object.defineProperty(window, 'localStorage', { value: fakeLocalStorage, configurable: true })
})

afterAll(() => {
  Storage.prototype.getItem = __originalProtoMethods.getItem
  Storage.prototype.setItem = __originalProtoMethods.setItem
  Storage.prototype.removeItem = __originalProtoMethods.removeItem
  Storage.prototype.clear = __originalProtoMethods.clear
  Storage.prototype.key = __originalProtoMethods.key
  if (__originalLengthDescriptor) {
    Object.defineProperty(Storage.prototype, 'length', __originalLengthDescriptor)
  }
  __store.clear()
})

describe('useDraftStorage · key', () => {
  it('builds a deterministic key from venueId + userAccountId', () => {
    expect(draftKey('v1', 'u1')).toBe('merchant-setup-draft:v1:u1')
    expect(draftKey('v1', null)).toBe('merchant-setup-draft:v1:new-login')
    expect(draftKey(null, null)).toBe('merchant-setup-draft:no-venue:new-login')
  })
})

describe('useDraftStorage · save/load round-trip', () => {
  beforeEach(() => localStorage.clear())

  it('saves and loads identical state', () => {
    const s = initialState()
    s.venue = { id: 'v1', name: 'V1', slug: 'v1' }
    saveDraft('v1', null, s)
    const loaded = loadDraft('v1', null)
    expect(loaded?.venue.id).toBe('v1')
  })

  it('returns null when no draft exists', () => {
    expect(loadDraft('v1', null)).toBeNull()
  })

  it('discards drafts with a different schemaVersion', () => {
    const s = { ...initialState(), schemaVersion: DRAFT_SCHEMA_VERSION + 99, venue: { id: 'v1', name: 'V1', slug: 'v1' } }
    localStorage.setItem(draftKey('v1', null), JSON.stringify(s))
    const loaded = loadDraft('v1', null)
    expect(loaded).toBeNull()
  })

  it('returns null on corrupt JSON without throwing', () => {
    localStorage.setItem(draftKey('v1', null), '{ not valid json')
    expect(() => loadDraft('v1', null)).not.toThrow()
    expect(loadDraft('v1', null)).toBeNull()
  })
})

describe('useDraftStorage · clear', () => {
  beforeEach(() => localStorage.clear())

  it('removes the entry', () => {
    saveDraft('v1', null, initialState())
    expect(loadDraft('v1', null)).not.toBeNull()
    clearDraft('v1', null)
    expect(loadDraft('v1', null)).toBeNull()
  })
})

describe('useDraftStorage · isDraftNonEmpty', () => {
  it('returns false for a default initialState (untouched)', () => {
    expect(isDraftNonEmpty(initialState())).toBe(false)
  })

  it('returns true when the venue has been picked', () => {
    const s = initialState()
    s.venue = { id: 'v1', name: 'V1', slug: 'v1' }
    expect(isDraftNonEmpty(s)).toBe(true)
  })

  it('returns true when revenueShare has been configured', () => {
    const s = initialState()
    s.revenueShare = { ...s.revenueShare, skipped: false }
    expect(isDraftNonEmpty(s)).toBe(true)
  })

  it('returns true when terminals have been picked', () => {
    const s = initialState()
    s.terminals = { skipped: false, terminalIds: ['t1', 't2'] }
    expect(isDraftNonEmpty(s)).toBe(true)
  })
})

describe('useDraftStorage · findActiveDraft', () => {
  beforeEach(() => localStorage.clear())

  it('returns null when no drafts exist in localStorage', () => {
    expect(findActiveDraft()).toBeNull()
  })

  it('returns null when only an EMPTY draft is stored', () => {
    saveDraft(null, null, initialState())
    expect(findActiveDraft()).toBeNull()
  })

  it('finds a stored draft with meaningful content', () => {
    const s = initialState()
    s.venue = { id: 'venue-42', name: 'Café 42', slug: 'cafe-42' }
    saveDraft('venue-42', null, s)
    const found = findActiveDraft()
    expect(found).not.toBeNull()
    expect(found!.key).toBe(draftKey('venue-42', null))
    expect(found!.state.venue.id).toBe('venue-42')
  })

  it('skips drafts with a stale schemaVersion', () => {
    const stale = { ...initialState(), schemaVersion: DRAFT_SCHEMA_VERSION + 99 }
    stale.venue = { id: 'v-old', name: 'old', slug: 'old' }
    localStorage.setItem(draftKey('v-old', null), JSON.stringify(stale))
    expect(findActiveDraft()).toBeNull()
  })

  it('ignores keys that are not merchant-setup drafts', () => {
    localStorage.setItem('unrelated-key', 'whatever')
    expect(findActiveDraft()).toBeNull()
  })
})

describe('useDraftStorage · localStorage unavailable', () => {
  it('save / load / clear silently no-op if localStorage throws', () => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = vi.fn(() => {
      throw new Error('QuotaExceededError')
    })
    try {
      expect(() => saveDraft('v1', null, initialState())).not.toThrow()
      expect(loadDraft('v1', null)).toBeNull()
      expect(() => clearDraft('v1', null)).not.toThrow()
    } finally {
      Storage.prototype.setItem = original
    }
  })
})
