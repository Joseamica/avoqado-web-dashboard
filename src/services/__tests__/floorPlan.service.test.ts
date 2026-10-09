import { describe, expect, it, vi } from 'vitest'

const put = vi.fn()
vi.mock('@/api', () => ({ default: { put: (...args: unknown[]) => put(...args), get: vi.fn() } }))

import { publishFloorPlan } from '@/services/floorPlan.service'

describe('floorPlan.service', () => {
  it('el PUT del plano se rinde a los 45 s: un guardado colgado termina como error sin respuesta (se reintenta con el mismo folio)', async () => {
    put.mockResolvedValue({ data: { success: true, data: { fingerprint: 'bbbbbbbbbbbbbbbb' } } })
    const body = { saveId: 's1', baseFingerprint: 'aaaaaaaaaaaaaaaa', areas: [], tables: [], elements: [] }
    await expect(publishFloorPlan('v1', body)).resolves.toEqual({ fingerprint: 'bbbbbbbbbbbbbbbb' })
    expect(put).toHaveBeenCalledWith('/api/v1/dashboard/venues/v1/floor-plan', body, expect.objectContaining({ timeout: 45_000 }))
  })
})
