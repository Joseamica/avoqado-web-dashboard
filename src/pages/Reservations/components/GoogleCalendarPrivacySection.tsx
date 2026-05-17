import { AlertTriangle, Calendar, Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { cn } from '@/lib/utils'

// ----------------------------------------------------------------------------
// Privacy section — controls how much customer-identifying detail Avoqado
// pushes to the connected Google Calendar event body. Three discrete tiers:
//
//   MINIMAL  Generic title only. Maximum privacy. Use for shared calendars.
//   SERVICE  Service name in title. Good balance for most spas/salons.
//   FULL     Service + customer name + notes. Default; matches Avoqado dashboard.
//
// The preview pane is purely cosmetic — it mimics a Google Calendar event card
// so the operator can see what their staff will see on their phones before
// flipping the switch. Sample data is hard-coded localized strings so we don't
// need to fetch a real future reservation to render it.
// ----------------------------------------------------------------------------

export type EventDetailLevel = 'MINIMAL' | 'SERVICE' | 'FULL'

type Props = {
  value: EventDetailLevel
  onChange: (next: EventDetailLevel) => void
  disabled?: boolean
}

export function GoogleCalendarPrivacySection({ value, onChange, disabled }: Props) {
  const { t } = useTranslation('googleCalendar')

  // Preview state derives from `value` directly — no local mirror needed.
  const previewTitle = t(`privacy.preview.eventTitle.${value}`)
  const previewTime = t('privacy.preview.eventTime')
  const showWarning = value === 'FULL'

  return (
    <Card className="border-input">
      <div className="p-4 sm:p-6">
        <div className="mb-4">
          <h3 className="text-base font-semibold">{t('privacy.title')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t('privacy.description')}</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Left: radio controls — vertical stack with description per level. */}
          <RadioGroup
            value={value}
            onValueChange={v => onChange(v as EventDetailLevel)}
            disabled={disabled}
            className="space-y-3"
          >
            {(['MINIMAL', 'SERVICE', 'FULL'] as const).map(level => (
              <Label
                key={level}
                htmlFor={`gcal-privacy-${level}`}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors',
                  value === level
                    ? 'border-primary bg-primary/5'
                    : 'border-input hover:bg-muted/40',
                  disabled && 'cursor-not-allowed opacity-60',
                )}
              >
                <RadioGroupItem id={`gcal-privacy-${level}`} value={level} className="mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    {level === 'MINIMAL' && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                    {t(`privacy.levels.${level}.label`)}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{t(`privacy.levels.${level}.description`)}</p>
                </div>
              </Label>
            ))}
          </RadioGroup>

          {/* Right: live preview pane — styled to evoke a Google Calendar event
              card. We don't try to perfectly replicate Google's UI; what
              matters is that the operator can read the title at a glance. */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('privacy.previewTitle')}
            </p>
            <div className="rounded-lg border border-input bg-card p-3 shadow-sm">
              <div className="flex items-start gap-2">
                <div className="mt-0.5 h-3 w-3 shrink-0 rounded-sm bg-blue-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-tight text-foreground">{previewTitle}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {previewTime}
                  </p>
                </div>
              </div>
            </div>

            {showWarning && (
              <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-50 p-2.5 text-xs dark:border-amber-500/30 dark:bg-amber-950/40">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <p className="text-amber-900 dark:text-amber-100">{t('privacy.warningFull')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}

export default GoogleCalendarPrivacySection
