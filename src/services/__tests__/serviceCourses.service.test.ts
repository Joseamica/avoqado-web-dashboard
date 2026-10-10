import { beforeEach, expect, it, vi } from 'vitest'
import api from '@/api'
import { getServiceCourses, saveServiceCourses } from '../serviceCourses.service'
vi.mock('@/api', () => ({ default: { get: vi.fn(), put: vi.fn() } }))
beforeEach(() => vi.clearAllMocks())
it('uses the versioned dashboard endpoint and unwraps the shared API envelope', async () => {
  vi.mocked(api.get).mockResolvedValue({ data: { success: true, data: { revision: 'o:1:v:0' } } })
  expect(await getServiceCourses({ kind: 'venue', id: 'v1' })).toEqual({ revision: 'o:1:v:0' })
  expect(api.get).toHaveBeenCalledWith('/api/v1/dashboard/venues/v1/service-courses')
})
it('restores inheritance only for the route-scoped venue and transports the original revision', async () => {
  vi.mocked(api.put).mockResolvedValue({ data: { success: true, data: { revision: 'o:1:v:2' } } })
  await saveServiceCourses({ kind: 'venue', id: 'v1' }, 'v:1', null)
  expect(api.put).toHaveBeenCalledWith('/api/v1/dashboard/venues/v1/service-courses', { expectedRevision: 'v:1', courses: null })
})
