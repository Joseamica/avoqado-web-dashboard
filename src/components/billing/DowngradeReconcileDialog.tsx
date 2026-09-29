// src/components/billing/DowngradeReconcileDialog.tsx
//
// "Choose who stays" when a venue drops to Gratis with more users than it allows (spec §4.3). It writes nothing: the
// caller decides what confirming does — schedule the classic downgrade with the owner's reason, or carry the choice
// into a hybrid quote before paying. Owners are pre-selected and locked; at most `keepMax` rows.
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { useIsMobile } from '@/hooks/use-mobile'
import { useVenueDateTime } from '@/utils/datetime'
import type { DowngradePreview } from '@/services/features.service'
import { KeepStaffSelector, ownerIds } from './KeepStaffSelector'

export interface DowngradeReconcileDialogProps {
  open: boolean
  onClose: () => void
  /** The backend preview (required=true) that triggered this flow. */
  preview: DowngradePreview
  /** Scheduled "switches at" date (the plan's period end) when available. */
  currentPeriodEnd?: string | null
  onConfirm: (keepStaffVenueIds: string[]) => void
  pending?: boolean
  confirmLabel?: string
  /** Hybrid checkout only: go on without choosing; the automatic order applies (spec §4.3). */
  onSkip?: () => void
}

export function DowngradeReconcileDialog({
  open,
  onClose,
  preview,
  currentPeriodEnd,
  onConfirm,
  pending = false,
  confirmLabel,
  onSkip,
}: DowngradeReconcileDialogProps) {
  const { t } = useTranslation('billing')
  const { formatDate } = useVenueDateTime()
  const owners = useMemo(() => ownerIds(preview), [preview])
  const [selected, setSelected] = useState<Set<string>>(() => new Set(owners))
  useEffect(() => {
    if (open) setSelected(new Set(owners))
  }, [open, owners])
  const scheduledDate = currentPeriodEnd ? formatDate(currentPeriodEnd) : null
  // On a phone the header can't hold the centred title and these labels: the buttons move to a bar at the bottom.
  const phone = useIsMobile()
  const buttons = (
    <>
      {onSkip && (
        <Button variant="outline" onClick={onSkip} disabled={pending} className={phone ? 'flex-1' : undefined} data-tour="downgrade-skip">
          {t('plan.downgrade.skipCta')}
        </Button>
      )}
      <Button
        data-tour="downgrade-confirm"
        onClick={() => onConfirm(Array.from(selected))}
        disabled={pending}
        className={phone ? 'flex-1 cursor-pointer' : 'cursor-pointer'}
      >
        {pending ? t('plan.downgrade.confirming') : (confirmLabel ?? t('plan.downgrade.confirmCta'))}
      </Button>
    </>
  )

  return (
    <FullScreenModal
      open={open}
      onClose={onClose}
      title={t('plan.downgrade.title')}
      contentClassName="bg-muted/30"
      actions={phone ? undefined : <div className="flex gap-2">{buttons}</div>}
    >
      <div className="mx-auto max-w-2xl space-y-6 px-6 py-8">
        <div className="rounded-2xl border border-input bg-card p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-400/15 text-amber-400">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold">{t('plan.downgrade.explainTitle', { cap: preview.cap })}</h3>
              <p className="text-sm text-muted-foreground">
                {t(onSkip ? 'plan.downgrade.explainBodyNow' : 'plan.downgrade.explainBody', {
                  cap: preview.cap,
                  currentActive: preview.currentActive,
                })}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-input bg-muted/40 px-4 py-3">
            <span className="text-sm font-medium">
              {t('plan.downgrade.counter', { selected: selected.size, keepMax: preview.keepMax })}
            </span>
            {scheduledDate && (
              <span className="text-xs text-muted-foreground">{t('plan.downgrade.scheduledOn', { date: scheduledDate })}</span>
            )}
          </div>
        </div>
        <KeepStaffSelector preview={preview} selected={selected} onChange={setSelected} />
        <p className="text-xs text-muted-foreground">{t('plan.downgrade.reassurance')}</p>
      </div>
      {phone && (
        <div className="sticky bottom-0 flex gap-2 border-t border-border/30 bg-card p-4" data-tour="downgrade-actions-bar">
          {buttons}
        </div>
      )}
    </FullScreenModal>
  )
}

export default DowngradeReconcileDialog
