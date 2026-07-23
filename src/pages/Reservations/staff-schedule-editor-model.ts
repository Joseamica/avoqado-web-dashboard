import type { OperatingHours, StaffScheduleException, StaffSchedulePayload } from '@/types/reservation'

export type ScheduleExceptionError = 'MAX_EXCEPTIONS' | 'DATE_REQUIRED' | 'DATE_RANGE' | 'HOURS_REQUIRED' | 'INVALID_HOURS'

const CLOSED_DAY = { enabled: false, ranges: [] }

export function createDefaultWeeklySchedule(source?: OperatingHours | null): OperatingHours {
  if (source) return structuredClone(source)

  return {
    monday: structuredClone(CLOSED_DAY),
    tuesday: structuredClone(CLOSED_DAY),
    wednesday: structuredClone(CLOSED_DAY),
    thursday: structuredClone(CLOSED_DAY),
    friday: structuredClone(CLOSED_DAY),
    saturday: structuredClone(CLOSED_DAY),
    sunday: structuredClone(CLOSED_DAY),
  }
}

export function getScheduleExceptionError(exceptions: StaffScheduleException[]): ScheduleExceptionError | null {
  if (exceptions.length > 30) return 'MAX_EXCEPTIONS'

  for (const exception of exceptions) {
    if (!exception.startDate || !exception.endDate) return 'DATE_REQUIRED'
    if (exception.endDate < exception.startDate) return 'DATE_RANGE'
    if (exception.kind === 'HOURS') {
      if (!exception.startTime || !exception.endTime) return 'HOURS_REQUIRED'
      if (exception.endTime <= exception.startTime) return 'INVALID_HOURS'
    }
  }

  return null
}

export function prepareStaffSchedulePayload(input: {
  useCustomWeekly: boolean
  weekly: OperatingHours
  exceptions: StaffScheduleException[]
}): StaffSchedulePayload {
  return {
    weekly: input.useCustomWeekly ? structuredClone(input.weekly) : null,
    exceptions: input.exceptions.map(exception => {
      const note = exception.note?.trim()
      if (exception.kind === 'OFF') {
        return {
          startDate: exception.startDate,
          endDate: exception.endDate,
          kind: 'OFF' as const,
          ...(note ? { note } : {}),
        }
      }

      return {
        startDate: exception.startDate,
        endDate: exception.endDate,
        kind: 'HOURS' as const,
        startTime: exception.startTime,
        endTime: exception.endTime,
        ...(note ? { note } : {}),
      }
    }),
  }
}

/**
 * In staff-aware mode an empty ProductStaff row-set means zero eligible staff,
 * not "everyone". Persist the current active roster explicitly when the UI is
 * set to all staff, and never let either mode save an empty mapping.
 */
export function prepareProductStaffIds(
  restrictToSelected: boolean,
  staffVenueIds: string[],
  allActiveStaffVenueIds: string[],
): string[] | null {
  const uniqueIds = [...new Set(restrictToSelected ? staffVenueIds : allActiveStaffVenueIds)]
  return uniqueIds.length > 0 ? uniqueIds : null
}
