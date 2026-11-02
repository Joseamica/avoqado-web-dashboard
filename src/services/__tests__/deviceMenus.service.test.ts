import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGet = vi.fn()
const mockPut = vi.fn()
vi.mock('@/api', () => ({
  default: { get: (...a: unknown[]) => mockGet(...a), put: (...a: unknown[]) => mockPut(...a) },
}))

import { getDeviceMenuOptions, getDeviceMenus, setTerminalMenus } from '@/services/deviceMenus.service'

describe('deviceMenus.service', () => {
  beforeEach(() => vi.clearAllMocks())

  it('llama al GET con page y pageSize', async () => {
    mockGet.mockResolvedValue({ data: { terminals: [], total: 0 } })
    const r = await getDeviceMenus('v1', { page: 2, pageSize: 50 })
    expect(mockGet).toHaveBeenCalledWith('/api/v1/dashboard/venues/v1/tpvs/menus', { params: { page: 2, pageSize: 50 } })
    expect(r).toEqual({ terminals: [], total: 0 })
  })

  it('opciones: manda search, page y pageSize', async () => {
    mockGet.mockResolvedValue({ data: { menus: [] } })
    await getDeviceMenuOptions('v1', { search: 'caf', page: 1, pageSize: 100 })
    expect(mockGet).toHaveBeenCalledWith('/api/v1/dashboard/venues/v1/tpvs/menus/options', {
      params: { search: 'caf', page: 1, pageSize: 100 },
    })
  })

  it('PUT manda menuIds', async () => {
    mockPut.mockResolvedValue({ data: { id: 't1' } })
    await setTerminalMenus('v1', 't1', ['m1'])
    expect(mockPut).toHaveBeenCalledWith('/api/v1/dashboard/venues/v1/tpv/t1/menus', { menuIds: ['m1'] })
    await setTerminalMenus('v1', 't1', [])
    expect(mockPut).toHaveBeenLastCalledWith('/api/v1/dashboard/venues/v1/tpv/t1/menus', { menuIds: [] })
  })
})
