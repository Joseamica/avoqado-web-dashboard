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

const MAX_REASON = 300
/** Los bloqueos del servidor (`CASH_COUNT_<código>`) que tienen su texto en `detail.correctCount.blocked`. */
const BLOCK_CODES = new Set([
  'SHIFT_NOT_CLOSED',
  'EXTERNAL_POS',
  'NOT_COUNTED',
  'NO_LINKED_DRAWER',
  'DRAWER_NOT_CLOSED',
  'NO_SIGNED_DIFFERENCE',
  'COUNT_MISMATCH',
  'TOO_MANY',
])

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
  // Lo que el gerente vio al abrir. El detalle se recarga debajo (foco, socket, cobros): si la ventana leyera los props, la
  // vista previa y la llave «nadie lo cambió» se moverían a la corrección de otro gerente y la pisarían sin «recarga».
  const [seen] = useState(() => ({ countedCash, cashDifference, expectedAmount, correctionCount }))
  const [amountText, setAmountText] = useState(String(countedCash))
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false) // isPending es estado: dos clics en el mismo tick lo ven viejo

  const amount = amountText.trim() === '' ? NaN : Number(amountText)
  const validAmount =
    Number.isFinite(amount) && amount >= 0 && amount <= 99999999.99 && Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-6
  const sameAmount = validAmount && Math.round(amount * 100) === Math.round(seen.countedCash * 100)
  const trimmedReason = reason.trim()

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
        reason: trimmedReason,
        expectedCurrentCount: seen.countedCash,
        expectedResultingDifference: differenceAfterCorrection(seen.expectedAmount, amount),
        expectedCorrectionCount: seen.correctionCount,
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
      const block = typeof data?.code === 'string' && data.code.startsWith('CASH_COUNT_') ? data.code.slice('CASH_COUNT_'.length) : ''
      setError(
        data?.code === 'CASH_COUNT_CHANGED'
          ? t('detail.correctCount.changed')
          : BLOCK_CODES.has(block)
            ? t(`detail.correctCount.blocked.${block}`)
            : data?.message || e?.message || '',
      )
    },
  })

  const saving = mutation.isPending
  const canSave = validAmount && !sameAmount && trimmedReason.length >= 3 && trimmedReason.length <= MAX_REASON && !saving

  const submit = () => {
    if (!canSave || inFlight.current) return
    inFlight.current = true
    setError(null)
    mutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={o => !saving && onOpenChange(o)}>
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
              disabled={saving}
              onChange={e => setAmountText(e.target.value)}
            />
            {sameAmount && <p className="text-sm text-muted-foreground">{t('detail.correctCount.sameAmount')}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="correct-count-reason">{t('detail.correctCount.reason')}</Label>
            <Textarea
              id="correct-count-reason"
              value={reason}
              maxLength={MAX_REASON}
              disabled={saving}
              placeholder={t('detail.correctCount.reasonPlaceholder')}
              onChange={e => setReason(e.target.value)}
            />
          </div>
          {validAmount && (
            <p className="text-sm text-muted-foreground">
              {t('detail.correctCount.preview', {
                before: describe(seen.cashDifference),
                after: describe(differenceAfterCorrection(seen.expectedAmount, amount)),
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
