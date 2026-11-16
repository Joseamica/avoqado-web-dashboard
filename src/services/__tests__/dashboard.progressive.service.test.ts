import { beforeEach, describe, expect, it, vi } from 'vitest'

const getMock = vi.fn()

vi.mock('@/api', () => ({
  default: { get: (...args: unknown[]) => getMock(...args) },
}))

import { DashboardProgressiveService } from '@/services/dashboard.progressive.service'

describe('DashboardProgressiveService — bounded basic metrics', () => {
  beforeEach(() => getMock.mockReset())

  it('opts the dashboard into the aggregate-only response', async () => {
    getMock.mockResolvedValueOnce({ data: { payments: [], reviews: [], paymentMethodsData: [] } })
    const service = new DashboardProgressiveService('venue-1')
    const range = { from: new Date('2026-08-01T00:00:00Z'), to: new Date('2026-08-31T23:59:59Z') }

    await service.getBasicMetrics(range)

    expect(getMock).toHaveBeenCalledWith('/api/v1/dashboard/venues/venue-1/basic-metrics', {
      params: {
        fromDate: '2026-08-01T00:00:00.000Z',
        toDate: '2026-08-31T23:59:59.000Z',
        responseMode: 'aggregated-v1',
      },
    })
  })

  it('walks every server page only after an explicit detail request', async () => {
    getMock
      .mockResolvedValueOnce({ data: { items: [{ id: 'p-2' }, { id: 'p-1' }], nextCursor: 'p-1' } })
      .mockResolvedValueOnce({ data: { items: [{ id: 'p-0' }], nextCursor: null } })
    const service = new DashboardProgressiveService('venue-1')
    const range = { from: new Date('2026-08-01T00:00:00Z'), to: new Date('2026-08-31T23:59:59Z') }

    const rows = await service.getAllBasicMetricDetails('payments', range)

    expect(rows).toEqual([{ id: 'p-2' }, { id: 'p-1' }, { id: 'p-0' }])
    expect(getMock).toHaveBeenNthCalledWith(2, '/api/v1/dashboard/venues/venue-1/basic-metrics/details', {
      params: expect.objectContaining({ kind: 'payments', cursor: 'p-1', limit: 500 }),
    })
  })

  // D15 (Codex r1 #4): las tarjetas cargaron sanas y el puente QR falla DESPUÉS, a media descarga del detalle. Sólo se recogían
  // `items` y `nextCursor`: el archivo salía incompleto sin que nadie lo supiera.
  it('🔴 si CUALQUIER página del detalle viene marcada, la lista completa lo dice (aunque la primera llegara sana)', async () => {
    getMock
      .mockResolvedValueOnce({ data: { items: [{ id: 'p-2' }], nextCursor: 'p-2' } })
      .mockResolvedValueOnce({ data: { items: [{ id: 'p-1' }], nextCursor: 'p-1', legacyUnavailable: true } })
      .mockResolvedValueOnce({ data: { items: [{ id: 'p-0' }], nextCursor: null } })
    const service = new DashboardProgressiveService('venue-1')
    const range = { from: new Date('2026-08-01T00:00:00Z'), to: new Date('2026-08-31T23:59:59Z') }

    const rows = await service.getAllBasicMetricDetails('payments', range)

    expect(rows.legacyUnavailable).toBe(true)
    expect(rows.map(row => row.id)).toEqual(['p-2', 'p-1', 'p-0']) // sigue recorriendo: lo de Avoqado sí se exporta
  })

  it('con todas las páginas sanas la lista no lleva marca', async () => {
    getMock.mockResolvedValueOnce({ data: { items: [{ id: 'p-0' }], nextCursor: null } })
    const service = new DashboardProgressiveService('venue-1')
    const range = { from: new Date('2026-08-01T00:00:00Z'), to: new Date('2026-08-31T23:59:59Z') }

    expect((await service.getAllBasicMetricDetails('payments', range)).legacyUnavailable).toBeUndefined()
  })
})
