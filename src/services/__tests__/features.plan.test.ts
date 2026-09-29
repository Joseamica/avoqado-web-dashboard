import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '@/api'
import { cancelVenuePlan, downgradeVenueToFree } from '@/services/features.service'

vi.mock('@/api', () => ({ default: { post: vi.fn(), get: vi.fn() } }))

beforeEach(() => {
  vi.mocked(api.post).mockResolvedValue({ data: { data: { state: 'canceling' } } } as never)
})

describe('plan cancel requests carry the owner reason', () => {
  it('cancel sends the reason, or an empty body', async () => {
    await cancelVenuePlan('v1', { reason: 'TOO_EXPENSIVE', comment: 'Caro' })
    expect(api.post).toHaveBeenCalledWith('/api/v1/dashboard/venues/v1/plan/cancel', { reason: 'TOO_EXPENSIVE', comment: 'Caro' })
    await cancelVenuePlan('v1')
    expect(api.post).toHaveBeenLastCalledWith('/api/v1/dashboard/venues/v1/plan/cancel', {})
  })

  it('downgrade keeps the selection and adds the reason', async () => {
    await downgradeVenueToFree('v1', ['sv1'], { reason: 'OTHER' })
    expect(api.post).toHaveBeenCalledWith('/api/v1/dashboard/venues/v1/plan/downgrade', { keepStaffVenueIds: ['sv1'], reason: 'OTHER' })
  })
})
