import { DateTime } from 'luxon'
import { useTranslation } from 'react-i18next'

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { ExternalBusyBlock } from '@/services/googleCalendar.service'

// ----------------------------------------------------------------------------
// Visual overlay for a single Google Calendar busy block on the reservation
// calendar. Rendered behind real reservation blocks (z-index < reservations)
// so that the rare overlap case keeps reservations readable.
//
// Visual identity:
//   - Light gray surface with a diagonal-stripe pattern (CSS
//     `repeating-linear-gradient`) so the operator can tell at a glance it's
//     an "external blocker" and not an Avoqado reservation.
//   - Tooltip surfaces the connection's googleAccountEmail plus a "Bloqueo de
//     Google Calendar" caption — never any Avoqado business semantics.
//   - Not clickable. Private events render with no readable title (we leave
//     `block.title === null`); we surface "Ocupado" instead so we never leak
//     the upstream visibility setting.
// ----------------------------------------------------------------------------

export type GoogleCalendarBusyBlockProps = {
  block: ExternalBusyBlock
  /** Position in pixels relative to the day column's grid (top + height). */
  top: number
  height: number
}

export function GoogleCalendarBusyBlock({ block, top, height }: GoogleCalendarBusyBlockProps) {
  const { t, i18n } = useTranslation('googleCalendar')
  const venueLocale = i18n.language

  // Server forces `title: null` for isPrivate events; defense-in-depth — if a
  // private title leaks through, fall back to the localized "Ocupado".
  const showTitle = block.isPrivate || !block.title ? t('overlay.busyLabel') : block.title

  // Render time range in venue locale — we use the block's local time fields
  // (server returns ISO strings); the grid already laid the block out at the
  // correct vertical offset via top/height, so this is for the tooltip only.
  const startFmt = DateTime.fromISO(block.startsAt).toLocaleString(
    { hour: '2-digit', minute: '2-digit' },
    { locale: venueLocale },
  )
  const endFmt = DateTime.fromISO(block.endsAt).toLocaleString(
    { hour: '2-digit', minute: '2-digit' },
    { locale: venueLocale },
  )

  // Deep-link to Google Calendar at the day of the event. We don't link to the
  // specific event because we don't store the event's htmlLink; the day view
  // surfaces all events for that date and the user can click the right one to
  // edit it inside Google Calendar (Avoqado never edits user-created events).
  const blockStart = DateTime.fromISO(block.startsAt)
  const googleCalendarDayUrl = `https://calendar.google.com/calendar/u/0/r/day/${blockStart.year}/${blockStart.month}/${blockStart.day}`

  const handleOpenInGoogle = (e: React.MouseEvent) => {
    e.stopPropagation()
    window.open(googleCalendarDayUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            // data-gcal-overlay marks this DOM node so the grid's mousemove /
            // click handlers can ignore it (we don't want hovering a Google
            // block to count as a "create reservation here" intent).
            data-gcal-overlay="true"
            onClick={handleOpenInGoogle}
            role="button"
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleOpenInGoogle(e as unknown as React.MouseEvent)
              }
            }}
            // z-index sits BELOW reservation blocks (which use z-30 during
            // drag). 5 keeps it above grid hour lines (z-default) but well
            // below real reservation blocks.
            className="absolute left-1 right-1 rounded-md border border-input bg-muted/90 px-2 py-1 text-xs text-foreground overflow-hidden cursor-pointer select-none shadow-sm transition-colors hover:bg-muted hover:border-foreground/30 focus:outline-none focus:ring-2 focus:ring-ring"
            style={{
              top: `${top}px`,
              height: `${height}px`,
              zIndex: 5,
              // Subtle diagonal stripes over a solid theme-aware base. Stripes
              // are decorative only — text reads on the muted bg-color, not on
              // the stripe pattern. Uses hsl(...) tied to the muted-foreground
              // token at low alpha so it adapts to both light and dark themes.
              backgroundImage:
                'repeating-linear-gradient(45deg, transparent 0px, transparent 8px, hsl(var(--muted-foreground) / 0.12) 8px, hsl(var(--muted-foreground) / 0.12) 10px)',
            }}
          >
            <div className="flex items-center gap-1.5">
              <svg
                viewBox="0 0 24 24"
                className="h-3 w-3 shrink-0 text-muted-foreground"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM5 8V6h14v2H5z" />
              </svg>
              <span className="font-medium truncate">{showTitle}</span>
            </div>
            {height > 28 && (
              <div className="text-muted-foreground truncate text-[10px] mt-0.5">
                {t('overlay.sourceTooltip')}
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" align="start" className="max-w-xs text-xs leading-relaxed">
          <div className="space-y-1">
            <div className="font-medium">{t('overlay.sourceTooltip')}</div>
            <div className="text-muted-foreground">
              {startFmt} – {endFmt}
            </div>
            <div className="text-muted-foreground">
              {t('overlay.account', { email: block.connection.googleAccountEmail })}
            </div>
            <div className="text-foreground/80 pt-1 border-t border-border/50 mt-1">
              {t('overlay.clickToOpen')}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default GoogleCalendarBusyBlock
