import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  captureHybridOffer,
  readHybridOffer,
  saveHybridAttempt,
  readHybridAttempt,
  clearHybridAttempt,
  saveHybridDraft,
  readHybridDraft,
} from '../hybridIntent'
describe('hybrid purchase continuity', () => {
  beforeEach(() => {
    const data = new Map<string, string>()
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => data.set(key, value),
        removeItem: (key: string) => data.delete(key),
      },
    })
  })
  it('keeps a campaign across email/Google navigation without accepting its price', () => {
    captureHybridOffer('?hybridOffer=septiembre-flex', 1000)
    expect(readHybridOffer(2000)).toBe('septiembre-flex')
    captureHybridOffer('?hybridOffer=https://evil.test', 3000)
    expect(readHybridOffer(4000)).toBe('septiembre-flex')
    expect(readHybridOffer(1000 + 86400001)).toBeNull()
  })
  it('keeps one key per venue and prevents an old tab from clearing a newer attempt', () => {
    saveHybridAttempt('a', { id: 'purchase1', clientKey: 'stable-key' })
    expect(readHybridAttempt('a')).toEqual({ id: 'purchase1', clientKey: 'stable-key' })
    expect(readHybridAttempt('b')).toBeNull()
    clearHybridAttempt('a', 'old-purchase')
    expect(readHybridAttempt('a')?.id).toBe('purchase1')
    clearHybridAttempt('a', 'purchase1')
    expect(readHybridAttempt('a')).toBeNull()
  })
  it('restores only bounded selections for the same venue, never a stored price', () => {
    const draft = { lines: [{ id: 'pub', slug: 'flexible', codes: ['CFDI'] }], replace: ['sub'], drop: [] }
    saveHybridDraft('a', draft, 1000)
    expect(readHybridDraft('a', 2000)).toEqual(draft)
    expect(readHybridDraft('b', 2000)).toBeNull()
    expect(readHybridDraft('a', 86401001)).toBeNull()
    localStorage.setItem('avq_hybrid_draft_v1:a', JSON.stringify({ ...draft, lines: Array(9).fill(draft.lines[0]), savedAt: 1000 }))
    expect(readHybridDraft('a', 2000)).toBeNull()
  })
  it('fails before accepting money when the attempt cannot be persisted', () => {
    const spy = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => saveHybridAttempt('a', { id: 'p', clientKey: 'key' })).toThrow()
    spy.mockRestore()
  })
})
