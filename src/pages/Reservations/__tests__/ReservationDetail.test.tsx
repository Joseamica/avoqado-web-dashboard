import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { Reservation, ReservationStatus } from '@/types/reservation'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (params?.code) return `${key}:${params.code}`
      return key
    },
    i18n: { language: 'en' },
  }),
}))

vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({
    venueId: 'test-venue',
    fullBasePath: '/venues/test',
    slug: 'test',
  }),
}))

vi.mock('@/utils/datetime', () => ({
  useVenueDateTime: () => ({
    formatDate: (d: string) => d?.split('T')[0] || d,
    formatTime: (d: string) => d?.split('T')[1]?.substring(0, 5) || d,
  }),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

let mockReservation: Reservation | null = null

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: mockReservation,
    isLoading: false,
  }),
  useMutation: ({ mutationFn }: any) => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))

vi.mock('@/services/reservation.service', () => ({
  default: {},
  reservationService: {},
}))

import ReservationDetail from '../ReservationDetail'

function createTestReservation(status: ReservationStatus): Reservation {
  return {
    id: 'res-test-1',
    venueId: 'test-venue',
    confirmationCode: 'RES-TEST01',
    cancelSecret: 'secret',
    status,
    channel: 'DASHBOARD',
    startsAt: '2026-03-15T14:00:00.000Z',
    endsAt: '2026-03-15T15:00:00.000Z',
    duration: 60,
    customerId: null,
    customer: null,
    guestName: 'Test Guest',
    guestPhone: '+5215551234567',
    guestEmail: 'test@guest.com',
    partySize: 2,
    tableId: null,
    table: null,
    productId: null,
    product: null,
    classSessionId: null,
    assignedStaffId: null,
    assignedStaff: null,
    createdById: null,
    createdBy: null,
    depositAmount: null,
    depositStatus: null,
    confirmedAt: status !== 'PENDING' ? '2026-03-15T10:00:00.000Z' : null,
    checkedInAt: ['CHECKED_IN', 'COMPLETED'].includes(status) ? '2026-03-15T14:05:00.000Z' : null,
    completedAt: status === 'COMPLETED' ? '2026-03-15T15:00:00.000Z' : null,
    cancelledAt: status === 'CANCELLED' ? '2026-03-15T13:00:00.000Z' : null,
    noShowAt: status === 'NO_SHOW' ? '2026-03-15T14:30:00.000Z' : null,
    cancelledBy: null,
    cancellationReason: null,
    specialRequests: null,
    internalNotes: null,
    tags: [],
    statusLog: [{ status, at: '2026-03-15T10:00:00.000Z', by: null }],
    createdAt: '2026-03-15T09:00:00.000Z',
    updatedAt: '2026-03-15T10:00:00.000Z',
  }
}

const renderDetail = () =>
  render(
    <MemoryRouter initialEntries={['/venues/test/reservations/res-test-1']}>
      <Routes>
        <Route path="/venues/:slug/reservations/:reservationId" element={<ReservationDetail />} />
      </Routes>
    </MemoryRouter>,
  )

describe('ReservationDetail — Action Buttons by Status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('PENDING: shows Confirm and Cancel; hides Check-in, Complete', () => {
    mockReservation = createTestReservation('PENDING')
    renderDetail()

    expect(screen.getByText('actions.confirm')).toBeDefined()
    expect(screen.getByText('actions.cancel')).toBeDefined()
    expect(screen.getByText('actions.reschedule')).toBeDefined()
    expect(screen.queryByText('actions.checkIn')).toBeNull()
    expect(screen.queryByText('actions.complete')).toBeNull()
  })

  it('CONFIRMED: shows Check-in, Cancel, Reschedule, No-Show; hides Confirm', () => {
    mockReservation = createTestReservation('CONFIRMED')
    renderDetail()

    expect(screen.getByText('actions.checkIn')).toBeDefined()
    expect(screen.getByText('actions.cancel')).toBeDefined()
    expect(screen.getByText('actions.reschedule')).toBeDefined()
    expect(screen.getByText('actions.markNoShow')).toBeDefined()
    expect(screen.queryByText('actions.confirm')).toBeNull()
  })

  it('CHECKED_IN: shows Complete; hides Confirm, Check-in', () => {
    mockReservation = createTestReservation('CHECKED_IN')
    renderDetail()

    expect(screen.getByText('actions.complete')).toBeDefined()
    expect(screen.queryByText('actions.confirm')).toBeNull()
    expect(screen.queryByText('actions.checkIn')).toBeNull()
    // Cancel and Reschedule should also be hidden for CHECKED_IN
    expect(screen.queryByText('actions.cancel')).toBeNull()
    expect(screen.queryByText('actions.reschedule')).toBeNull()
  })

  it('COMPLETED: no action buttons', () => {
    mockReservation = createTestReservation('COMPLETED')
    renderDetail()

    expect(screen.queryByText('actions.confirm')).toBeNull()
    expect(screen.queryByText('actions.checkIn')).toBeNull()
    expect(screen.queryByText('actions.complete')).toBeNull()
    expect(screen.queryByText('actions.cancel')).toBeNull()
    expect(screen.queryByText('actions.reschedule')).toBeNull()
    expect(screen.queryByText('actions.markNoShow')).toBeNull()
  })

  it('CANCELLED: no action buttons', () => {
    mockReservation = createTestReservation('CANCELLED')
    renderDetail()

    expect(screen.queryByText('actions.confirm')).toBeNull()
    expect(screen.queryByText('actions.checkIn')).toBeNull()
    expect(screen.queryByText('actions.complete')).toBeNull()
    expect(screen.queryByText('actions.cancel')).toBeNull()
  })

  it('NO_SHOW: no action buttons', () => {
    mockReservation = createTestReservation('NO_SHOW')
    renderDetail()

    expect(screen.queryByText('actions.confirm')).toBeNull()
    expect(screen.queryByText('actions.checkIn')).toBeNull()
    expect(screen.queryByText('actions.complete')).toBeNull()
    expect(screen.queryByText('actions.cancel')).toBeNull()
  })
})
