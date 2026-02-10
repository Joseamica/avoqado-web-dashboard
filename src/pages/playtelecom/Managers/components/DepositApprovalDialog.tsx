/**
 * DepositApprovalDialog - Validates bank deposit receipt when approving a time entry
 *
 * Business flow:
 * 1. Promoter sells SIMs, collects cash
 * 2. At checkout, promoter deposits cash at bank and uploads receipt photo
 * 3. Operations reviews the receipt photo and enters the verified deposit amount
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Check, Loader2, ImageOff, Info } from 'lucide-react'
import type { AttendanceEntry } from './AttendanceLog'

interface DepositApprovalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry: AttendanceEntry | null
  expectedAmount: number
  onConfirm: (id: string, amount: number) => void
  isPending: boolean
}

export function DepositApprovalDialog({
  open,
  onOpenChange,
  entry,
  expectedAmount,
  onConfirm,
  isPending,
}: DepositApprovalDialogProps) {
  const { t } = useTranslation('playtelecom')
  const [amount, setAmount] = useState('')

  // Reset input when entry changes — no pre-fill, hint guides the user
  useEffect(() => {
    setAmount('')
  }, [entry])

  const handleConfirm = () => {
    if (!entry?.timeEntryId) return
    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount < 0) return
    onConfirm(entry.timeEntryId, numAmount)
  }

  const parsedAmount = parseFloat(amount)
  const isValid = !isNaN(parsedAmount) && parsedAmount >= 0

  const formatMoney = (v: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(v)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" hasTitle>
        <DialogHeader>
          <DialogTitle>
            {t('managers.deposit.title', { defaultValue: 'Verificar Deposito Bancario' })}
          </DialogTitle>
          <DialogDescription>
            {t('managers.deposit.description', {
              defaultValue: 'Verifica la foto del recibo bancario e ingresa el monto depositado.',
            })}
          </DialogDescription>
        </DialogHeader>

        {entry && (
          <div className="space-y-4">
            {/* Promoter info bar */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <p className="font-semibold text-sm">{entry.promoterName}</p>
                <p className="text-xs text-muted-foreground">{entry.storeName}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">
                  {entry.clockIn} — {entry.clockOut || '...'}
                </p>
              </div>
            </div>

            {/* Cash sales hint */}
            {expectedAmount > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <Info className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-300">
                  {t('managers.deposit.cashHint', {
                    defaultValue: 'En este turno, {{name}} vendio en efectivo {{amount}}',
                    name: entry.promoterName,
                    amount: formatMoney(expectedAmount),
                  })}
                </p>
              </div>
            )}

            {/* Bank receipt photo — main element */}
            {entry.checkOutPhotoUrl ? (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase">
                  {t('managers.deposit.receiptPhoto', { defaultValue: 'Foto del Recibo Bancario' })}
                </Label>
                <img
                  src={entry.checkOutPhotoUrl}
                  alt={t('managers.deposit.receiptAlt', { defaultValue: 'Recibo bancario' })}
                  className="w-full max-h-[300px] object-contain rounded-lg border border-border bg-muted/30"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 rounded-lg border border-dashed border-border bg-muted/20">
                <ImageOff className="w-8 h-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">
                  {t('managers.deposit.noReceipt', { defaultValue: 'Sin foto de recibo bancario' })}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  {t('managers.deposit.noReceiptHint', { defaultValue: 'El promotor no subio evidencia del deposito' })}
                </p>
              </div>
            )}

            {/* Deposit amount input */}
            <div className="space-y-2">
              <Label htmlFor="deposit-amount">
                {t('managers.deposit.amountLabel', { defaultValue: 'Monto Verificado del Deposito ($)' })}
              </Label>
              <Input
                id="deposit-amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                data-autofocus
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t('managers.deposit.cancel', { defaultValue: 'Cancelar' })}
          </Button>
          <Button onClick={handleConfirm} disabled={isPending || !isValid}>
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Check className="w-4 h-4 mr-2" />
            )}
            {t('managers.deposit.confirm', { defaultValue: 'Aprobar y Registrar' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
