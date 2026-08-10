import { describe, expect, it, vi } from 'vitest'
import { fetchAllSalesExportRows, mapSalesExportRows, resolveSupervisorTab, shouldPollSupervisorActivity } from './supervisorExport'

interface SalesExportRowFixture {
  id: string
  venueName: string
  product: string
  iccid: string | null
  staffId: string | null
  staffName: string
  staffEmployeeCode: string | null
  amount: number
  timestamp: string
}

interface SalesExportPageParamsFixture {
  startDate: string
  endDate: string
  filterVenueId?: string
  cursor?: string
  limit?: number
}

const rows: SalesExportRowFixture[] = [
  {
    id: 'order-000001',
    venueName: 'Sucursal Uno',
    product: 'SIM Azul',
    iccid: '8952140063000000001',
    staffId: 'staff-000001',
    staffName: 'Ana Pérez',
    staffEmployeeCode: 'EMP-1',
    amount: 100,
    timestamp: '2026-08-01T10:00:00.000Z',
  },
  {
    id: 'order-000002',
    venueName: 'Sucursal Dos',
    product: 'SIM Verde',
    iccid: '8952140063000000002',
    staffId: 'staff-000002',
    staffName: 'Luis Ruiz',
    staffEmployeeCode: 'EMP-2',
    amount: 200,
    timestamp: '2026-08-02T10:00:00.000Z',
  },
  {
    id: 'order-000003',
    venueName: 'Sucursal Tres',
    product: 'SIM Roja',
    iccid: '8952140063000000003',
    staffId: 'staff-000003',
    staffName: 'María López',
    staffEmployeeCode: 'EMP-3',
    amount: 300,
    timestamp: '2026-08-03T10:00:00.000Z',
  },
]

describe('fetchAllSalesExportRows', () => {
  it('walks cursors sequentially, preserves filters, and retains the first-page total for progress', async () => {
    const calls: Array<{ venueId: string; params: SalesExportPageParamsFixture }> = []
    const progress: Array<{ fetched: number; total?: number }> = []
    let activeRequests = 0
    let maxActiveRequests = 0

    const fetchPage = vi.fn(async (venueId: string, params: SalesExportPageParamsFixture) => {
      calls.push({ venueId, params: { ...params } })
      activeRequests += 1
      maxActiveRequests = Math.max(maxActiveRequests, activeRequests)
      await Promise.resolve()
      activeRequests -= 1

      if (params.cursor === undefined) {
        return { rows: [rows[0]], nextCursor: 'cursor-1', total: 3 }
      }
      if (params.cursor === 'cursor-1') {
        return { rows: [rows[1]], nextCursor: 'cursor-2' }
      }
      if (params.cursor === 'cursor-2') {
        return { rows: [rows[2]], nextCursor: null }
      }
      throw new Error(`Unexpected cursor: ${String(params.cursor)}`)
    })

    const result = await fetchAllSalesExportRows({
      venueId: 'venue-root',
      startDate: '2026-08-01T00:00:00.000Z',
      endDate: '2026-08-07T23:59:59.999Z',
      filterVenueId: 'venue-branch',
      fetchPage,
      onProgress: value => progress.push(value),
    })

    expect(result).toEqual(rows)
    expect(maxActiveRequests).toBe(1)
    expect(calls).toEqual([
      {
        venueId: 'venue-root',
        params: {
          startDate: '2026-08-01T00:00:00.000Z',
          endDate: '2026-08-07T23:59:59.999Z',
          filterVenueId: 'venue-branch',
          cursor: undefined,
          limit: 500,
        },
      },
      {
        venueId: 'venue-root',
        params: {
          startDate: '2026-08-01T00:00:00.000Z',
          endDate: '2026-08-07T23:59:59.999Z',
          filterVenueId: 'venue-branch',
          cursor: 'cursor-1',
          limit: 500,
        },
      },
      {
        venueId: 'venue-root',
        params: {
          startDate: '2026-08-01T00:00:00.000Z',
          endDate: '2026-08-07T23:59:59.999Z',
          filterVenueId: 'venue-branch',
          cursor: 'cursor-2',
          limit: 500,
        },
      },
    ])
    expect(progress).toEqual([
      { fetched: 1, total: 3 },
      { fetched: 2, total: 3 },
      { fetched: 3, total: 3 },
    ])
  })
})

describe('mapSalesExportRows', () => {
  it('preserves the existing columns and derives seller user from staffId when no username is exported', () => {
    const result = mapSalesExportRows(
      [
        {
          id: 'order-abcdef',
          venueName: 'Sucursal Centro',
          product: 'SIM 5G',
          iccid: null,
          staffId: 'staff-123456',
          staffName: 'Ana Pérez',
          staffEmployeeCode: null,
          amount: 129.5,
          timestamp: '2026-01-15T12:34:56.000',
        },
      ],
      {
        store: 'Tienda',
        product: 'Producto',
        seller: 'Vendedor',
        sellerEmployeeCode: 'ID Vendedor',
        sellerUser: 'Usuario vendedor',
        amount: 'Monto',
        date: 'Fecha',
      },
    )

    expect(result).toEqual([
      {
        ID: 'ABCDEF',
        Tienda: 'Sucursal Centro',
        Producto: 'SIM 5G',
        ICCID: '',
        Vendedor: 'Ana Pérez',
        'ID Vendedor': '',
        'Usuario vendedor': 'ID:123456',
        Monto: '129.50',
        Fecha: '2026-01-15 12:34:56',
      },
    ])
  })
})

describe('shouldPollSupervisorActivity', () => {
  const now = new Date('2026-08-07T18:00:00.000Z')

  it('polls only the operational tab when the selected range contains now', () => {
    expect(
      shouldPollSupervisorActivity(
        'operativo',
        { from: new Date('2026-08-07T00:00:00.000Z'), to: new Date('2026-08-07T23:59:59.999Z') },
        now,
      ),
    ).toBe(true)
    expect(
      shouldPollSupervisorActivity(
        'ventas',
        { from: new Date('2026-08-07T00:00:00.000Z'), to: new Date('2026-08-07T23:59:59.999Z') },
        now,
      ),
    ).toBe(false)
  })

  it('does not poll a historical range', () => {
    expect(
      shouldPollSupervisorActivity(
        'operativo',
        { from: new Date('2026-07-01T00:00:00.000Z'), to: new Date('2026-07-31T23:59:59.999Z') },
        now,
      ),
    ).toBe(false)
  })
})

describe('resolveSupervisorTab', () => {
  it('uses a valid deep-link hash on the first render and rejects unknown tabs', () => {
    expect(resolveSupervisorTab('#ventas')).toBe('ventas')
    expect(resolveSupervisorTab('#not-a-tab')).toBe('operativo')
  })
})
