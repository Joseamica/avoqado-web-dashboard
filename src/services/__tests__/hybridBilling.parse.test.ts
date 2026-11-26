import { describe, expect, it } from 'vitest'
import { parseHybridOffer, parseHybridPurchase } from '@/services/hybridBilling.service'

const terms = {
  currency: 'MXN',
  interval: 'MONTHLY',
  price: 578.84,
  taxIncluded: true,
  promotionCycles: null,
  renewal: { kind: 'SAME_PRICE' },
}
const offer = {
  id: 'pub',
  name: 'Plan Básico',
  slug: 'plan-basico',
  definition: { schemaVersion: 1, kind: 'FEATURES', basicPlan: true, seatCap: 3, featureCodes: ['CFDI'], terms },
  includedFeatureCodes: ['CFDI'],
  purchaseAvailable: true,
  placesRemaining: null,
  endsAt: null,
}
describe('hybrid billing parsers', () => {
  it('accept the Plan Básico: a list offer with no seat cap and no end date', () => {
    expect(parseHybridOffer(offer)).toMatchObject({ slug: 'plan-basico', placesRemaining: null, endsAt: null })
  })
  it('keep the Plan Básico marker (definition.basicPlan): «Ver ofertas» recognises the Básico by it, not by its slug or name', () => {
    expect(parseHybridOffer(offer).definition).toMatchObject({ kind: 'FEATURES', basicPlan: true })
    const { basicPlan: _quitado, ...sinMarca } = offer.definition
    expect(parseHybridOffer({ ...offer, definition: sinMarca }).definition).not.toHaveProperty('basicPlan')
  })
  it('still validate a promotion’s places and end date', () => {
    expect(() => parseHybridOffer({ ...offer, placesRemaining: -1 })).toThrow()
    expect(() => parseHybridOffer({ ...offer, endsAt: 'mañana' })).toThrow()
    expect(parseHybridOffer({ ...offer, placesRemaining: 4, endsAt: '2030-01-01T00:00:00.000Z' })).toMatchObject({ placesRemaining: 4 })
  })
  it('keep the frozen card and its ending from the quote response', () => {
    const purchase = parseHybridPurchase({
      id: 'q',
      status: 'QUOTED',
      quoteHash: 'h',
      quoteExpiresAt: '2030-01-01T00:00:00.000Z',
      paymentExpiresAt: null,
      lastIssue: null,
      paymentCard: { last4: '4242', brand: 'visa' },
      quote: {
        schemaVersion: 1,
        lines: [{ publicationId: 'pub', name: 'Plan Básico', kind: 'FEATURES', featureCodes: ['CFDI'], terms }],
        total: '578.84',
        credit: '0.00',
        dueNow: '578.84',
        creditBalanceAfter: '0.00',
        existingBalance: '0.00',
        replaces: [],
        droppedFeatureCodes: [],
        featureCodes: ['CFDI'],
        paymentMethodId: 'pm_saved',
      },
    })
    expect(purchase.paymentCard).toEqual({ last4: '4242', brand: 'visa' })
    expect(purchase.quote.paymentMethodId).toBe('pm_saved')
  })
})
