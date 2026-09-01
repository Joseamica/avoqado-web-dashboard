import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getAllOrgStockItemsForExport,
  getOrgStockBulkGroups,
  getOrgStockCustody,
  getOrgStockItems,
  getOrgStockSummary,
  getStockMovements,
} from '@/services/stockDashboard.service'

const mockGet = vi.fn()
vi.mock('@/api', () => ({
  default: { get: (...args: unknown[]) => mockGet(...args) },
}))

beforeEach(() => {
  mockGet.mockReset()
  mockGet.mockResolvedValue({ data: { data: { items: [], pagination: {} } } })
})

describe('stock dashboard bounded endpoints', () => {
  it('consulta el resumen agregado sin pedir el overview legado', async () => {
    await getOrgStockSummary('org-1', {
      dateFrom: '2025-09-01T00:00:00.000Z',
      dateTo: '2026-09-01T23:59:59.999Z',
    })

    expect(mockGet).toHaveBeenCalledWith(
      '/api/v1/dashboard/organizations/org-1/stock-control/summary?dateFrom=2025-09-01T00%3A00%3A00.000Z&dateTo=2026-09-01T23%3A59%3A59.999Z',
    )
  })

  it('envía búsqueda, filtros y paginación al servidor', async () => {
    await getOrgStockItems('org-1', {
      page: 3,
      pageSize: 50,
      search: '895214',
      status: 'AVAILABLE',
      custodyState: 'PROMOTER_HELD',
      categoryId: 'cat-1',
      registeredFromVenueId: 'venue-1',
      dateFrom: '2025-09-01T00:00:00.000Z',
      dateTo: '2026-09-01T23:59:59.999Z',
    })

    expect(mockGet).toHaveBeenCalledWith(
      '/api/v1/dashboard/organizations/org-1/stock-control/items?page=3&pageSize=50&search=895214&status=AVAILABLE&custodyState=PROMOTER_HELD&categoryId=cat-1&registeredFromVenueId=venue-1&dateFrom=2025-09-01T00%3A00%3A00.000Z&dateTo=2026-09-01T23%3A59%3A59.999Z',
    )
  })

  it('pagina las cargas y busca ICCID del lado del servidor', async () => {
    await getOrgStockBulkGroups('org-1', {
      page: 2,
      pageSize: 20,
      search: '895214',
      categoryId: 'cat-1',
      registeredFromVenueId: 'venue-1',
    })

    expect(mockGet).toHaveBeenCalledWith(
      '/api/v1/dashboard/organizations/org-1/stock-control/bulk-groups?page=2&pageSize=20&search=895214&categoryId=cat-1&registeredFromVenueId=venue-1',
    )
  })

  it('pagina la custodia del actor y conserva filtros de tienda', async () => {
    await getOrgStockCustody('org-1', {
      venueId: 'venue-1',
      page: 2,
      pageSize: 50,
      search: '895214',
      filter: 'estancados',
      dateFrom: '2025-09-01T00:00:00.000Z',
      dateTo: '2026-09-01T23:59:59.999Z',
    })

    expect(mockGet).toHaveBeenCalledWith(
      '/api/v1/dashboard/organizations/org-1/stock-control/custody?venueId=venue-1&page=2&pageSize=50&search=895214&filter=estancados&dateFrom=2025-09-01T00%3A00%3A00.000Z&dateTo=2026-09-01T23%3A59%3A59.999Z',
    )
  })

  it('envía la página de movimientos sin aumentar el límite seguro', async () => {
    await getStockMovements('venue-1', { limit: 100, page: 3 })

    expect(mockGet).toHaveBeenCalledWith('/api/v1/dashboard/venues/venue-1/stock/movements', {
      params: { limit: 100, page: 3 },
    })
  })

  it('serializa varios estados de custodia para los selectores', async () => {
    await getOrgStockItems('org-1', {
      page: 1,
      pageSize: 100,
      custodyStates: ['PROMOTER_HELD', 'PROMOTER_PENDING'],
    })

    expect(mockGet).toHaveBeenCalledWith(
      '/api/v1/dashboard/organizations/org-1/stock-control/items?page=1&pageSize=100&custodyStates=PROMOTER_HELD%2CPROMOTER_PENDING',
    )
  })

  it('arma una exportación completa recorriendo todas las páginas acotadas', async () => {
    mockGet
      .mockResolvedValueOnce({
        data: { data: { items: [{ id: 'sim-1' }], pagination: { page: 1, pageSize: 100, total: 2, totalPages: 2 } } },
      })
      .mockResolvedValueOnce({
        data: { data: { items: [{ id: 'sim-2' }], pagination: { page: 2, pageSize: 100, total: 2, totalPages: 2 } } },
      })

    const items = await getAllOrgStockItemsForExport('org-1', { custodyState: 'PROMOTER_HELD' })

    expect(items.map(item => item.id)).toEqual(['sim-1', 'sim-2'])
    expect(mockGet).toHaveBeenNthCalledWith(
      1,
      '/api/v1/dashboard/organizations/org-1/stock-control/items?page=1&pageSize=100&custodyState=PROMOTER_HELD',
    )
    expect(mockGet).toHaveBeenNthCalledWith(
      2,
      '/api/v1/dashboard/organizations/org-1/stock-control/items?page=2&pageSize=100&custodyState=PROMOTER_HELD',
    )
  })
})
