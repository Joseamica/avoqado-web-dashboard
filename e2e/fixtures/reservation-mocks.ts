import { Page } from '@playwright/test'

// ─── Factories ──────────────────────────────────────────────────

let reservationCounter = 0
let waitlistCounter = 0

export interface MockReservation {
  id: string
  venueId: string
  confirmationCode: string
  cancelSecret: string
  status: string
  channel: string
  startsAt: string
  endsAt: string
  duration: number
  customerId: string | null
  customer: { id: string; firstName: string; lastName: string; phone: string | null; email: string | null } | null
  guestName: string | null
  guestPhone: string | null
  guestEmail: string | null
  partySize: number
  tableId: string | null
  table: { id: string; number: string; capacity: number } | null
  productId: string | null
  product: null
  assignedStaffId: string | null
  assignedStaff: null
  createdById: string | null
  createdBy: null
  depositAmount: number | null
  depositStatus: string | null
  confirmedAt: string | null
  checkedInAt: string | null
  completedAt: string | null
  cancelledAt: string | null
  noShowAt: string | null
  cancelledBy: string | null
  cancellationReason: string | null
  specialRequests: string | null
  internalNotes: string | null
  tags: string[]
  statusLog: Array<{ status: string; at: string; by: string | null }>
  createdAt: string
  updatedAt: string
}

export function createMockReservation(overrides: Partial<MockReservation> = {}): MockReservation {
  reservationCounter++
  const id = overrides.id ?? `res-${reservationCounter.toString().padStart(3, '0')}`
  const now = '2026-03-15T10:00:00.000Z'

  return {
    id,
    venueId: 'venue-alpha',
    confirmationCode: `RES-${id.toUpperCase()}`,
    cancelSecret: `secret-${id}`,
    status: 'CONFIRMED',
    channel: 'DASHBOARD',
    startsAt: '2026-03-15T14:00:00.000Z',
    endsAt: '2026-03-15T15:00:00.000Z',
    duration: 60,
    customerId: null,
    customer: null,
    guestName: `Guest ${reservationCounter}`,
    guestPhone: '+5215551234567',
    guestEmail: `guest${reservationCounter}@test.com`,
    partySize: 2,
    tableId: null,
    table: null,
    productId: null,
    product: null,
    assignedStaffId: null,
    assignedStaff: null,
    createdById: null,
    createdBy: null,
    depositAmount: null,
    depositStatus: null,
    confirmedAt: now,
    checkedInAt: null,
    completedAt: null,
    cancelledAt: null,
    noShowAt: null,
    cancelledBy: null,
    cancellationReason: null,
    specialRequests: null,
    internalNotes: null,
    tags: [],
    statusLog: [{ status: 'CONFIRMED', at: now, by: null }],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export interface MockWaitlistEntry {
  id: string
  venueId: string
  guestName: string
  guestPhone: string | null
  partySize: number
  desiredStartAt: string
  status: string
  position: number
  createdAt: string
  updatedAt: string
}

export function createMockWaitlistEntry(overrides: Partial<MockWaitlistEntry> = {}): MockWaitlistEntry {
  waitlistCounter++
  return {
    id: `wl-${waitlistCounter.toString().padStart(3, '0')}`,
    venueId: 'venue-alpha',
    guestName: `Waitlist ${waitlistCounter}`,
    guestPhone: '+5215559876543',
    partySize: 2,
    desiredStartAt: '2026-03-15T19:00:00.000Z',
    status: 'WAITING',
    position: waitlistCounter,
    createdAt: '2026-03-15T10:00:00.000Z',
    updatedAt: '2026-03-15T10:00:00.000Z',
    ...overrides,
  }
}

// ─── Route Setup ─────────────────────────────────────────────────

export async function setupReservationMocks(
  page: Page,
  options: {
    reservations?: MockReservation[]
    stats?: any
  } = {},
) {
  const reservations = options.reservations ?? [
    createMockReservation({ status: 'CONFIRMED', guestName: 'Alice Smith' }),
    createMockReservation({ status: 'PENDING', guestName: 'Bob Jones' }),
    createMockReservation({ status: 'CHECKED_IN', guestName: 'Carlos García' }),
  ]

  const stats = options.stats ?? {
    total: reservations.length,
    byStatus: {
      PENDING: reservations.filter((r) => r.status === 'PENDING').length,
      CONFIRMED: reservations.filter((r) => r.status === 'CONFIRMED').length,
      CHECKED_IN: reservations.filter((r) => r.status === 'CHECKED_IN').length,
      COMPLETED: 0,
      CANCELLED: 0,
      NO_SHOW: 0,
    },
    byChannel: { DASHBOARD: reservations.length },
    noShowRate: 0,
  }

  // Reservation stats
  await page.route('**/api/v1/dashboard/venues/*/reservations/stats*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(stats),
    }),
  )

  // Reservation list (paginated)
  await page.route('**/api/v1/dashboard/venues/*/reservations?*', (route) => {
    const url = new URL(route.request().url())
    const search = url.searchParams.get('search')
    const status = url.searchParams.get('status')

    let filtered = [...reservations]
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter(
        (r) => r.guestName?.toLowerCase().includes(q) || r.confirmationCode.toLowerCase().includes(q),
      )
    }
    if (status) {
      const statuses = status.split(',')
      filtered = filtered.filter((r) => statuses.includes(r.status))
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: filtered,
        meta: {
          total: filtered.length,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        },
      }),
    })
  })

  // Reservation list (no query params)
  await page.route('**/api/v1/dashboard/venues/*/reservations', (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: reservations,
        meta: {
          total: reservations.length,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        },
      }),
    })
  })

  // Single reservation detail
  await page.route('**/api/v1/dashboard/venues/*/reservations/res-*', (route) => {
    const url = new URL(route.request().url())
    const segments = url.pathname.split('/')
    const resId = segments[segments.length - 1]
    const reservation = reservations.find((r) => r.id === resId)

    if (!reservation) {
      return route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Not found' }),
      })
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(reservation),
    })
  })
}
