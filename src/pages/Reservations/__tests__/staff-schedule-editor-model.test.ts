import { describe, expect, it } from 'vitest'

import {
  createDefaultWeeklySchedule,
  getScheduleExceptionError,
  prepareProductStaffIds,
  prepareStaffSchedulePayload,
} from '@/pages/Reservations/staff-schedule-editor-model'

describe('staff schedule editor model', () => {
  it('clones venue hours so editing a professional never mutates venue settings', () => {
    const venueHours = createDefaultWeeklySchedule()
    venueHours.monday = { enabled: true, ranges: [{ open: '10:00', close: '18:00' }] }

    const staffHours = createDefaultWeeklySchedule(venueHours)
    staffHours.monday.ranges[0].open = '11:00'

    expect(venueHours.monday.ranges[0].open).toBe('10:00')
  })

  it('rejects invalid date ranges and partial HOURS exceptions before calling the API', () => {
    expect(getScheduleExceptionError([{ startDate: '2026-07-22', endDate: '2026-07-21', kind: 'OFF' }])).toBe('DATE_RANGE')

    expect(getScheduleExceptionError([{ startDate: '2026-07-22', endDate: '2026-07-22', kind: 'HOURS', startTime: '09:00' }])).toBe(
      'HOURS_REQUIRED',
    )

    expect(
      getScheduleExceptionError([
        {
          startDate: '2026-07-22',
          endDate: '2026-07-22',
          kind: 'HOURS',
          startTime: '18:00',
          endTime: '09:00',
        },
      ]),
    ).toBe('INVALID_HOURS')
  })

  it('sends null for inherited weekly hours and strips forbidden OFF time fields', () => {
    expect(
      prepareStaffSchedulePayload({
        useCustomWeekly: false,
        weekly: createDefaultWeeklySchedule(),
        exceptions: [
          {
            startDate: '2026-12-24',
            endDate: '2026-12-25',
            kind: 'OFF',
            startTime: '09:00',
            endTime: '13:00',
            note: '  Vacaciones  ',
          },
        ],
      }),
    ).toEqual({
      weekly: null,
      exceptions: [
        {
          startDate: '2026-12-24',
          endDate: '2026-12-25',
          kind: 'OFF',
          note: 'Vacaciones',
        },
      ],
    })
  })

  it('persists all active memberships explicitly and refuses every empty mapping', () => {
    expect(prepareProductStaffIds(false, ['membership-1'], ['membership-1', 'membership-2'])).toEqual([
      'membership-1',
      'membership-2',
    ])
    expect(prepareProductStaffIds(false, [], [])).toBeNull()
    expect(prepareProductStaffIds(true, [], ['membership-1'])).toBeNull()
    expect(prepareProductStaffIds(true, ['membership-1', 'membership-1', 'membership-2'], ['membership-3'])).toEqual([
      'membership-1',
      'membership-2',
    ])
  })
})
