import { describe, expect, it } from 'vitest'
import { getTierForFeature, PLAN_TIERS } from '@/config/plan-catalog'

describe('PRODUCT_VARIANTS en el catálogo de planes (espejo del server: Pro y Premium)', () => {
  it('el tier más bajo que lo incluye es PRO', () => {
    expect(getTierForFeature('PRODUCT_VARIANTS')).toBe('PRO')
  })
  it('Gratis no lo incluye; aparece una sola vez', () => {
    const free = PLAN_TIERS.find(t => t.id === 'FREE')!
    expect(free.includes).not.toContain('PRODUCT_VARIANTS')
    expect(PLAN_TIERS.flatMap(t => t.includes).filter(c => c === 'PRODUCT_VARIANTS')).toHaveLength(1)
  })
})
