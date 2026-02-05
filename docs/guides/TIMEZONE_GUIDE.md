# Timezone Handling Guide

ALL date/time displays MUST use venue timezone, NOT browser timezone. This follows Stripe/Toast patterns.

## Frontend: useVenueDateTime Hook

```typescript
import { useVenueDateTime } from '@/utils/datetime'

const { formatDate, formatTime, formatDateTime, venueTimezone } = useVenueDateTime()

<span>{formatDate(payment.createdAt)}</span>
<span>{formatTime(order.updatedAt)}</span>
```

Source: `src/utils/datetime.ts` (Luxon-based)

## Non-React Code: Accept Timezone Parameter

```typescript
import { DateTime } from 'luxon'
import { getIntlLocale } from '@/utils/i18n-locale'

export function formatNotificationTime(
  dateString: string,
  locale: string = 'es',
  timezone: string = 'America/Mexico_City'
): string {
  return DateTime.fromISO(dateString, { zone: 'utc' })
    .setZone(timezone)
    .setLocale(getIntlLocale(locale))
    .toLocaleString(DateTime.DATETIME_MED)
}
```

## Relative Times

```typescript
// WRONG
import { formatDistanceToNow } from 'date-fns'
formatDistanceToNow(new Date(date))

// CORRECT
DateTime.fromISO(date, { zone: 'utc' })
  .setZone(venueTimezone)
  .setLocale(localeCode)
  .toRelative()
```

## Currency Formatting

```typescript
// WRONG — hardcoded locale
new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

// CORRECT — user's language
import { getIntlLocale } from '@/utils/i18n-locale'
const localeCode = getIntlLocale(i18n.language)
new Intl.NumberFormat(localeCode, { style: 'currency', currency: 'MXN' })
```

## Backend Date Calculations

Backend uses `date-fns-tz` in `avoqado-server/src/utils/datetime.ts`.

```typescript
import { toZonedTime, fromZonedTime } from 'date-fns-tz'

const timezone = 'America/Mexico_City'
const nowVenue = toZonedTime(new Date(), timezone)

// Calculate in venue timezone
const weekStartVenue = new Date(nowVenue)
weekStartVenue.setDate(nowVenue.getDate() - nowVenue.getDay())
weekStartVenue.setHours(0, 0, 0, 0)

// Convert to UTC for Prisma queries
const weekStart = fromZonedTime(weekStartVenue, timezone)
```

## Architecture

```
BACKEND  → Calculate in venue tz (date-fns-tz)
         → Convert to UTC (fromZonedTime)
         → Query DB (Prisma expects UTC)
         → Send ISO 8601 with Z suffix
              ↓
FRONTEND → useVenueDateTime() hook
              ↓
         → DateTime.fromISO(utc, { zone: 'utc' })
           .setZone(venue.timezone)
           .setLocale(i18n.language)
              ↓
         → Display: "20 oct 2025, 12:30 PM" (venue tz)
```

## Why Venue Timezone?

- All team members see consistent times regardless of physical location
- Financial reports match business operating timezone
- Compliance: transactions reflect where the business operates
- Charts: "Today" = today in venue timezone, not UTC/server time

## Common Mistake: Chart Date Ranges

```
Without timezone handling:
  Server calculates "Sunday 00:00 UTC" as week start
  But venue (UTC-6) Sunday starts 6 hours later
  → Charts show wrong data, offset by 6 hours

With timezone handling:
  Server calculates "Sunday 00:00 CST" → "Sunday 06:00 UTC"
  → Charts show correct data ✅
```

## Sync Requirement

Frontend (`src/utils/datetime.ts`) and backend (`avoqado-server/src/utils/datetime.ts`) MUST stay in sync. See comments in backend file.
