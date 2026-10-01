import { describe, expect, it } from 'vitest'
import { normalizeModifierSku } from '../modifierSku'

describe('normalizeModifierSku', () => {
  it('recorta y deja null lo vacío', () => {
    expect(normalizeModifierSku('  P000672 ')).toBe('P000672')
    expect(normalizeModifierSku('   ')).toBeNull()
    expect(normalizeModifierSku(undefined)).toBeNull()
    expect(normalizeModifierSku(null)).toBeNull()
  })
})
