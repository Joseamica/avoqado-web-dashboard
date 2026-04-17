/**
 * Issue Refund modal — Square-style.
 *
 * Two tabs:
 *   - "Reembolsar artículos"      (item-level refund — phase 2, shown as coming soon)
 *   - "Reembolsos por importe"    (amount refund — wired end-to-end here)
 *
 * Lives in pages/Payment because today it's only opened by the payment drawer.
 */

import api from '@/api'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Currency } from '@/utils/currency'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

type Tab = 'items' | 'amount'

type Reason = 'RETURNED_GOODS' | 'ACCIDENTAL_CHARGE' | 'CANCELLED_ORDER' | 'FRAUDULENT_CHARGE' | 'OTHER'

interface IssueRefundSheetProps {
  venueId: string
  paymentId: string
  /** Total refundable amount in decimal (payment total minus already-refunded) */
  maxRefundable: number
  /** Method label shown in the "Reembolsar a" row (e.g. "Efectivo") */
  methodLabel: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onRefunded: () => void
}

export function IssueRefundSheet({
  venueId,
  paymentId,
  maxRefundable,
  methodLabel,
  open,
  onOpenChange,
  onRefunded,
}: IssueRefundSheetProps) {
  const { t } = useTranslation('payment')
  const { t: tCommon } = useTranslation('common')
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [tab, setTab] = useState<Tab>('amount')
  const [amountStr, setAmountStr] = useState('')
  const [reason, setReason] = useState<Reason | ''>('')

  useEffect(() => {
    if (open) {
      setTab('amount')
      setAmountStr('')
      setReason('')
    }
  }, [open])

  const amount = useMemo(() => {
    const n = parseFloat(amountStr.replace(',', '.'))
    return isNaN(n) ? 0 : n
  }, [amountStr])

  const canSubmit = tab === 'amount' && amount > 0 && amount <= maxRefundable && !!reason

  const refundMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/api/v1/dashboard/venues/${venueId}/payments/${paymentId}/refund`, {
        amount: Math.round(amount * 100), // cents
        reason,
      })
      return res.data
    },
    onSuccess: () => {
      toast({ title: t('refund.success', { defaultValue: 'Reembolso emitido' }) })
      queryClient.invalidateQueries({ queryKey: ['payment', paymentId] })
      queryClient.invalidateQueries({ queryKey: ['refunds', paymentId] })
      queryClient.invalidateQueries({ queryKey: ['payments', venueId] })
      onRefunded()
    },
    onError: (err: any) => {
      toast({
        title: t('refund.error', { defaultValue: 'No se pudo emitir el reembolso' }),
        description: err?.response?.data?.message || err?.message,
        variant: 'destructive',
      })
    },
  })

  const reasons: { value: Reason; label: string }[] = [
    { value: 'RETURNED_GOODS', label: t('refund.reasons.returned', { defaultValue: 'Productos devueltos' }) },
    { value: 'ACCIDENTAL_CHARGE', label: t('refund.reasons.accidental', { defaultValue: 'Cargo accidental' }) },
    { value: 'CANCELLED_ORDER', label: t('refund.reasons.cancelled', { defaultValue: 'Pedido cancelado' }) },
    { value: 'FRAUDULENT_CHARGE', label: t('refund.reasons.fraudulent', { defaultValue: 'Cargo fraudulento' }) },
    { value: 'OTHER', label: t('refund.reasons.other', { defaultValue: 'Otro' }) },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 [&>button]:hidden overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border/60">
          <Button variant="secondary" size="icon" className="rounded-full h-9 w-9" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
          <h2 className="flex-1 text-center text-lg font-semibold pr-9">
            {t('refund.title', { defaultValue: 'Emitir reembolso' })}
          </h2>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 border-b border-border/60">
          <TabButton
            active={tab === 'items'}
            onClick={() => setTab('items')}
            label={t('refund.tabs.items', { defaultValue: 'Reembolsar artículos' })}
          />
          <TabButton
            active={tab === 'amount'}
            onClick={() => setTab('amount')}
            label={t('refund.tabs.amount', { defaultValue: 'Reembolsos por importe' })}
          />
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-5 max-h-[60vh] overflow-y-auto">
          {tab === 'items' ? (
            <div className="text-sm text-muted-foreground">
              <p>{t('refund.itemsComingSoon', { defaultValue: 'El reembolso por artículos llega pronto.' })}</p>
              <p className="mt-2">
                {t('refund.useAmountForNow', {
                  defaultValue: 'Por ahora, usa la pestaña "Reembolsos por importe".',
                })}
              </p>
            </div>
          ) : (
            <>
              <div>
                <h3 className="text-lg font-semibold">
                  {t('refund.amount.heading', { defaultValue: 'Selecciona el importe a reembolsar' })}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('refund.amount.note1', {
                    defaultValue:
                      'Al devolver un importe (en lugar de un artículo específico) puede haber discrepancias en tu inventario y en tus informes de ventas de artículos.',
                  })}
                </p>
              </div>

              <div className="rounded-lg border border-border/60 divide-y divide-border/60 text-sm">
                <Row
                  label={t('refund.amount.refundTo', { defaultValue: 'Reembolsar a' })}
                  value={<span className="text-muted-foreground">{methodLabel}</span>}
                />
                <div className="flex items-center">
                  <div className="w-1/3 px-4 py-3 bg-muted/30 text-muted-foreground">
                    {t('refund.amount.importe', { defaultValue: 'Importe' })}
                  </div>
                  <div className="flex-1 px-4 py-2 flex items-center gap-2">
                    <Input
                      inputMode="decimal"
                      placeholder="0,00 $"
                      value={amountStr}
                      onChange={e => setAmountStr(e.target.value)}
                      className="border-0 shadow-none focus-visible:ring-0 text-right"
                      autoFocus
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {Currency(maxRefundable)} {t('refund.amount.asMax', { defaultValue: 'como máximo' })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="w-1/3 px-4 py-3 bg-muted/30 text-muted-foreground">
                    {t('refund.amount.reason', { defaultValue: 'Motivo del reembolso' })}
                  </div>
                  <div className="flex-1 px-4 py-2">
                    <Select value={reason} onValueChange={v => setReason(v as Reason)}>
                      <SelectTrigger className="border-0 shadow-none focus:ring-0">
                        <SelectValue placeholder={t('refund.amount.selectReason', { defaultValue: 'Selecciona un motivo' })} />
                      </SelectTrigger>
                      <SelectContent>
                        {reasons.map(r => (
                          <SelectItem key={r.value} value={r.value}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {amount > maxRefundable && (
                <p className="text-sm text-destructive">
                  {t('refund.amount.exceeds', {
                    defaultValue: 'El importe excede el máximo reembolsable',
                  })}
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border/60">
          <Button variant="secondary" className="rounded-full" onClick={() => onOpenChange(false)}>
            {tCommon('cancel', { defaultValue: 'Cancelar' })}
          </Button>
          <Button
            className="rounded-full px-6 bg-foreground text-background hover:bg-foreground/90"
            disabled={!canSubmit || refundMutation.isPending}
            onClick={() => refundMutation.mutate()}
          >
            {refundMutation.isPending
              ? tCommon('processing', { defaultValue: 'Procesando...' })
              : t('refund.confirm', { defaultValue: 'Reembolsar' })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`py-3 text-sm transition-colors ${
        active
          ? 'border-2 border-foreground rounded-lg m-2 font-semibold'
          : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
      }`}
    >
      {label}
    </button>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center">
      <div className="w-1/3 px-4 py-3 bg-muted/30 text-muted-foreground text-sm">{label}</div>
      <div className="flex-1 px-4 py-3 text-sm">{value}</div>
    </div>
  )
}
