import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

import api from '@/api'
import { getSalesExportRows, recordSalesExportAudit } from '@/services/storesAnalysis.service'

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
}

const firstPage = {
  rows: [
    {
      id: 'order-000001',
      venueName: 'Sucursal Centro',
      product: 'SIM 5G',
      iccid: '8952140063000000001',
      staffId: 'staff-000001',
      staffName: 'Ana Pérez',
      staffEmployeeCode: 'EMP-17',
      amount: 249.5,
      timestamp: '2026-08-07T15:30:00.000Z',
    },
  ],
  nextCursor: 'order-000001',
  total: 3,
}

describe('storesAnalysis sales export service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requests one cursor page with the complete date and venue filter contract', async () => {
    mockedApi.get.mockResolvedValue({
      data: { success: true, data: firstPage },
    })

    const result = await getSalesExportRows('venue-root', {
      startDate: '2026-08-01T00:00:00.000Z',
      endDate: '2026-08-07T23:59:59.999Z',
      filterVenueId: 'venue-branch',
      cursor: 'order-before-this-page',
      limit: 500,
    })

    expect(mockedApi.get).toHaveBeenCalledOnce()
    expect(mockedApi.get).toHaveBeenCalledWith('/api/v1/dashboard/venues/venue-root/stores-analysis/sales-export-rows', {
      params: {
        startDate: '2026-08-01T00:00:00.000Z',
        endDate: '2026-08-07T23:59:59.999Z',
        filterVenueId: 'venue-branch',
        cursor: 'order-before-this-page',
        limit: 500,
      },
    })
    expect(result).toEqual(firstPage)
  })

  it('posts the exact successful browser-export audit payload', async () => {
    mockedApi.post.mockResolvedValue({
      data: { success: true, data: { logged: true } },
    })

    await recordSalesExportAudit('venue-root', {
      format: 'excel',
      startDate: '2026-08-01T00:00:00.000Z',
      endDate: '2026-08-07T23:59:59.999Z',
      filterVenueId: 'venue-branch',
      rowCount: 742,
    })

    expect(mockedApi.post).toHaveBeenCalledOnce()
    expect(mockedApi.post).toHaveBeenCalledWith('/api/v1/dashboard/venues/venue-root/stores-analysis/sales-export-audit', {
      format: 'excel',
      startDate: '2026-08-01T00:00:00.000Z',
      endDate: '2026-08-07T23:59:59.999Z',
      filterVenueId: 'venue-branch',
      rowCount: 742,
    })
  })
})
