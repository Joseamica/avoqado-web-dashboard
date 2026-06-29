/**
 * Unit tests for the two new admin bulk fns in simCustody.service.ts:
 *   - reassignSimsToPromoter
 *   - changeSimsCategory
 *
 * Each function must POST to the correct URL, forward the right body, and
 * include `x-venue-id` when a venueId is provided (and omit it when not).
 * The api module is mocked so no network calls are made.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { reassignSimsToPromoter, changeSimsCategory } from '@/services/simCustody.service'

// ---------------------------------------------------------------------------
// Mock the `api` axios instance
// ---------------------------------------------------------------------------
const mockPost = vi.fn()
vi.mock('@/api', () => ({
  default: { post: (...args: unknown[]) => mockPost(...args) },
}))

// Mock uuid so Idempotency-Key is predictable
vi.mock('uuid', () => ({ v4: () => 'test-idempotency-key' }))

const bulkOk = {
  summary: { total: 1, succeeded: 1, failed: 0 },
  results: [{ serialNumber: 'SIM001', status: 'ok' }],
}

beforeEach(() => {
  mockPost.mockResolvedValue({ data: bulkOk })
})

describe('reassignSimsToPromoter', () => {
  it('POSTs to the reassign-promoter endpoint with correct body', async () => {
    const result = await reassignSimsToPromoter('org-1', { toPromoterStaffId: 'promo-2', serialNumbers: ['SIM001'] })

    expect(mockPost).toHaveBeenCalledWith(
      '/api/v1/dashboard/organizations/org-1/sim-custody/reassign-promoter',
      { toPromoterStaffId: 'promo-2', serialNumbers: ['SIM001'] },
      expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': 'test-idempotency-key' }) }),
    )
    expect(result).toEqual(bulkOk)
  })

  it('includes x-venue-id header when venueId is provided', async () => {
    await reassignSimsToPromoter('org-1', { toPromoterStaffId: 'promo-2', serialNumbers: ['SIM001'] }, 'venue-abc')

    const call = mockPost.mock.calls[0]
    expect(call[2].headers['x-venue-id']).toBe('venue-abc')
  })

  it('omits x-venue-id header when venueId is not provided', async () => {
    await reassignSimsToPromoter('org-1', { toPromoterStaffId: 'promo-2', serialNumbers: ['SIM001'] })

    const call = mockPost.mock.calls[0]
    expect(call[2].headers['x-venue-id']).toBeUndefined()
  })
})

describe('changeSimsCategory', () => {
  it('POSTs to the change-category endpoint with correct body', async () => {
    const result = await changeSimsCategory('org-1', { categoryId: 'cat-xyz', serialNumbers: ['SIM001', 'SIM002'] })

    expect(mockPost).toHaveBeenCalledWith(
      '/api/v1/dashboard/organizations/org-1/sim-custody/change-category',
      { categoryId: 'cat-xyz', serialNumbers: ['SIM001', 'SIM002'] },
      expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': 'test-idempotency-key' }) }),
    )
    expect(result).toEqual(bulkOk)
  })

  it('includes x-venue-id header when venueId is provided', async () => {
    await changeSimsCategory('org-1', { categoryId: 'cat-xyz', serialNumbers: ['SIM001'] }, 'venue-abc')

    const call = mockPost.mock.calls[0]
    expect(call[2].headers['x-venue-id']).toBe('venue-abc')
  })

  it('omits x-venue-id header when venueId is not provided', async () => {
    await changeSimsCategory('org-1', { categoryId: 'cat-xyz', serialNumbers: ['SIM001'] })

    const call = mockPost.mock.calls[0]
    expect(call[2].headers['x-venue-id']).toBeUndefined()
  })
})
