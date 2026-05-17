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

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            // data-gcal-overlay marks this DOM node so the grid's mousemove /
            // click handlers can ignore it (we don't want hovering a Google
            // block to count as a "create reservation here" intent).
            data-gcal-overlay="true"
            // z-index sits BELOW reservation blocks (which use z-30 during
            // drag). 5 keeps it above grid hour lines (z-default) but well
            // below real reservation blocks.
            className="absolute left-1 right-1 rounded-md border border-zinc-400/40 px-2 py-1 text-xs text-zinc-700 dark:text-zinc-300 overflow-hidden cursor-default select-none"
            style={{
              top: `${top}px`,
              height: `${height}px`,
              zIndex: 5,
              // Diagonal stripes — light, never aggressive. Using the muted
              // foreground at low alpha keeps it readable in both themes
              // without competing with the colored reservation blocks.
              backgroundImage:
                'repeating-linear-gradient(45deg, rgba(113,113,122,0.18) 0px, rgba(113,113,122,0.18) 6px, rgba(228,228,231,0.6) 6px, rgba(228,228,231,0.6) 12px)',
            }}
          >
            <div className="font-medium truncate">{showTitle}</div>
            {height > 28 && (
              <div className="opacity-70 truncate text-[10px]">
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
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default GoogleCalendarBusyBlock
