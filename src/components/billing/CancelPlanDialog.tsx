// src/components/billing/CancelPlanDialog.tsx
//
// Spec §4.4: one step. Why (optional), a comment, and two equal buttons — "cancel" on the left, "keep my plan" on the
// right and focused (the safe default). It writes nothing: the caller runs the operation (classic downgrade, contract
// cancellation) with what this returns. The stay offer shows only for classic plans.
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { CancellationInput, CancellationReason } from '@/services/features.service'

/** The seven reasons of spec §4.4: UI id → the server's reason, by exact name. */
// eslint-disable-next-line react-refresh/only-export-components -- reasons list shared with its tests and the page
export const CANCEL_REASONS = [
  ['tooExpensive', 'TOO_EXPENSIVE'],
  ['notUsing', 'UNUSED'],
  ['missingFeature', 'MISSING_FEATURES'],
  ['tooComplex', 'TOO_COMPLEX'],
  ['switching', 'SWITCHED_SERVICE'],
  ['temporary', 'TEMPORARY'],
  ['other', 'OTHER'],
] as const satisfies ReadonlyArray<readonly [string, CancellationReason]>

export type CancelTarget =
  | { kind: 'PLAN'; tierName: string; until: string | null; classic: boolean; retentionOfferEligible: boolean; pauseOfferEligible: boolean }
  | { kind: 'CONTRACT'; name: string; until: string | null }

export interface CancelPlanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: CancelTarget
  /** The Free seat rule, when a plan ends and the venue drops to Gratis (spec §4.3). */
  seatNotice?: 'CHOOSE' | 'AUTOMATIC' | null
  note?: string | null
  pending?: boolean
  error?: string | null
  onConfirm: (input: CancellationInput) => void
  /** Classic plans only: stay with a discount or a pause instead. */
  onAcceptOffer?: (offer: 'discount' | 'pause') => void
  offerPending?: boolean
}

const COMMENT_MAX = 500

export function CancelPlanDialog({
  open,
  onOpenChange,
  target,
  seatNotice = null,
  note = null,
  pending = false,
  error = null,
  onConfirm,
  onAcceptOffer,
  offerPending = false,
}: CancelPlanDialogProps) {
  const { t } = useTranslation('billing')
  const [reason, setReason] = useState<CancellationReason | undefined>()
  const [comment, setComment] = useState('')
  useEffect(() => {
    if (open) {
      setReason(undefined)
      setComment('')
    }
  }, [open])
  const busy = pending || offerPending
  const isPlan = target.kind === 'PLAN'
  const subtitle =
    target.kind === 'PLAN'
      ? target.until
        ? t('plan.cancel.reason.subtitlePlan', { tier: target.tierName, date: target.until })
        : t('plan.cancel.reason.subtitlePlanNoDate', { tier: target.tierName })
      : target.until
        ? t('plan.cancel.reason.subtitleContract', { name: target.name, date: target.until })
        : t('plan.cancel.reason.subtitleContractNoDate', { name: target.name })
  const offer =
    target.kind === 'PLAN' && target.classic && onAcceptOffer
      ? reason === 'TOO_EXPENSIVE' && target.retentionOfferEligible
        ? 'discount'
        : reason === 'TEMPORARY' && target.pauseOfferEligible
          ? 'pause'
          : null
      : null
  const confirm = () => {
    const trimmed = comment.trim().slice(0, COMMENT_MAX)
    onConfirm({ ...(reason ? { reason } : {}), ...(trimmed ? { comment: trimmed } : {}) })
  }

  return (
    <Dialog open={open} onOpenChange={value => !busy && onOpenChange(value)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('plan.cancel.reason.title')}</DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>
        <RadioGroup value={reason ?? ''} onValueChange={value => setReason(value as CancellationReason)} className="gap-2">
          {CANCEL_REASONS.map(([id, value]) => (
            <Label
              key={id}
              htmlFor={`cancel-reason-${id}`}
              data-tour={`cancel-reason-${id}`}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-lg border border-input px-3 py-2.5 text-sm font-normal',
                reason === value && 'border-foreground',
              )}
            >
              <RadioGroupItem id={`cancel-reason-${id}`} value={value} />
              {t(`plan.cancel.reason.options.${id}`)}
            </Label>
          ))}
        </RadioGroup>
        {offer && (
          <div className="space-y-2 rounded-lg border border-input bg-muted/40 p-3 text-sm" data-tour="cancel-offer">
            <p>{t(offer === 'discount' ? 'plan.cancel.offer.discountBody' : 'plan.cancel.offer.pauseBody')}</p>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onAcceptOffer!(offer)} data-tour="cancel-accept-offer">
              {offerPending
                ? t('plan.cancel.offer.applying')
                : t(offer === 'discount' ? 'plan.cancel.offer.acceptCta' : 'plan.cancel.offer.pauseCta')}
            </Button>
          </div>
        )}
        <Textarea
          value={comment}
          onChange={event => setComment(event.target.value.slice(0, COMMENT_MAX))}
          maxLength={COMMENT_MAX}
          rows={3}
          placeholder={t('plan.cancel.reason.otherPlaceholder')}
          aria-label={t('plan.cancel.reason.otherPlaceholder')}
          data-tour="cancel-comment"
        />
        {seatNotice && (
          <p className="text-xs text-muted-foreground" data-tour="cancel-seat-notice">
            {t(seatNotice === 'CHOOSE' ? 'plan.seatNotice.choose' : 'plan.seatNotice.automatic')}
          </p>
        )}
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter className="grid grid-cols-2 gap-2 sm:space-x-0">
          <Button
            variant="outline"
            className="h-auto min-h-9 whitespace-normal bg-muted"
            disabled={busy}
            onClick={confirm}
            data-tour="cancel-confirm"
          >
            {pending
              ? t('plan.cancel.confirm.canceling')
              : t(isPlan ? 'plan.cancel.confirm.cancelCta' : 'plan.cancel.reason.confirmContractCta')}
          </Button>
          <Button
            autoFocus
            className="h-auto min-h-9 whitespace-normal"
            disabled={busy}
            onClick={() => onOpenChange(false)}
            data-tour="cancel-keep"
          >
            {t(isPlan ? 'plan.cancel.reason.keepCta' : 'plan.cancel.reason.keepContractCta')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default CancelPlanDialog
