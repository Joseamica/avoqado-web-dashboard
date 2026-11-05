import { describe, expect, it } from 'vitest'
import type { FeatureGridOffer } from '@/services/hybridBilling.service'
import { esPrecioDeLista, sinIva } from '../sinIva'

const offer = (extra: Partial<FeatureGridOffer>): FeatureGridOffer => ({
  publicationId: 'p',
  campaignId: 'c',
  name: 'n',
  kind: 'FEATURES',
  planTier: null,
  price: 22,
  renewal: 'SAME_PRICE',
  renewalPrice: null,
  promotionCycles: null,
  includedFeatureCodes: [],
  ...extra,
})

describe('sinIva', () => {
  it.each([
    [1158.84, 999],
    [1970.84, 1699],
    [249, 214.66],
    [99, 85.34],
    [79, 68.1],
    [0, 0],
  ])('%s → %s', (conIva, esperado) => expect(sinIva(conIva)).toBe(esperado))
})

describe('esPrecioDeLista', () => {
  it('SAME_PRICE con lista igual', () => expect(esPrecioDeLista(offer({ listPrice: 22 }))).toBe(true))
  it('SAME_PRICE con lista mayor', () => expect(esPrecioDeLista(offer({ listPrice: 99 }))).toBe(false))
  it('REPRICE', () => expect(esPrecioDeLista(offer({ renewal: 'REPRICE', listPrice: 22 }))).toBe(false))
  it('END', () => expect(esPrecioDeLista(offer({ renewal: 'END', listPrice: 22 }))).toBe(false))
  it('sin listPrice (null o ausente)', () => {
    expect(esPrecioDeLista(offer({ listPrice: null }))).toBe(false)
    expect(esPrecioDeLista(offer({}))).toBe(false)
  })
})
