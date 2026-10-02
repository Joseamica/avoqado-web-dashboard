import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '@/api'
import { hybridBilling, parseFeatureGrid } from '@/services/hybridBilling.service'

vi.mock('@/api', () => ({ default: { post: vi.fn(), get: vi.fn() }, publicApi: { get: vi.fn() } }))

const offer = {
  publicationId: 'pub_1',
  campaignId: 'camp_1',
  name: 'Reservas',
  kind: 'FEATURES',
  planTier: null,
  price: 129,
  renewal: 'SAME_PRICE',
  renewalPrice: null,
  promotionCycles: null,
  includedFeatureCodes: ['RESERVATIONS'],
}
const grid = {
  catalogVersion: 'v1',
  purchasesEnabled: true,
  plans: { PRO: null, PREMIUM: null },
  entries: [
    {
      id: 'RESERVATIONS',
      featureCode: 'RESERVATIONS',
      names: { es: 'Reservas', en: 'Reservations', fr: 'Réservations' },
      description: 'Agenda',
      category: 'team',
      minimumTier: 'PRO',
      offering: 'CONFIGURABLE',
      access: { source: 'NONE', contractId: null, paidThrough: null, cancelAt: null },
      offer,
    },
  ],
}

beforeEach(() => {
  vi.mocked(api.get).mockResolvedValue({ data: { data: grid } } as never)
  vi.mocked(api.post).mockResolvedValue({ data: { data: {} } } as never)
})

describe('feature grid and hybrid writes', () => {
  it('reads and validates the feature grid', async () => {
    await expect(hybridBilling.featureGrid('venue')).resolves.toEqual(grid)
    expect(api.get).toHaveBeenCalledWith('/api/v1/dashboard/venues/venue/hybrid-billing/feature-grid')
  })

  it('keeps the list price, the list alternative and the plan lists (fields a server before 2026-10 does not send)', () => {
    const list = { ...offer, publicationId: 'pub_list', price: 159, listPrice: 159 }
    const withLists = {
      ...grid,
      planListOffers: { PRO: { ...offer, kind: 'PLAN', planTier: 'PRO', price: 1158.84, listPrice: 1158.84 }, PREMIUM: null },
      entries: [{ ...grid.entries[0], offer: { ...offer, listPrice: 159 }, listOffer: list }],
    }
    expect(parseFeatureGrid(withLists)).toEqual(withLists)
    expect(parseFeatureGrid(grid)).toEqual(grid)
  })

  it('rejects a grid this client does not understand', () => {
    expect(() => parseFeatureGrid({ ...grid, entries: [{ ...grid.entries[0], category: 'magic' }] })).toThrow()
  })

  it('a list price is a bounded amount like the price: never fractions of a cent or out of range', () => {
    const withList = (listPrice: number) => ({ ...grid, entries: [{ ...grid.entries[0], offer: { ...offer, listPrice } }] })
    expect(() => parseFeatureGrid(withList(159.999))).toThrow()
    expect(() => parseFeatureGrid(withList(-1))).toThrow()
    expect(() => parseFeatureGrid(withList(Number.POSITIVE_INFINITY))).toThrow()
    expect(parseFeatureGrid(withList(159.99))).toEqual(withList(159.99))
  })

  it('a contract cancellation carries the reason next to the observed revision', async () => {
    await hybridBilling.cancelContract('venue', 'hc_1', 3, { reason: 'TEMPORARY', comment: 'Cerramos agosto' })
    expect(api.post).toHaveBeenCalledWith('/api/v1/dashboard/venues/venue/hybrid-billing/contracts/hc_1/cancel', {
      expectedRevision: 3,
      reason: 'TEMPORARY',
      comment: 'Cerramos agosto',
    })
  })
})
