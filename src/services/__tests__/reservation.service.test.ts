import { describe, it, expect, beforeEach } from 'vitest'
import { reservationService } from '@/services/reservation.service'
import { mockStore, createMockReservation, createMockWaitlistEntry } from '@/test/mocks/handlers'

describe('Reservation Service', () => {
  const venueId = 'test-venue-id'

  beforeEach(() => {
    mockStore.reset()
  })

  // ==================== RESERVATIONS CRUD ====================

  describe('getReservations()', () => {
    it('should return paginated list', async () => {
      createMockReservation(venueId)
      createMockReservation(venueId, { guestName: 'Second Guest' })

      const response = await reservationService.getReservations(venueId)

      expect(response.data).toHaveLength(2)
      expect(response.meta).toMatchObject({
        total: 2,
        page: 1,
        pageSize: 20,
      })
    })

    it('should filter by status', async () => {
      createMockReservation(venueId, { status: 'PENDING' })
      createMockReservation(venueId, { status: 'CONFIRMED' })
      createMockReservation(venueId, { status: 'CANCELLED' })

      const response = await reservationService.getReservations(venueId, { status: 'CONFIRMED' })

      expect(response.data).toHaveLength(1)
      expect(response.data[0].status).toBe('CONFIRMED')
    })

    it('should filter by search term', async () => {
      createMockReservation(venueId, { guestName: 'Alice Johnson' })
      createMockReservation(venueId, { guestName: 'Bob Smith' })

      const response = await reservationService.getReservations(venueId, { search: 'Alice' })

      expect(response.data).toHaveLength(1)
      expect(response.data[0].guestName).toBe('Alice Johnson')
    })

    it('should filter by date range', async () => {
      createMockReservation(venueId, { startsAt: '2026-03-01T14:00:00.000Z' })
      createMockReservation(venueId, { startsAt: '2026-03-05T14:00:00.000Z' })
      createMockReservation(venueId, { startsAt: '2026-03-10T14:00:00.000Z' })

      const response = await reservationService.getReservations(venueId, {
        dateFrom: '2026-03-01',
        dateTo: '2026-03-05',
      })

      expect(response.data).toHaveLength(2)
    })

    it('should filter by channel', async () => {
      createMockReservation(venueId, { channel: 'DASHBOARD' })
      createMockReservation(venueId, { channel: 'WEB' })

      const response = await reservationService.getReservations(venueId, { channel: 'WEB' })

      expect(response.data).toHaveLength(1)
      expect(response.data[0].channel).toBe('WEB')
    })
  })

  describe('getReservation()', () => {
    it('should return a single reservation by ID', async () => {
      const created = createMockReservation(venueId, { guestName: 'Jane Doe' })

      const response = await reservationService.getReservation(venueId, created.id)

      expect(response.id).toBe(created.id)
      expect(response.guestName).toBe('Jane Doe')
    })
  })

  describe('createReservation()', () => {
    it('should create a reservation with generated confirmationCode', async () => {
      const response = await reservationService.createReservation(venueId, {
        startsAt: '2026-03-01T14:00:00.000Z',
        endsAt: '2026-03-01T15:00:00.000Z',
        duration: 60,
        partySize: 4,
        guestName: 'New Guest',
      })

      expect(response.id).toBeDefined()
      expect(response.confirmationCode).toMatch(/^RES-/)
      expect(response.guestName).toBe('New Guest')
      expect(response.partySize).toBe(4)
    })
  })

  describe('updateReservation()', () => {
    it('should update reservation fields', async () => {
      const created = createMockReservation(venueId, { guestName: 'Original' })

      const response = await reservationService.updateReservation(venueId, created.id, {
        guestName: 'Updated Name',
        partySize: 6,
      })

      expect(response.guestName).toBe('Updated Name')
      expect(response.partySize).toBe(6)
    })
  })

  describe('cancelReservation()', () => {
    it('should cancel with a reason', async () => {
      const created = createMockReservation(venueId)

      const response = await reservationService.cancelReservation(venueId, created.id, 'Changed plans')

      expect(response.status).toBe('CANCELLED')
      expect(response.cancellationReason).toBe('Changed plans')
      expect(response.cancelledAt).toBeDefined()
    })
  })

  // ==================== STATE TRANSITIONS ====================

  describe('confirmReservation()', () => {
    it('should transition status to CONFIRMED', async () => {
      const created = createMockReservation(venueId, { status: 'PENDING' })

      const response = await reservationService.confirmReservation(venueId, created.id)

      expect(response.status).toBe('CONFIRMED')
      expect(response.confirmedAt).toBeDefined()
    })
  })

  describe('checkIn()', () => {
    it('should transition status to CHECKED_IN', async () => {
      const created = createMockReservation(venueId, { status: 'CONFIRMED' })

      const response = await reservationService.checkIn(venueId, created.id)

      expect(response.status).toBe('CHECKED_IN')
      expect(response.checkedInAt).toBeDefined()
    })
  })

  describe('complete()', () => {
    it('should transition status to COMPLETED', async () => {
      const created = createMockReservation(venueId, { status: 'CHECKED_IN' })

      const response = await reservationService.complete(venueId, created.id)

      expect(response.status).toBe('COMPLETED')
      expect(response.completedAt).toBeDefined()
    })
  })

  describe('markNoShow()', () => {
    it('should transition status to NO_SHOW', async () => {
      const created = createMockReservation(venueId, { status: 'CONFIRMED' })

      const response = await reservationService.markNoShow(venueId, created.id)

      expect(response.status).toBe('NO_SHOW')
      expect(response.noShowAt).toBeDefined()
    })
  })

  describe('reschedule()', () => {
    it('should update startsAt and endsAt', async () => {
      const created = createMockReservation(venueId)

      const newStart = '2026-04-01T18:00:00.000Z'
      const newEnd = '2026-04-01T19:30:00.000Z'
      const response = await reservationService.reschedule(venueId, created.id, {
        startsAt: newStart,
        endsAt: newEnd,
      })

      expect(response.startsAt).toBe(newStart)
      expect(response.endsAt).toBe(newEnd)
    })
  })

  // ==================== STATS / CALENDAR / AVAILABILITY ====================

  describe('getStats()', () => {
    it('should return stats with byStatus counts', async () => {
      createMockReservation(venueId, { status: 'PENDING', startsAt: '2026-03-01T10:00:00.000Z' })
      createMockReservation(venueId, { status: 'CONFIRMED', startsAt: '2026-03-01T14:00:00.000Z' })
      createMockReservation(venueId, { status: 'NO_SHOW', startsAt: '2026-03-01T16:00:00.000Z' })

      const response = await reservationService.getStats(venueId, '2026-03-01', '2026-03-01')

      expect(response.total).toBe(3)
      expect(response.byStatus.PENDING).toBe(1)
      expect(response.byStatus.CONFIRMED).toBe(1)
      expect(response.byStatus.NO_SHOW).toBe(1)
      expect(response.noShowRate).toBeCloseTo(1 / 3)
    })
  })

  describe('getCalendar()', () => {
    it('should return reservations within date range', async () => {
      createMockReservation(venueId, { startsAt: '2026-03-01T10:00:00.000Z' })
      createMockReservation(venueId, { startsAt: '2026-03-02T14:00:00.000Z' })

      const response = await reservationService.getCalendar(venueId, '2026-03-01', '2026-03-02')

      expect(response.reservations).toHaveLength(2)
    })
  })

  describe('getAvailability()', () => {
    it('should return slots for a date', async () => {
      const response = await reservationService.getAvailability(venueId, { date: '2026-03-01' })

      expect(response.date).toBe('2026-03-01')
      expect(response.slots.length).toBeGreaterThan(0)
      expect(response.slots[0]).toHaveProperty('startsAt')
      expect(response.slots[0]).toHaveProperty('availableTables')
    })
  })

  // ==================== WAITLIST ====================

  describe('getWaitlist()', () => {
    it('should return waitlist entries', async () => {
      createMockWaitlistEntry(venueId, { guestName: 'Waiting 1' })
      createMockWaitlistEntry(venueId, { guestName: 'Waiting 2' })

      const response = await reservationService.getWaitlist(venueId)

      expect(response).toHaveLength(2)
    })
  })

  describe('addToWaitlist()', () => {
    it('should add entry to waitlist', async () => {
      const response = await reservationService.addToWaitlist(venueId, {
        guestName: 'Walk-in Guest',
        partySize: 3,
        desiredStartAt: '2026-03-01T19:00:00.000Z',
      })

      expect(response.id).toBeDefined()
      expect(response.guestName).toBe('Walk-in Guest')
      expect(response.status).toBe('WAITING')
    })
  })

  describe('removeFromWaitlist()', () => {
    it('should remove entry from waitlist', async () => {
      const entry = createMockWaitlistEntry(venueId)

      await reservationService.removeFromWaitlist(venueId, entry.id)

      const remaining = await reservationService.getWaitlist(venueId)
      expect(remaining).toHaveLength(0)
    })
  })

  describe('promoteWaitlist()', () => {
    it('should promote entry with reservation link', async () => {
      const entry = createMockWaitlistEntry(venueId)
      const reservation = createMockReservation(venueId)

      const response = await reservationService.promoteWaitlist(venueId, entry.id, reservation.id)

      expect(response.status).toBe('PROMOTED')
      expect(response.promotedReservationId).toBe(reservation.id)
    })
  })

  // ==================== SETTINGS ====================

  describe('getSettings()', () => {
    it('should return default settings', async () => {
      const response = await reservationService.getSettings(venueId)

      expect(response.scheduling).toBeDefined()
      expect(response.scheduling.slotIntervalMin).toBe(15)
      expect(response.deposits).toBeDefined()
      expect(response.waitlist).toBeDefined()
    })
  })

  describe('updateSettings()', () => {
    it('should update settings', async () => {
      const response = await reservationService.updateSettings(venueId, {
        scheduling: {
          slotIntervalMin: 30,
          defaultDurationMin: 90,
          autoConfirm: true,
          maxAdvanceDays: 60,
          minNoticeMin: 120,
          noShowGraceMin: 30,
          pacingMaxPerSlot: 5,
          onlineCapacityPercent: 70,
        },
      })

      expect(response.scheduling.slotIntervalMin).toBe(30)
      expect(response.scheduling.autoConfirm).toBe(true)
    })
  })
})
