// src/components/billing/CancelPlanDialog.tsx
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { useVenueDateTime } from '@/utils/datetime'
import { applyRetentionOffer, cancelVenuePlan } from '@/services/features.service'

// ─── Types ─────────────────────────────────────────────────────────────────

type Step = 'reason' | 'offer' | 'confirm'

type CancelReason = 'tooExpensive' | 'notUsing' | 'missingFeature' | 'switching' | 'temporary' | 'other'

// ─── Countdown hook ─────────────────────────────────────────────────────────

function useCountdown(seconds: number) {
  const [remaining, setRemaining] = useState(seconds)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Reset and start whenever hook mounts (dialog opens to offer step)
  useEffect(() => {
    setRemaining(seconds)
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [seconds])

  const mins = String(Math.floor(remaining / 60)).padStart(2, '0')
  const secs = String(remaining % 60).padStart(2, '0')
  return `${mins}:${secs}`
}

// ─── Reason step ────────────────────────────────────────────────────────────

interface ReasonStepProps {
  reason: CancelReason | null
  setReason: (r: CancelReason) => void
  otherText: string
  setOtherText: (s: string) => void
  onKeep: () => void
  onContinue: () => void
}

function ReasonStep({ reason, setReason, otherText, setOtherText, onKeep, onContinue }: ReasonStepProps) {
  const { t } = useTranslation('billing')

  const reasons: CancelReason[] = ['tooExpensive', 'notUsing', 'missingFeature', 'switching', 'temporary', 'other']

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('plan.cancel.reason.title')}</DialogTitle>
        <DialogDescription>{t('plan.cancel.reason.subtitle')}</DialogDescription>
      </DialogHeader>

      <RadioGroup
        value={reason ?? ''}
        onValueChange={(v) => setReason(v as CancelReason)}
        className="flex flex-col gap-2"
      >
        {reasons.map((r) => (
          <div
            key={r}
            className="flex items-center gap-3 rounded-lg border border-input p-3 cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setReason(r)}
          >
            <RadioGroupItem value={r} id={`cancel-reason-${r}`} />
            <Label htmlFor={`cancel-reason-${r}`} className="cursor-pointer text-sm font-normal">
              {t(`plan.cancel.reason.options.${r}`)}
            </Label>
          </div>
        ))}
      </RadioGroup>

      {reason === 'other' && (
        <Textarea
          placeholder={t('plan.cancel.reason.otherPlaceholder')}
          value={otherText}
          onChange={(e) => setOtherText(e.target.value)}
          rows={2}
          className="resize-none"
        />
      )}

      <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground cursor-pointer"
          onClick={onContinue}
          disabled={!reason}
          data-tour="cancel-continue"
        >
          {t('plan.cancel.reason.continueCta')}
        </Button>
        <Button
          size="sm"
          onClick={onKeep}
          className="cursor-pointer"
          data-tour="cancel-keep"
        >
          {t('plan.cancel.reason.keepCta')}
        </Button>
      </DialogFooter>
    </>
  )
}

// ─── Offer step ─────────────────────────────────────────────────────────────

interface OfferStepProps {
  reason: CancelReason | null
  venueId: string
  onKeep: () => void
  onDecline: () => void
}

function OfferStep({ reason, venueId, onKeep, onDecline }: OfferStepProps) {
  const { t } = useTranslation('billing')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const timer = useCountdown(900) // 15:00

  const showPause = reason === 'notUsing' || reason === 'temporary'

  const retentionMutation = useMutation({
    mutationFn: (offer: 'discount' | 'pause') => applyRetentionOffer(venueId, offer),
    onSuccess: (_, offer) => {
      queryClient.invalidateQueries({ queryKey: ['venuePlan', venueId] })
      toast({
        title: offer === 'pause' ? t('plan.cancel.offer.pauseSuccess') : t('plan.cancel.offer.discountSuccess'),
      })
      onKeep()
    },
    onError: () => {
      toast({ title: t('plan.cancel.offer.error'), variant: 'destructive' })
    },
  })

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('plan.cancel.offer.title')}</DialogTitle>
      </DialogHeader>

      <div className="rounded-xl border border-input bg-muted/30 p-4 space-y-3">
        <p className="text-sm font-medium leading-relaxed">
          {t('plan.cancel.offer.discountBody')}
        </p>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {t('plan.cancel.offer.discountBadge')}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          ⏳ {t('plan.cancel.offer.timerLabel', { timer })}
        </p>
      </div>

      {showPause && (
        <p className="text-sm text-center">
          <button
            type="button"
            className="text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors cursor-pointer text-xs"
            onClick={() => retentionMutation.mutate('pause')}
            disabled={retentionMutation.isPending}
          >
            {t('plan.cancel.offer.pauseCta')}
          </button>
        </p>
      )}

      <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground cursor-pointer"
          onClick={onDecline}
          disabled={retentionMutation.isPending}
          data-tour="cancel-continue"
        >
          {t('plan.cancel.offer.declineCta')}
        </Button>
        <Button
          size="sm"
          onClick={() => retentionMutation.mutate('discount')}
          disabled={retentionMutation.isPending}
          className="cursor-pointer"
          data-tour="cancel-accept-offer"
        >
          {retentionMutation.isPending ? t('plan.cancel.offer.applying') : t('plan.cancel.offer.acceptCta')}
        </Button>
      </DialogFooter>
    </>
  )
}

// ─── Confirm step ────────────────────────────────────────────────────────────

interface ConfirmStepProps {
  venueId: string
  planName: string | null
  currentPeriodEnd: string | null
  onKeep: () => void
  onClose: () => void
}

function ConfirmStep({ venueId, planName, currentPeriodEnd, onKeep, onClose }: ConfirmStepProps) {
  const { t } = useTranslation('billing')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { formatDate } = useVenueDateTime()

  const formattedDate = currentPeriodEnd
    ? formatDate(currentPeriodEnd)
    : null

  const cancelMutation = useMutation({
    mutationFn: () => cancelVenuePlan(venueId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venuePlan', venueId] })
      queryClient.invalidateQueries({ queryKey: ['venueFeatures', venueId] })
      toast({ title: t('plan.cancel.confirm.successToast') })
      onClose()
    },
    onError: () => {
      toast({ title: t('plan.cancel.confirm.errorToast'), variant: 'destructive' })
    },
  })

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('plan.cancel.confirm.title')}</DialogTitle>
        <DialogDescription>
          {formattedDate
            ? t('plan.cancel.confirm.body', { planName: planName ?? '', date: formattedDate })
            : t('plan.cancel.confirm.bodyNoDate', { planName: planName ?? '' })}
        </DialogDescription>
      </DialogHeader>

      <div className="rounded-xl border border-input bg-muted/30 p-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
          {t('plan.cancel.confirm.loseLabel')}
        </p>
        <ul className="space-y-1">
          {(t('plan.cancel.confirm.loseItems', { returnObjects: true }) as string[]).map((item) => (
            <li key={item} className="text-sm flex items-start gap-1.5">
              <span className="text-destructive mt-0.5">✕</span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive cursor-pointer"
          onClick={() => cancelMutation.mutate()}
          disabled={cancelMutation.isPending}
          data-tour="cancel-confirm"
        >
          {cancelMutation.isPending ? t('plan.cancel.confirm.canceling') : t('plan.cancel.confirm.cancelCta')}
        </Button>
        <Button
          size="sm"
          onClick={onKeep}
          className="cursor-pointer"
          data-tour="cancel-keep"
        >
          {t('plan.cancel.confirm.keepCta')}
        </Button>
      </DialogFooter>
    </>
  )
}

// ─── Main dialog ─────────────────────────────────────────────────────────────

export interface CancelPlanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  venueId: string
  planName: string | null
  currentPeriodEnd: string | null
}

export function CancelPlanDialog({ open, onOpenChange, venueId, planName, currentPeriodEnd }: CancelPlanDialogProps) {
  const [step, setStep] = useState<Step>('reason')
  const [reason, setReason] = useState<CancelReason | null>(null)
  const [otherText, setOtherText] = useState('')

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep('reason')
      setReason(null)
      setOtherText('')
    }
  }, [open])

  const handleKeep = () => onOpenChange(false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {step === 'reason' && (
          <ReasonStep
            reason={reason}
            setReason={setReason}
            otherText={otherText}
            setOtherText={setOtherText}
            onKeep={handleKeep}
            onContinue={() => setStep('offer')}
          />
        )}
        {step === 'offer' && (
          <OfferStep
            reason={reason}
            venueId={venueId}
            onKeep={handleKeep}
            onDecline={() => setStep('confirm')}
          />
        )}
        {step === 'confirm' && (
          <ConfirmStep
            venueId={venueId}
            planName={planName}
            currentPeriodEnd={currentPeriodEnd}
            onKeep={handleKeep}
            onClose={handleKeep}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

export default CancelPlanDialog
