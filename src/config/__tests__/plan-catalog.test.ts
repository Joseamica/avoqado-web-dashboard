// src/config/__tests__/plan-catalog.test.ts
import { describe, it, expect } from 'vitest'
import { PLAN_TIERS, getTierForFeature, TIER_ORDER } from '../plan-catalog'
import billingEn from '@/locales/en/billing.json'
import billingEs from '@/locales/es/billing.json'
import billingFr from '@/locales/fr/billing.json'

describe('plan-catalog', () => {
  it('defines exactly the four tiers in ascending order', () => {
    expect(PLAN_TIERS.map(t => t.id)).toEqual(['FREE', 'PRO', 'PREMIUM', 'ENTERPRISE'])
    expect(TIER_ORDER).toEqual(['FREE', 'PRO', 'PREMIUM', 'ENTERPRISE'])
  })

  it('maps a feature to the lowest tier that includes it', () => {
    // CFDI is a Premium differentiator
    expect(getTierForFeature('CFDI')).toBe('PREMIUM')
    // Delivery channels are Premium
    expect(getTierForFeature('DELIVERY_CHANNELS')).toBe('PREMIUM')
    // Reports/AI are Pro
    expect(getTierForFeature('ADVANCED_REPORTS')).toBe('PRO')
    // Chatbot ships in Free (Beta)
    expect(getTierForFeature('CHATBOT')).toBe('FREE')
  })

  it('returns null for an unknown feature code', () => {
    expect(getTierForFeature('NOPE_XYZ')).toBeNull()
  })

  it('Premium is self-serve and priced at $1,699', () => {
    const premium = PLAN_TIERS.find(t => t.id === 'PREMIUM')!
    expect(premium.checkout).toBe('self_serve')
    expect(premium.priceMonthly).toBe(1699)
  })

  it('Premium card lists the delivery bullet (Uber Eats/Rappi/DiDi teaser)', () => {
    const premium = PLAN_TIERS.find(t => t.id === 'PREMIUM')!
    expect(premium.featureKeys).toContain('delivery')
  })

  it('plan.features.delivery i18n copy exists in en/es/fr billing locales', () => {
    expect(billingEn.plan.features.delivery).toBe('Delivery (Uber Eats, Rappi, DiDi)')
    expect(billingEs.plan.features.delivery).toBe('Delivery (Uber Eats, Rappi, DiDi)')
    expect((billingFr as { plan?: { features?: { delivery?: string } } }).plan?.features?.delivery).toBe(
      'Livraison (Uber Eats, Rappi, DiDi)',
    )
  })
})
