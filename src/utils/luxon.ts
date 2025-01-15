import { DateTime } from 'luxon'

export const formatDateInTimeZone = (date: string | Date | null, timezone: string = 'America/Mexico_City'): string => {
  if (!date) return 'N/A' // Handle null or undefined values gracefully

  try {
    // Parse the date and convert it to the specified timezone
    const dt = DateTime.fromISO(date.toString(), { zone: 'utc' }).setZone(timezone)

    // Format the date to a readable string
    return dt.toLocaleString(DateTime.TIME_SIMPLE) // Adjust format as needed
  } catch (error) {
    console.error('Error formatting date:', error)
    return 'Invalid Date'
  }
}
