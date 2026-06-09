// src/components/billing/DowngradeReconcileDialog.tsx
//
// (B) Pro→Free downgrade "choose who stays" flow.
//
// When the owner downgrades a paid venue to Free and the venue has more active
// cap-counting users than Free allows, the backend's downgrade-preview returns
// `required = true`. This FullScreenModal lets the owner pick who stays:
//   • The OWNER row (isOwner) is pre-selected AND locked — can't be unchecked.
//   • At most `keepMax` rows can be selected (further checks disabled once reached).
//   • Confirm → downgradeVenueToFree(venueId, selectedIds).
//
// The chosen users keep access; the rest are deactivated when the paid period
// ends (not deleted — they reactivate automatically if the venue returns to Pro).
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Check, Lock, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { useToast } from '@/hooks/use-toast'
import { useVenueDateTime } from '@/utils/datetime'
import { downgradeVenueToFree, type DowngradePreview } from '@/services/features.service'

export interface DowngradeReconcileDialogProps {
  open: boolean
  onClose: () => void
  venueId: string
  /** The backend preview (required=true) that triggered this flow. */
  preview: DowngradePreview
  /** Scheduled "switches at" date (planState.currentPeriodEnd) when available. */
  currentPeriodEnd?: string | null
}

export function DowngradeReconcileDialog({
  open,
  onClose,
  venueId,
  preview,
  currentPeriodEnd,
}: DowngradeReconcileDialogProps) {
  const { t } = useTranslation('billing')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { formatDate } = useVenueDateTime()

  const { cap, currentActive, keepMax, staff } = preview

  // The owner is always kept and locked. Seed selection with every owner row.
  const ownerIds = useMemo(() => staff.filter(s => s.isOwner).map(s => s.staffVenueId), [staff])

  const [selected, setSelected] = useState<Set<string>>(() => new Set(ownerIds))

  // Re-seed selection whenever the dialog (re)opens or the roster changes — the owner
  // must always start selected and locked.
  useEffect(() => {
    if (open) setSelected(new Set(ownerIds))
  }, [open, ownerIds])

  const selectedCount = selected.size
  const atMax = selectedCount >= keepMax

  const toggle = (row: DowngradePreview['staff'][number]) => {
    if (row.isOwner) return // owner is locked
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(row.staffVenueId)) {
        next.delete(row.staffVenueId)
      } else if (next.size < keepMax) {
        next.add(row.staffVenueId)
      }
      return next
    })
  }

  const downgradeMutation = useMutation({
    mutationFn: () => downgradeVenueToFree(venueId, Array.from(selected)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venuePlan', venueId] })
      queryClient.invalidateQueries({ queryKey: ['seatStatus', venueId] })
      queryClient.invalidateQueries({ queryKey: ['venueFeatures', venueId] })
      queryClient.invalidateQueries({ queryKey: ['team-members', venueId] })
      toast({ title: t('plan.downgrade.successToast') })
      onClose()
    },
    onError: () => {
      toast({ title: t('plan.downgrade.errorToast'), variant: 'destructive' })
    },
  })

  const scheduledDate = currentPeriodEnd ? formatDate(currentPeriodEnd) : null

  return (
    <FullScreenModal
      open={open}
      onClose={onClose}
      title={t('plan.downgrade.title')}
      contentClassName="bg-muted/30"
      actions={
        <Button
          data-tour="downgrade-confirm"
          onClick={() => downgradeMutation.mutate()}
          disabled={downgradeMutation.isPending}
          className="cursor-pointer"
        >
          {downgradeMutation.isPending ? t('plan.downgrade.confirming') : t('plan.downgrade.confirmCta')}
        </Button>
      }
    >
      <div className="mx-auto max-w-2xl px-6 py-8 space-y-6">
        {/* Explanation card */}
        <div className="rounded-2xl border border-input bg-card p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-400/15 text-amber-400">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold">{t('plan.downgrade.explainTitle', { cap })}</h3>
              <p className="text-sm text-muted-foreground">
                {t('plan.downgrade.explainBody', { cap, currentActive })}
              </p>
            </div>
          </div>

          {/* Counter + scheduled date */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-input bg-muted/40 px-4 py-3">
            <span className="text-sm font-medium">
              {t('plan.downgrade.counter', { selected: selectedCount, keepMax })}
            </span>
            {scheduledDate && (
              <span className="text-xs text-muted-foreground">
                {t('plan.downgrade.scheduledOn', { date: scheduledDate })}
              </span>
            )}
          </div>
        </div>

        {/* Roster — clickable selection rows */}
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('plan.downgrade.rosterLabel')}
          </p>
          {staff.map(row => {
            const isSelected = selected.has(row.staffVenueId)
            const isLocked = row.isOwner
            // A non-selected row is "disabled" only when the max is reached.
            const isDisabled = !isSelected && atMax && !isLocked
            return (
              <div
                key={row.staffVenueId}
                role="button"
                tabIndex={isLocked || isDisabled ? -1 : 0}
                aria-pressed={isSelected}
                aria-disabled={isLocked || isDisabled}
                data-tour={`downgrade-staff-${row.staffVenueId}`}
                onClick={() => !isDisabled && toggle(row)}
                onKeyDown={e => {
                  if ((e.key === 'Enter' || e.key === ' ') && !isDisabled) {
                    e.preventDefault()
                    toggle(row)
                  }
                }}
                className={cn(
                  'flex items-center gap-3 rounded-xl border border-input p-3 transition-colors',
                  isSelected ? 'bg-primary/5 border-primary/40' : 'bg-card',
                  isLocked
                    ? 'cursor-default'
                    : isDisabled
                      ? 'cursor-not-allowed opacity-50'
                      : 'cursor-pointer hover:bg-muted/50',
                )}
              >
                <Checkbox
                  checked={isSelected}
                  disabled={isLocked || isDisabled}
                  // Row handles the click; keep the checkbox visually in sync only.
                  onCheckedChange={() => !isDisabled && toggle(row)}
                  onClick={e => e.stopPropagation()}
                  aria-label={row.name}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{row.name}</span>
                    {isLocked && (
                      <Badge variant="secondary" className="h-4 gap-1 px-1.5 text-[10px]">
                        <Lock className="h-2.5 w-2.5" />
                        {t('plan.downgrade.youOwner')}
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{row.email}</p>
                </div>
                {isSelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </div>
            )
          })}
        </div>

        {/* Reassurance footnote */}
        <p className="text-xs text-muted-foreground">{t('plan.downgrade.reassurance')}</p>
      </div>
    </FullScreenModal>
  )
}

export default DowngradeReconcileDialog
