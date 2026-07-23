import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
  },
}))

import api from '@/api'
import { reservationService } from '@/services/reservation.service'

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>
  put: ReturnType<typeof vi.fn>
}

describe('reservation staff-aware HTTP contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('forwards staff-aware availability discovery parameters without changing their wire names', async () => {
    mockedApi.get.mockResolvedValue({ data: { date: '2026-07-22', slots: [] } })

    await reservationService.getAvailability('venue-1', {
      date: '2026-07-22',
      productIds: ['service-1', 'service-2'],
      staffId: 'staff-1',
      includeFull: true,
      windowSemantics: 'base',
      reservationId: 'reservation-1',
    })

    expect(mockedApi.get).toHaveBeenCalledWith(
      '/api/v1/dashboard/venues/venue-1/reservations/availability?date=2026-07-22&staffId=staff-1&productIds=service-1%2Cservice-2&includeFull=true&windowSemantics=base&reservationId=reservation-1',
    )
  })

  it('reads and atomically replaces one StaffVenue schedule', async () => {
    const schedule = {
      staffVenueId: 'staff-venue-1',
      weekly: null,
      exceptions: [],
    }
    mockedApi.get.mockResolvedValueOnce({ data: schedule })
    mockedApi.put.mockResolvedValueOnce({ data: schedule })

    await expect(reservationService.getStaffSchedule('venue-1', 'staff-venue-1')).resolves.toEqual(schedule)
    await expect(reservationService.replaceStaffSchedule('venue-1', 'staff-venue-1', {
      weekly: null,
      exceptions: [],
    })).resolves.toEqual(schedule)

    expect(mockedApi.get).toHaveBeenCalledWith(
      '/api/v1/dashboard/venues/venue-1/reservations/staff/staff-venue-1/schedule',
    )
    expect(mockedApi.put).toHaveBeenCalledWith(
      '/api/v1/dashboard/venues/venue-1/reservations/staff/staff-venue-1/schedule',
      { weekly: null, exceptions: [] },
    )
  })

  it('reads and atomically replaces eligible staff memberships for one appointment service', async () => {
    const mapping = {
      productId: 'service-1',
      staffVenueIds: ['staff-venue-1'],
      staff: [{ staffVenueId: 'staff-venue-1', staffId: 'staff-1' }],
      explicit: true,
    }
    mockedApi.get.mockResolvedValueOnce({ data: mapping })
    mockedApi.put.mockResolvedValueOnce({ data: mapping })

    await expect(reservationService.getProductStaff('venue-1', 'service-1')).resolves.toEqual(mapping)
    await expect(
      reservationService.replaceProductStaff('venue-1', 'service-1', ['staff-venue-1']),
    ).resolves.toEqual(mapping)

    expect(mockedApi.get).toHaveBeenCalledWith(
      '/api/v1/dashboard/venues/venue-1/reservations/products/service-1/staff',
    )
    expect(mockedApi.put).toHaveBeenCalledWith(
      '/api/v1/dashboard/venues/venue-1/reservations/products/service-1/staff',
      { staffVenueIds: ['staff-venue-1'] },
    )
  })
})
