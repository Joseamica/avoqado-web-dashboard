/**
 * Unit tests for the tier-rewards additions to referrals.service.ts:
 *   - updateConfig
 *   - fulfillGrant
 *
 * Each function must hit the correct URL/method with the right body.
 * The `api` axios instance is mocked so no network calls are made.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import referralsService from '@/services/referrals.service'

const mockPatch = vi.fn()
const mockPost = vi.fn()
vi.mock('@/api', () => ({
  default: {
    patch: (...args: unknown[]) => mockPatch(...args),
    post: (...args: unknown[]) => mockPost(...args),
  },
}))

const venueId = 'venue-1'

beforeEach(() => {
  mockPatch.mockReset()
  mockPost.mockReset()
})

describe('updateConfig()', () => {
  it('PATCHes /config with the given patch body, including tiers', async () => {
    const patch = {
      tiers: [{ tierLevel: 1 as const, rewardType: 'PERCENT_COUPON' as const, rewardPercent: 15 }],
    }
    mockPatch.mockResolvedValue({ data: { ok: true } })

    const result = await referralsService.updateConfig(venueId, patch)

    expect(mockPatch).toHaveBeenCalledWith(
      `/api/v1/dashboard/venues/${venueId}/referrals/config`,
      patch,
    )
    expect(result).toEqual({ ok: true })
  })
})

describe('fulfillGrant()', () => {
  it('POSTs to the fulfill endpoint for the given grant', async () => {
    const grant = { id: 'grant-1', status: 'MANUAL_FULFILLED' }
    mockPost.mockResolvedValue({ data: grant })

    const result = await referralsService.fulfillGrant(venueId, 'grant-1')

    expect(mockPost).toHaveBeenCalledWith(
      `/api/v1/dashboard/venues/${venueId}/referrals/grants/grant-1/fulfill`,
    )
    expect(result).toEqual(grant)
  })
})
