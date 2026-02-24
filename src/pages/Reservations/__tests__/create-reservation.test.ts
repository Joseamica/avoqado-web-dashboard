import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import type { AvailableSlot } from '@/types/reservation'

// Re-create the schema from CreateReservation.tsx for isolated testing
const createSchema = z
  .object({
    date: z.string().min(1, 'Required'),
    startTime: z.string().min(1, 'Required'),
    endTime: z.string().min(1, 'Required'),
    duration: z.coerce.number().min(15),
    partySize: z.coerce.number().min(1),
    guestMode: z.enum(['existing', 'new']),
    customerId: z.string().optional(),
    guestName: z.string().optional(),
    guestPhone: z.string().optional(),
    guestEmail: z.string().email().optional().or(z.literal('')),
    tableId: z.string().optional(),
    assignedStaffId: z.string().optional(),
    specialRequests: z.string().optional(),
    internalNotes: z.string().optional(),
  })
  .refine(
    data => {
      if (data.guestMode === 'new' && !data.guestName) return false
      return true
    },
    { message: 'Guest name is required', path: ['guestName'] },
  )

// Slot grouping logic from CreateReservation.tsx
function groupSlotsByHour(slots: AvailableSlot[]): Record<string, AvailableSlot[]> {
  const grouped: Record<string, AvailableSlot[]> = {}
  for (const slot of slots) {
    const hour = new Date(slot.startsAt).getHours()
    const key = `${String(hour).padStart(2, '0')}:00`
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(slot)
  }
  return grouped
}

describe('CreateReservation Schema', () => {
  const validData = {
    date: '2026-03-15',
    startTime: '14:00',
    endTime: '15:00',
    duration: 60,
    partySize: 2,
    guestMode: 'new' as const,
    guestName: 'John Doe',
    guestPhone: '+5215551234567',
    guestEmail: 'john@test.com',
  }

  it('should validate a complete valid form', () => {
    const result = createSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it('should require date', () => {
    const result = createSchema.safeParse({ ...validData, date: '' })
    expect(result.success).toBe(false)
  })

  it('should require startTime', () => {
    const result = createSchema.safeParse({ ...validData, startTime: '' })
    expect(result.success).toBe(false)
  })

  it('should require endTime', () => {
    const result = createSchema.safeParse({ ...validData, endTime: '' })
    expect(result.success).toBe(false)
  })

  it('should require duration >= 15', () => {
    const result = createSchema.safeParse({ ...validData, duration: 10 })
    expect(result.success).toBe(false)
  })

  it('should require partySize >= 1', () => {
    const result = createSchema.safeParse({ ...validData, partySize: 0 })
    expect(result.success).toBe(false)
  })

  it('should require guestName when guestMode is "new"', () => {
    const result = createSchema.safeParse({
      ...validData,
      guestMode: 'new',
      guestName: '',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const guestNameError = result.error.issues.find(i => i.path.includes('guestName'))
      expect(guestNameError).toBeDefined()
    }
  })

  it('should allow empty guestName when guestMode is "existing"', () => {
    const result = createSchema.safeParse({
      ...validData,
      guestMode: 'existing',
      guestName: '',
      customerId: 'cust-123',
    })
    expect(result.success).toBe(true)
  })

  it('should validate email format', () => {
    const result = createSchema.safeParse({ ...validData, guestEmail: 'not-an-email' })
    expect(result.success).toBe(false)
  })

  it('should allow empty string for email', () => {
    const result = createSchema.safeParse({ ...validData, guestEmail: '' })
    expect(result.success).toBe(true)
  })

  it('should coerce string duration to number', () => {
    const result = createSchema.safeParse({ ...validData, duration: '60' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.duration).toBe(60)
    }
  })
})

describe('Slot Grouping', () => {
  it('should group slots by hour', () => {
    // Use local time strings (no Z suffix) so getHours() returns predictable values
    const slots: AvailableSlot[] = [
      {
        startsAt: '2026-03-15T14:00:00',
        endsAt: '2026-03-15T15:00:00',
        availableTables: [],
        availableStaff: [],
      },
      {
        startsAt: '2026-03-15T14:15:00',
        endsAt: '2026-03-15T15:15:00',
        availableTables: [],
        availableStaff: [],
      },
      {
        startsAt: '2026-03-15T14:30:00',
        endsAt: '2026-03-15T15:30:00',
        availableTables: [],
        availableStaff: [],
      },
      {
        startsAt: '2026-03-15T15:00:00',
        endsAt: '2026-03-15T16:00:00',
        availableTables: [],
        availableStaff: [],
      },
    ]

    const grouped = groupSlotsByHour(slots)

    expect(Object.keys(grouped)).toHaveLength(2)
    expect(grouped['14:00']).toHaveLength(3)
    expect(grouped['15:00']).toHaveLength(1)
  })

  it('should return empty object for no slots', () => {
    const grouped = groupSlotsByHour([])
    expect(Object.keys(grouped)).toHaveLength(0)
  })
})

describe('ISO Timestamp Construction', () => {
  it('should construct ISO from date + time strings', () => {
    const date = '2026-03-15'
    const time = '14:30'
    const iso = new Date(`${date}T${time}:00`).toISOString()

    expect(iso).toContain('2026-03-15')
    expect(iso).toContain(':30:00')
  })
})
