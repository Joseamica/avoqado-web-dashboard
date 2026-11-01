import { describe, expect, it } from 'vitest'
import { getTierForFeature, PLAN_TIERS } from '@/config/plan-catalog'

describe('DEVICE_MENUS en el catálogo de planes (espejo del server: Pro)', () => {
  it('el tier más bajo que lo incluye es PRO', () => {
    expect(getTierForFeature('DEVICE_MENUS')).toBe('PRO')
  })
  it('Gratis no lo incluye; aparece una sola vez', () => {
    const free = PLAN_TIERS.find(t => t.id === 'FREE')!
    expect(free.includes).not.toContain('DEVICE_MENUS')
    expect(PLAN_TIERS.flatMap(t => t.includes).filter(c => c === 'DEVICE_MENUS')).toHaveLength(1)
  })
})
