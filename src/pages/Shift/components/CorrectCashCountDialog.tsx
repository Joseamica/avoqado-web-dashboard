import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import api from '@/api'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { Currency } from '@/utils/currency'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  venueId: string
  shiftId: string
  countedCash: number
  cashDifference: number
  expectedAmount: number
  correctionCount: number
}

/** Diferencia firmada en centavos enteros (evita 1000.1 - 1000.3 = -0.1999...). */
export function differenceAfterCorrection(expectedAmount: number, newCount: number): number {
  return (Math.round(newCount * 100) - Math.round(expectedAmount * 100)) / 100
}

export function CorrectCashCountDialog({
  open,
  onOpenChange,
  venueId,
  shiftId,
  countedCash,
  cashDifference,
  expectedAmount,
  correctionCount,
}: Props) {
  const { t } = useTranslation('shifts')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [amountText, setAmountText] = useState(String(countedCash))
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false) // isPending es estado: dos clics en el mismo tick lo ven viejo

  const amount = amountText.trim() === '' ? NaN : Number(amountText)
  const validAmount =
    Number.isFinite(amount) && amount >= 0 && amount <= 99999999.99 && Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-6
  const sameAmount = validAmount && Math.round(amount * 100) === Math.round(countedCash * 100)

  const describe = (diff: number) =>
    diff === 0
      ? t('detail.correctCount.balanced')
      : diff > 0
        ? t('detail.correctCount.over', { amount: Currency(diff) })
        : t('detail.correctCount.short', { amount: Currency(Math.abs(diff)) })

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/api/v1/dashboard/venues/${venueId}/shifts/${shiftId}/cash-count-correction`, {
        countedCash: amount,
        reason: reason.trim(),
        expectedCurrentCount: countedCash,
        expectedResultingDifference: differenceAfterCorrection(expectedAmount, amount),
        expectedCorrectionCount: correctionCount,
      })
      return res.data
    },
    onSettled: () => {
      inFlight.current = false
    },
    onSuccess: () => {
      toast({ title: t('detail.correctCount.saved') })
      queryClient.invalidateQueries({ queryKey: ['shift', venueId, shiftId] })
      queryClient.invalidateQueries({
        predicate: query => query.queryKey[0] === 'shifts' && query.queryKey[1] === venueId,
      })
      onOpenChange(false)
    },
    onError: (e: any) => {
      const data = e?.response?.data
      setError(data?.code === 'CASH_COUNT_CHANGED' ? t('detail.correctCount.changed') : data?.message || e?.message || '')
    },
  })

  const canSave = validAmount && !sameAmount && reason.trim().length >= 3 && !mutation.isPending

  const submit = () => {
    if (!canSave || inFlight.current) return
    inFlight.current = true
    setError(null)
    mutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('detail.correctCount.title')}</DialogTitle>
          <DialogDescription className="sr-only">{t('detail.correctCount.title')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="correct-count-amount">{t('detail.correctCount.amount')}</Label>
            <Input
              id="correct-count-amount"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={amountText}
              onChange={e => setAmountText(e.target.value)}
            />
            {sameAmount && <p className="text-sm text-muted-foreground">{t('detail.correctCount.sameAmount')}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="correct-count-reason">{t('detail.correctCount.reason')}</Label>
            <Textarea
              id="correct-count-reason"
              value={reason}
              placeholder={t('detail.correctCount.reasonPlaceholder')}
              onChange={e => setReason(e.target.value)}
            />
          </div>
          {validAmount && (
            <p className="text-sm text-muted-foreground">
              {t('detail.correctCount.preview', {
                before: describe(cashDifference),
                after: describe(differenceAfterCorrection(expectedAmount, amount)),
              })}
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={!canSave}>
            {t('detail.correctCount.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
