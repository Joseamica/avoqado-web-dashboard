import { describe, it, expect } from 'vitest'
import type { ReservationStatus } from '@/types/reservation'

// Re-implement pure functions from ReservationCalendar.tsx for testing
// These are module-private functions, so we extract and test them here

function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0]
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function getWeekDays(baseDate: Date): Date[] {
  const dayOfWeek = baseDate.getDay()
  const monday = addDays(baseDate, -((dayOfWeek + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

const HOURS = Array.from({ length: 16 }, (_, i) => i + 8)

const GRID_TOP_PAD = 12

const statusColorMap: Record<ReservationStatus, string> = {
  PENDING: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-700 dark:text-yellow-300',
  CONFIRMED: 'bg-blue-500/20 border-blue-500/40 text-blue-700 dark:text-blue-300',
  CHECKED_IN: 'bg-green-500/20 border-green-500/40 text-green-700 dark:text-green-300',
  COMPLETED: 'bg-muted border-border text-muted-foreground',
  CANCELLED: 'bg-red-500/20 border-red-500/40 text-red-700 dark:text-red-300',
  NO_SHOW: 'bg-orange-500/20 border-orange-500/40 text-orange-700 dark:text-orange-300',
}

describe('Calendar Utilities', () => {
  describe('formatDateISO()', () => {
    it('should return YYYY-MM-DD format', () => {
      const date = new Date('2026-03-15T14:30:00.000Z')
      expect(formatDateISO(date)).toBe('2026-03-15')
    })

    it('should handle single-digit months and days', () => {
      const date = new Date('2026-01-05T00:00:00.000Z')
      expect(formatDateISO(date)).toBe('2026-01-05')
    })
  })

  describe('addDays()', () => {
    it('should add days correctly', () => {
      const date = new Date('2026-03-10T12:00:00.000Z')
      const result = addDays(date, 5)
      expect(formatDateISO(result)).toBe('2026-03-15')
    })

    it('should subtract days with negative value', () => {
      const date = new Date('2026-03-10T12:00:00.000Z')
      const result = addDays(date, -3)
      expect(formatDateISO(result)).toBe('2026-03-07')
    })

    it('should handle month boundary', () => {
      const date = new Date('2026-03-30T12:00:00.000Z')
      const result = addDays(date, 3)
      expect(formatDateISO(result)).toBe('2026-04-02')
    })

    it('should not mutate the original date', () => {
      const date = new Date('2026-03-10T12:00:00.000Z')
      addDays(date, 5)
      expect(formatDateISO(date)).toBe('2026-03-10')
    })
  })

  describe('getWeekDays()', () => {
    it('should return 7 days starting from Monday', () => {
      // 2026-03-11 is a Wednesday
      const wednesday = new Date('2026-03-11T12:00:00.000Z')
      const days = getWeekDays(wednesday)

      expect(days).toHaveLength(7)
      // Monday = March 9
      expect(formatDateISO(days[0])).toBe('2026-03-09')
      // Sunday = March 15
      expect(formatDateISO(days[6])).toBe('2026-03-15')
    })

    it('should return Mon-Sun for a Monday input', () => {
      const monday = new Date('2026-03-09T12:00:00.000Z')
      const days = getWeekDays(monday)

      expect(formatDateISO(days[0])).toBe('2026-03-09')
      expect(formatDateISO(days[6])).toBe('2026-03-15')
    })

    it('should return Mon-Sun for a Sunday input', () => {
      const sunday = new Date('2026-03-15T12:00:00.000Z')
      const days = getWeekDays(sunday)

      expect(formatDateISO(days[0])).toBe('2026-03-09')
      expect(formatDateISO(days[6])).toBe('2026-03-15')
    })
  })

  describe('HOURS constant', () => {
    it('should contain 16 hours from 8 to 23', () => {
      expect(HOURS).toHaveLength(16)
      expect(HOURS[0]).toBe(8)
      expect(HOURS[HOURS.length - 1]).toBe(23)
    })
  })

  describe('Block position calculation', () => {
    it('should compute top offset for 8:00 AM', () => {
      const startHour = 8
      const top = (startHour - 8) * 64 + GRID_TOP_PAD
      expect(top).toBe(12)
    })

    it('should compute top offset for 12:00 PM', () => {
      const startHour = 12
      const top = (startHour - 8) * 64 + GRID_TOP_PAD
      expect(top).toBe(268)
    })

    it('should compute top offset for 14:30 (fractional hour)', () => {
      const startHour = 14 + 30 / 60
      const top = (startHour - 8) * 64 + GRID_TOP_PAD
      expect(top).toBe(428)
    })

    it('should compute height from duration', () => {
      // 1-hour reservation
      const startHour = 14
      const endHour = 15
      const height = Math.max((endHour - startHour) * 64, 24)
      expect(height).toBe(64)
    })

    it('should enforce minimum height of 24px', () => {
      // 15-minute reservation
      const startHour = 14
      const endHour = 14.25
      const height = Math.max((endHour - startHour) * 64, 24)
      expect(height).toBe(24)
    })
  })

  describe('Now indicator position', () => {
    it('should compute position within valid range (8-23)', () => {
      const hour = 14.5 // 2:30 PM
      const position = hour >= 8 && hour <= 23 ? (hour - 8) * 64 + GRID_TOP_PAD : null
      expect(position).toBe(428)
    })

    it('should return null for hours before 8', () => {
      const hour = 6
      const position = hour >= 8 && hour <= 23 ? (hour - 8) * 64 + GRID_TOP_PAD : null
      expect(position).toBeNull()
    })

    it('should return null for hours after 23', () => {
      const hour = 23.5
      const position = hour >= 8 && hour <= 23 ? (hour - 8) * 64 + GRID_TOP_PAD : null
      expect(position).toBeNull()
    })
  })

  describe('statusColorMap', () => {
    it('should have entries for all 6 statuses', () => {
      const allStatuses: ReservationStatus[] = [
        'PENDING', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'NO_SHOW',
      ]
      for (const status of allStatuses) {
        expect(statusColorMap[status]).toBeDefined()
        expect(statusColorMap[status].length).toBeGreaterThan(0)
      }
    })

    it('should use yellow for PENDING', () => {
      expect(statusColorMap.PENDING).toContain('yellow')
    })

    it('should use blue for CONFIRMED', () => {
      expect(statusColorMap.CONFIRMED).toContain('blue')
    })

    it('should use green for CHECKED_IN', () => {
      expect(statusColorMap.CHECKED_IN).toContain('green')
    })
  })
})
