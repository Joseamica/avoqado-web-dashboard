import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api', () => ({ default: { get: vi.fn() } }))

import api from '@/api'
import { getPrintStationsConfig, getRouting } from '../printStations.service'

beforeEach(() => vi.mocked(api.get).mockReset())

describe('getPrintStationsConfig', () => {
  it('devuelve las estaciones y la puerta de lanzamiento de la pantalla', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, data: [{ id: 's1' }], kitchenDisplayOpenToClients: true } })
    await expect(getPrintStationsConfig('v1')).resolves.toEqual({ stations: [{ id: 's1' }], kitchenDisplayOpenToClients: true })
    expect(api.get).toHaveBeenCalledWith('/api/v1/dashboard/venues/v1/print-stations/')
  })

  it('un servidor anterior a la etapa 3 (sin el campo) se lee como puerta CERRADA', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, data: [] } })
    await expect(getPrintStationsConfig('v1')).resolves.toEqual({ stations: [], kitchenDisplayOpenToClients: false })
  })
})

describe('routing page contract', () => {
  it('sends section, page and filters without requesting the legacy catalog', async () => {
    const data = {
      categories: [],
      products: [],
      pagination: { page: 2, pageSize: 50, total: 0, totalPages: 0 },
      unroutedCategories: 0,
      hasDefault: false,
    }
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, data } })
    const query = { section: 'products' as const, page: 2, pageSize: 50, search: 'Café', categoryId: 'c1' }
    await expect(getRouting('v1', query)).resolves.toEqual(data)
    expect(api.get).toHaveBeenCalledWith('/api/v1/dashboard/venues/v1/print-stations/routing', { params: query })
  })
})
