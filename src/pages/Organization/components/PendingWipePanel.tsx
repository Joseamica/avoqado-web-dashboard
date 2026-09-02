import { AlertTriangle, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { useVenueDateTime } from '@/utils/datetime'
import type { OrgPendingWipe } from '@/services/organizationDashboard.service'

interface Props {
  pendingWipe: OrgPendingWipe
  /** Name of the venue the pending migration was heading to (MIGRATION origin only). */
  venueName: string | null
  busy: boolean
  onCancel: () => void
  onDiscard: () => void
}

/**
 * The way out of a MIGRATION_IN_PROGRESS blocker (founder decision 2026-09-01,
 * Asana 1218069201250971). Before this, the wizard said "there is a migration in
 * progress" and stopped — no date, no origin, no action. Now it says WHEN the
 * pending wipe was queued, WHERE it came from, and offers exactly one of:
 *
 *  - Cancel — the terminal has not received the wipe yet.
 *  - Wait (3 steps) + Discard — the terminal received it but has been silent for
 *    24 h; before that, the panel says from when discarding will be allowed.
 */
export default function PendingWipePanel({ pendingWipe, venueName, busy, onCancel, onDiscard }: Props) {
  const { t } = useTranslation('organization')
  const { formatDateTime } = useVenueDateTime()

  return (
    <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3" data-tour="terminal-migrate-pending-wipe">
      <p className="text-sm font-medium text-amber-600 flex items-start gap-1">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        {t('terminals.migrate.pendingWipe.title', { date: formatDateTime(pendingWipe.queuedAt) })}
      </p>
      <p className="text-xs text-muted-foreground">
        {pendingWipe.origin === 'MIGRATION'
          ? t('terminals.migrate.pendingWipe.originMigration', {
              venue: venueName ?? t('terminals.migrate.pendingWipe.unknownVenue'),
            })
          : t('terminals.migrate.pendingWipe.originManual')}
      </p>

      {pendingWipe.cancellable ? (
        <>
          <p className="text-xs">{t('terminals.migrate.pendingWipe.cancellableHelp')}</p>
          <Button
            size="sm"
            variant="outline"
            className="cursor-pointer"
            disabled={busy}
            onClick={onCancel}
            data-tour="terminal-migrate-cancel-pending-wipe"
          >
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {t('terminals.migrate.pendingWipe.cancelAction')}
          </Button>
        </>
      ) : (
        <>
          <ol className="text-xs list-decimal pl-5 space-y-0.5">
            <li>{t('terminals.migrate.pendingWipe.step1')}</li>
            <li>{t('terminals.migrate.pendingWipe.step2')}</li>
            <li>{t('terminals.migrate.pendingWipe.step3')}</li>
          </ol>
          {pendingWipe.discardable ? (
            <>
              <p className="text-xs">{t('terminals.migrate.pendingWipe.discardableHelp')}</p>
              <Button
                size="sm"
                variant="outline"
                className="cursor-pointer"
                disabled={busy}
                onClick={onDiscard}
                data-tour="terminal-migrate-discard-pending-wipe"
              >
                {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t('terminals.migrate.pendingWipe.discardAction')}
              </Button>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t('terminals.migrate.pendingWipe.discardableFrom', { date: formatDateTime(pendingWipe.discardableAt) })}
            </p>
          )}
        </>
      )}
    </div>
  )
}
