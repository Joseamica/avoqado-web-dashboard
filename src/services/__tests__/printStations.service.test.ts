import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api', () => ({ default: { get: vi.fn() } }))

import api from '@/api'
import { getPrintStationsConfig } from '../printStations.service'

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
