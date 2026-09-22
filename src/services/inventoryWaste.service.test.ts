import { describe, expect, it, vi } from 'vitest'

const get = vi.fn()
vi.mock('@/api', () => ({ default: { get: (...a: unknown[]) => get(...a) } }))

import { wasteReportsApi } from './inventoryWaste.service'

const pagina = { items: [], total: 0, page: 1, pageSize: 50 }
// `mockReset: true` borra implementaciones antes de cada prueba: se fija dentro de cada una.
const responder = () => get.mockResolvedValue({ data: { success: true, data: pagina } })

describe('wasteReportsApi.list', () => {
  it('pide la ruta del dashboard y devuelve lo que viene DENTRO de { success, data }', async () => {
    responder()
    const r = await wasteReportsApi.list('v1', { page: 2, pageSize: 50 })
    expect(get).toHaveBeenCalledWith('/api/v1/dashboard/venues/v1/inventory/waste-reports', {
      params: { page: 2, pageSize: 50 },
      signal: undefined,
    })
    expect(r).toEqual(pagina)
  })

  it('recorta la página a 200 (tope del servidor) y la búsqueda a 200 caracteres', async () => {
    responder()
    await wasteReportsApi.list('v1', { page: 1, pageSize: 500, search: `  ${'a'.repeat(250)}  ` })
    const { params } = get.mock.calls[0][1]
    expect(params.pageSize).toBe(200)
    expect(params.search).toHaveLength(200)
  })

  it('una búsqueda en blanco no viaja; las fechas viajan tal cual (con zona)', async () => {
    responder()
    await wasteReportsApi.list('v1', {
      page: 1,
      pageSize: 50,
      search: '   ',
      startDate: '2026-09-01T00:00:00.000-06:00',
      endDate: '2026-09-01T23:59:59.999-06:00',
    })
    expect(get.mock.calls[0][1].params).toEqual({
      page: 1,
      pageSize: 50,
      startDate: '2026-09-01T00:00:00.000-06:00',
      endDate: '2026-09-01T23:59:59.999-06:00',
    })
  })
})
