import { useAuth } from '@/context/AuthContext'
import { DateTime } from 'luxon'

/**
 * Centralized timezone utility for Avoqado Dashboard
 *
 * **Best Practice (from Stripe, AWS, Shopify):**
 * - STORE: Always UTC in database ✅
 * - TRANSMIT: Always ISO 8601 with Z suffix ✅
 * - DISPLAY: Timezone of the RESOURCE (venue), not user browser ✅
 * - INDICATE: Always show which timezone is being displayed ✅
 *
 * **Usage:**
 * ```typescript
 * const { formatDateTime, formatTime, formatDate, venueTimezone } = useVenueDateTime()
 *
 * // In table cells:
 * <TableCell>{formatDateTime(order.createdAt)}</TableCell>
 * <TableCell>{formatTime(shift.startTime)}</TableCell>
 * <TableCell>{formatDate(payment.date)}</TableCell>
 *
 * // In table header:
 * <TableHead>Created At ({venueTimezone})</TableHead>
 * ```
 */

export interface VenueDateTimeUtils {
  /** Format full date and time: "Oct 20, 2025, 2:30 PM" */
  formatDateTime: (date: string | Date | null | undefined) => string
  /** Format time only: "2:30 PM" */
  formatTime: (date: string | Date | null | undefined) => string
  /** Format date only: "Oct 20, 2025" */
  formatDate: (date: string | Date | null | undefined) => string
  /** Format date for display: "2025-10-20" */
  formatDateISO: (date: string | Date | null | undefined) => string
  /** Current venue timezone (e.g., "America/Mexico_City") */
  venueTimezone: string
  /** Short timezone name (e.g., "CST") */
  venueTimezoneShort: string
}

/**
 * Hook to format dates in the active venue's timezone
 *
 * **CRITICAL:** This hook uses the venue timezone, NOT the browser timezone!
 * This ensures all users see consistent times regardless of their location.
 */
export function useVenueDateTime(): VenueDateTimeUtils {
  const { activeVenue } = useAuth()

  // Default to Mexico City if no venue selected (fallback)
  const venueTimezone = activeVenue?.timezone || 'America/Mexico_City'

  /**
   * Convert UTC timestamp to venue timezone
   * @param date - ISO 8601 string from backend (e.g., "2025-10-20T14:30:00.000Z")
   * @returns Luxon DateTime in venue timezone, or null if invalid
   */
  const toVenueTime = (date: string | Date | null | undefined): DateTime | null => {
    if (!date) return null

    try {
      // Parse as UTC (backend always sends UTC)
      const dt = typeof date === 'string' ? DateTime.fromISO(date, { zone: 'utc' }) : DateTime.fromJSDate(date, { zone: 'utc' })

      if (!dt.isValid) {
        console.error('Invalid date format:', date, dt.invalidReason)
        return null
      }

      // Convert to venue timezone
      return dt.setZone(venueTimezone)
    } catch (error) {
      console.error('Error parsing date:', date, error)
      return null
    }
  }

  /**
   * Format full date and time
   * @example "Oct 20, 2025, 2:30 PM"
   */
  const formatDateTime = (date: string | Date | null | undefined): string => {
    const dt = toVenueTime(date)
    if (!dt) return 'N/A'

    return dt.toLocaleString(DateTime.DATETIME_MED)
  }

  /**
   * Format time only
   * @example "2:30 PM"
   */
  const formatTime = (date: string | Date | null | undefined): string => {
    const dt = toVenueTime(date)
    if (!dt) return 'N/A'

    return dt.toLocaleString(DateTime.TIME_SIMPLE)
  }

  /**
   * Format date only
   * @example "Oct 20, 2025"
   */
  const formatDate = (date: string | Date | null | undefined): string => {
    const dt = toVenueTime(date)
    if (!dt) return 'N/A'

    return dt.toLocaleString(DateTime.DATE_MED)
  }

  /**
   * Format date in ISO format for display
   * @example "2025-10-20"
   */
  const formatDateISO = (date: string | Date | null | undefined): string => {
    const dt = toVenueTime(date)
    if (!dt) return 'N/A'

    return dt.toISODate() || 'N/A'
  }

  /**
   * Get short timezone abbreviation
   * @example "CST" for Central Standard Time
   */
  const venueTimezoneShort = DateTime.now().setZone(venueTimezone).toFormat('ZZZZ')

  return {
    formatDateTime,
    formatTime,
    formatDate,
    formatDateISO,
    venueTimezone,
    venueTimezoneShort,
  }
}

/**
 * Standalone timezone formatter (no hook)
 * Use when you need to format dates outside of React components
 */
export const formatDateInTimeZone = (
  date: string | Date | null,
  timezone: string = 'America/Mexico_City',
  format: 'datetime' | 'time' | 'date' | 'iso' = 'datetime',
): string => {
  if (!date) return 'N/A'

  try {
    const dt = typeof date === 'string' ? DateTime.fromISO(date, { zone: 'utc' }) : DateTime.fromJSDate(date, { zone: 'utc' })

    if (!dt.isValid) return 'Invalid Date'

    const converted = dt.setZone(timezone)

    switch (format) {
      case 'time':
        return converted.toLocaleString(DateTime.TIME_SIMPLE)
      case 'date':
        return converted.toLocaleString(DateTime.DATE_MED)
      case 'iso':
        return converted.toISODate() || 'N/A'
      case 'datetime':
      default:
        return converted.toLocaleString(DateTime.DATETIME_MED)
    }
  } catch (error) {
    console.error('Error formatting date:', date, error)
    return 'Invalid Date'
  }
}

/**
 * Get timezone indicator text for table headers
 * @example "Times shown in America/Mexico_City (CST)"
 */
export const getTimezoneIndicator = (timezone: string = 'America/Mexico_City'): string => {
  const shortName = DateTime.now().setZone(timezone).toFormat('ZZZZ')
  return `Times shown in ${timezone} (${shortName})`
}

/**
 * Date range calculation utilities
 *
 * **CRITICAL:** These functions calculate date ranges in the VENUE'S timezone,
 * not the user's browser timezone. This ensures dashboard filters match backend
 * queries exactly, regardless of where the user is located.
 */

export interface DateRange {
  from: Date
  to: Date
}

/**
 * Get "today" date range in venue timezone
 *
 * @param timezone - Venue timezone (IANA format)
 * @returns Start and end of today in venue timezone, as UTC Date objects
 *
 * @example
 * // User in NYC (EST) accessing venue in Mexico City (CST)
 * // Current time: Oct 29, 2025 1:00 AM EST (Oct 28, 2025 11:00 PM CST in Mexico)
 * const range = getToday('America/Mexico_City')
 * // Returns: Oct 28, 2025 00:00 CST → 05:00 UTC
 * //          Oct 28, 2025 23:59 CST → 04:59 UTC (next day)
 * // NOT Oct 29 in EST!
 */
export const getToday = (timezone: string = 'America/Mexico_City'): DateRange => {
  const now = DateTime.now().setZone(timezone)
  const startOfDay = now.startOf('day')
  const endOfDay = now.endOf('day')

  return {
    from: startOfDay.toJSDate(),
    to: endOfDay.toJSDate(),
  }
}

/**
 * Get "yesterday" date range in venue timezone
 */
export const getYesterday = (timezone: string = 'America/Mexico_City'): DateRange => {
  const now = DateTime.now().setZone(timezone)
  const yesterday = now.minus({ days: 1 })
  const startOfDay = yesterday.startOf('day')
  const endOfDay = yesterday.endOf('day')

  return {
    from: startOfDay.toJSDate(),
    to: endOfDay.toJSDate(),
  }
}

/**
 * Get "last 7 days" date range in venue timezone
 *
 * **CRITICAL:** This returns full days (midnight to 23:59:59), not exact timestamps.
 * This ensures consistent results regardless of when the query runs.
 *
 * @example
 * // Current time in venue: Oct 29, 2025 14:30 CST
 * const range = getLast7Days('America/Mexico_City')
 * // Returns: Oct 23, 2025 00:00 CST → Oct 29, 2025 23:59 CST (7 full days)
 */
export const getLast7Days = (timezone: string = 'America/Mexico_City'): DateRange => {
  const now = DateTime.now().setZone(timezone)
  const sevenDaysAgo = now.minus({ days: 6 }).startOf('day') // 6 days ago + today = 7 days total
  const endOfToday = now.endOf('day')

  return {
    from: sevenDaysAgo.toJSDate(),
    to: endOfToday.toJSDate(),
  }
}

/**
 * Get "last 30 days" date range in venue timezone
 *
 * **CRITICAL:** This returns full days (midnight to 23:59:59), not exact timestamps.
 * This ensures consistent results regardless of when the query runs.
 */
export const getLast30Days = (timezone: string = 'America/Mexico_City'): DateRange => {
  const now = DateTime.now().setZone(timezone)
  const thirtyDaysAgo = now.minus({ days: 29 }).startOf('day') // 29 days ago + today = 30 days total
  const endOfToday = now.endOf('day')

  return {
    from: thirtyDaysAgo.toJSDate(),
    to: endOfToday.toJSDate(),
  }
}

/**
 * Get previous period of the same duration
 *
 * Used for comparison metrics (e.g., "vs previous 7 days")
 *
 * @param currentRange - The current selected date range
 * @returns A date range of the same duration, ending 1ms before currentRange starts
 *
 * @example
 * // Current: Oct 22-29 (7 days)
 * const prev = getPreviousPeriod(currentRange)
 * // Returns: Oct 15-22 (7 days before)
 */
export const getPreviousPeriod = (currentRange: DateRange): DateRange => {
  const duration = currentRange.to.getTime() - currentRange.from.getTime()
  const compareEnd = new Date(currentRange.from.getTime() - 1)
  const compareStart = new Date(compareEnd.getTime() - duration)

  return {
    from: compareStart,
    to: compareEnd,
  }
}
