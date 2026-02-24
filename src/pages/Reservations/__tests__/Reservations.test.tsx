import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { PaginatedReservationsResponse, ReservationStats } from '@/types/reservation'

// Mock dependencies before imports
const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/venues/test/reservations', hash: '', search: '' }),
  }
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
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
    formatDateISO: (d: Date | string) => (typeof d === 'string' ? d.split('T')[0] : d.toISOString().split('T')[0]),
    venueTimezone: 'UTC',
  }),
}))

vi.mock('@/hooks/useDebounce', () => ({
  useDebounce: (value: string) => value,
}))

// Mock useAccess for PermissionGate
vi.mock('@/hooks/useAccess', () => ({
  useAccess: () => ({
    can: () => true,
    role: 'OWNER',
  }),
}))

const mockReservationsData: PaginatedReservationsResponse = {
  data: [
    {
      id: 'res-1',
      venueId: 'test-venue',
      confirmationCode: 'RES-ABC123',
      cancelSecret: 'secret',
      status: 'CONFIRMED',
      channel: 'DASHBOARD',
      startsAt: '2026-03-15T14:00:00.000Z',
      endsAt: '2026-03-15T15:00:00.000Z',
      duration: 60,
      customerId: null,
      customer: null,
      guestName: 'John Doe',
      guestPhone: '+5215551234567',
      guestEmail: 'john@test.com',
      partySize: 4,
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
      confirmedAt: '2026-03-15T10:00:00.000Z',
      checkedInAt: null,
      completedAt: null,
      cancelledAt: null,
      noShowAt: null,
      cancelledBy: null,
      cancellationReason: null,
      specialRequests: null,
      internalNotes: null,
      tags: [],
      statusLog: [],
      createdAt: '2026-03-15T09:00:00.000Z',
      updatedAt: '2026-03-15T10:00:00.000Z',
    },
  ],
  meta: { total: 1, page: 1, pageSize: 20, totalPages: 1 },
}

const mockStatsData: ReservationStats = {
  total: 10,
  byStatus: {
    PENDING: 3,
    CONFIRMED: 4,
    CHECKED_IN: 2,
    COMPLETED: 0,
    CANCELLED: 0,
    NO_SHOW: 1,
  },
  byChannel: { DASHBOARD: 5, WEB: 5, APP: 0, PHONE: 0, WHATSAPP: 0, WALK_IN: 0, THIRD_PARTY: 0 },
  noShowRate: 10,
}

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[0] === 'reservation-stats') {
      return { data: mockStatsData, isLoading: false }
    }
    return { data: mockReservationsData, isLoading: false }
  },
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))

vi.mock('@/services/reservation.service', () => ({
  default: {
    getReservations: vi.fn(),
    getStats: vi.fn(),
  },
  reservationService: {
    getReservations: vi.fn(),
    getStats: vi.fn(),
  },
}))

// PermissionGate needs to render children when permission is granted
vi.mock('@/components/PermissionGate', () => ({
  PermissionGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/PageTitleWithInfo', () => ({
  PageTitleWithInfo: ({ title, className }: { title: string; className: string }) => <h1 className={className}>{title}</h1>,
}))

vi.mock('@/components/filters', () => ({
  FilterPill: ({ label }: { label: string }) => <div data-testid="filter-pill">{label}</div>,
  CheckboxFilterContent: () => null,
}))

vi.mock('@/components/data-table', () => ({
  default: ({ data }: { data: any[] }) => (
    <table data-testid="data-table">
      <tbody>
        {data.map((row: any) => (
          <tr key={row.id} data-testid="reservation-row">
            <td>{row.confirmationCode}</td>
            <td>{row.guestName}</td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
}))

import Reservations from '../Reservations'

describe('Reservations List Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const renderComponent = () =>
    render(
      <MemoryRouter>
        <Reservations />
      </MemoryRouter>,
    )

  it('should render page title', () => {
    renderComponent()
    expect(screen.getByText('title')).toBeDefined()
  })

  it('should render tabs', () => {
    renderComponent()
    expect(screen.getByText('tabs.all')).toBeDefined()
    expect(screen.getByText('tabs.pending')).toBeDefined()
    expect(screen.getByText('tabs.confirmed')).toBeDefined()
    expect(screen.getByText('tabs.today')).toBeDefined()
    expect(screen.getByText('tabs.noShow')).toBeDefined()
  })

  it('should render stats cards when data is present', () => {
    renderComponent()
    // Stats total = 10
    expect(screen.getByText('10')).toBeDefined()
    // Pending = 3
    expect(screen.getByText('3')).toBeDefined()
    // Checked in = 2
    expect(screen.getByText('2')).toBeDefined()
    // No show rate = 10.0%
    expect(screen.getByText('10.0%')).toBeDefined()
  })

  it('should render DataTable with reservation rows', () => {
    renderComponent()
    expect(screen.getByTestId('data-table')).toBeDefined()
    expect(screen.getAllByTestId('reservation-row')).toHaveLength(1)
  })

  it('should render New Reservation button', () => {
    renderComponent()
    expect(screen.getByText('actions.newReservation')).toBeDefined()
  })

  it('should render channel filter', () => {
    renderComponent()
    expect(screen.getByTestId('filter-pill')).toBeDefined()
  })
})
