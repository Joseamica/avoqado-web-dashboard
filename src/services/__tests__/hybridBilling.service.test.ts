import { describe, expect, it } from 'vitest'
import { parseHybridOffer, parseHybridPurchase, parseHybridContract } from '../hybridBilling.service'
import { parseVenuePlanTierInfo } from '../features.service'
const valid = {
  id: 'pub',
  name: 'Flexible',
  slug: 'flexible',
  includedFeatureCodes: [],
  purchaseAvailable: true,
  placesRemaining: 2,
  endsAt: '2030-01-01T00:00:00Z',
  definition: {
    schemaVersion: 1,
    kind: 'CHOICE_BUNDLE',
    choiceCount: 2,
    eligibleFeatureCodes: ['CFDI', 'LOYALTY_PROGRAM'],
    terms: {
      currency: 'MXN',
      interval: 'MONTHLY',
      price: 379.5,
      taxIncluded: true,
      promotionCycles: 4,
      renewal: { kind: 'REPRICE', price: 499.9 },
    },
  },
}
describe('supported published terms', () => {
  it('rejects unsupported or incomplete access observations instead of inferring a tier', () => {
    const access = {
      tier: 'FREE',
      grandfathered: false,
      exempt: false,
      accessSchemaVersion: 1,
      accessObservedAt: '2026-09-27T10:00:00Z',
      grantedFeatureCodes: ['CFDI'],
    }
    expect(parseVenuePlanTierInfo(access)).toEqual(access)
    expect(() => parseVenuePlanTierInfo({ ...access, accessSchemaVersion: 2 })).toThrow()
    expect(() => parseVenuePlanTierInfo({ ...access, grantedFeatureCodes: undefined })).toThrow()
    expect(parseVenuePlanTierInfo({ tier: 'PRO', grandfathered: false, exempt: false }).tier).toBe('PRO')
  })
  it('rejects a quote or contract this client cannot explain before allowing payment or management', () => {
    const contract = {
      id: 'contract',
      purchaseId: 'buy',
      name: 'Flexible',
      kind: 'CHOICE_BUNDLE',
      definition: valid.definition,
      featureCodes: ['CFDI'],
      startsAt: null,
      paidThrough: null,
      cancelAt: null,
      endedAt: null,
      pendingFeatureCodes: null,
      pendingEffectiveAt: null,
      revision: 1,
    }
    expect(parseHybridContract(contract).pendingFeatureCodes).toEqual([])
    const purchase = {
      id: 'buy',
      status: 'QUOTED',
      quoteHash: 'hash',
      quoteExpiresAt: '2030-01-01T00:00:00Z',
      paymentExpiresAt: null,
      lastIssue: null,
      quote: {
        schemaVersion: 1,
        lines: [{ publicationId: 'pub', name: 'Flexible', kind: 'CHOICE_BUNDLE', featureCodes: ['CFDI'], terms: valid.definition.terms }],
        total: '379.50',
        credit: '0.00',
        dueNow: '379.50',
        creditBalanceAfter: '0.00',
        existingBalance: '0.00',
        replaces: [],
        droppedFeatureCodes: [],
        featureCodes: ['CFDI'],
      },
    }
    expect(parseHybridPurchase(purchase)).toEqual(purchase)
    for (const status of ['PAID', 'DELIVERING', 'REQUIRES_REVIEW']) expect(parseHybridPurchase({ ...purchase, status }).status).toBe(status)
    expect(() => parseHybridPurchase({ ...purchase, quote: { ...purchase.quote, schemaVersion: 2 } })).toThrow()
    expect(() => parseHybridPurchase({ ...purchase, quote: { ...purchase.quote, dueNow: 'NaN' } })).toThrow()
    expect(() => parseHybridContract({ id: 'contract', definition: { ...valid.definition, schemaVersion: 2 } })).toThrow()
  })
  it('accepts a complete supported campaign and rejects unknown mechanics, versions and money', () => {
    expect(parseHybridOffer(valid)).toEqual(valid)
    for (const definition of [
      { ...valid.definition, kind: 'UNKNOWN' },
      { ...valid.definition, schemaVersion: 2 },
      { ...valid.definition, choiceCount: 3 },
      { ...valid.definition, terms: { ...valid.definition.terms, price: null } },
      { ...valid.definition, terms: { ...valid.definition.terms, renewal: { kind: 'UNKNOWN' } } },
    ])
      expect(() => parseHybridOffer({ ...valid, definition })).toThrow()
  })
})
