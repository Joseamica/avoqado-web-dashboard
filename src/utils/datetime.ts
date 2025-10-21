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
