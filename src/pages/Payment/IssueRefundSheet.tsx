/**
 * Issue Refund modal — Square-style.
 *
 * Two tabs:
 *   - "Reembolsar artículos"    multi-step: items → restock → confirm
 *   - "Reembolsos por importe"  single step: amount + reason
 *
 * Lives in pages/Payment because today it's only opened by the payment drawer.
 */

import api from '@/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Currency } from '@/utils/currency'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

type Tab = 'items' | 'amount'
type ItemStep = 'select' | 'restock' | 'confirm'
type Reason = 'RETURNED_GOODS' | 'ACCIDENTAL_CHARGE' | 'CANCELLED_ORDER' | 'FRAUDULENT_CHARGE' | 'OTHER'

export interface RefundableItem {
  id: string // orderItem id
  productId: string | null
  productName: string | null
  quantity: number
  unitPrice: number
  total: number
  /** Whether this product has inventory tracking enabled (for the restock step) */
  trackInventory?: boolean
  venueName?: string
}

interface IssueRefundSheetProps {
  venueId: string
  paymentId: string
  /** Total refundable amount in decimal (payment total minus already-refunded) */
  maxRefundable: number
  /** Method label shown in the "Reembolsar a" row (e.g. "Efectivo") */
  methodLabel: string
  /** Order items available to refund; omit or pass [] to disable the items tab */
  orderItems?: RefundableItem[]
  /** Venue name shown in the restock step */
  venueName?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onRefunded: () => void
}

export function IssueRefundSheet({
  venueId,
  paymentId,
  maxRefundable,
  methodLabel,
  orderItems = [],
  venueName,
  open,
  onOpenChange,
  onRefunded,
}: IssueRefundSheetProps) {
  const { t } = useTranslation('payment')
  const { t: tCommon } = useTranslation('common')
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [tab, setTab] = useState<Tab>('amount')
  const [itemStep, setItemStep] = useState<ItemStep>('select')
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())
  const [restockItemIds, setRestockItemIds] = useState<Set<string>>(new Set())
  const [amountStr, setAmountStr] = useState('')
  const [reason, setReason] = useState<Reason | ''>('')

  useEffect(() => {
    if (open) {
      setTab(orderItems.length > 0 ? 'items' : 'amount')
      setItemStep('select')
      setSelectedItemIds(new Set())
      setRestockItemIds(new Set())
      setAmountStr('')
      setReason('')
    }
  }, [open, orderItems.length])

  // Amount tab parsing
  const parsedAmount = useMemo(() => {
    const n = parseFloat(amountStr.replace(',', '.'))
    return isNaN(n) ? 0 : n
  }, [amountStr])

  // Items tab computed
  const selectedItems = useMemo(
    () => orderItems.filter(i => selectedItemIds.has(i.id)),
    [orderItems, selectedItemIds],
  )
  const itemsRefundAmount = useMemo(
    () => Math.round(selectedItems.reduce((s, i) => s + i.total, 0) * 100) / 100,
    [selectedItems],
  )
  const restockableItems = useMemo(
    () => selectedItems.filter(i => !!i.trackInventory && !!i.productId),
    [selectedItems],
  )

  const refundMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = { reason }
      if (tab === 'amount') {
        body.amount = Math.round(parsedAmount * 100)
      } else {
        body.items = selectedItems.map(i => ({ orderItemId: i.id })) // full-qty refund
        if (restockItemIds.size > 0) {
          body.restockItemIds = [...restockItemIds].filter(id =>
            selectedItemIds.has(id),
          )
        }
      }
      const res = await api.post(
        `/api/v1/dashboard/venues/${venueId}/payments/${paymentId}/refund`,
        body,
      )
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
    { value: 'RETURNED_GOODS', label: t('refund.reasons.RETURNED_GOODS', { defaultValue: 'Productos devueltos' }) },
    { value: 'ACCIDENTAL_CHARGE', label: t('refund.reasons.ACCIDENTAL_CHARGE', { defaultValue: 'Cargo accidental' }) },
    { value: 'CANCELLED_ORDER', label: t('refund.reasons.CANCELLED_ORDER', { defaultValue: 'Pedido cancelado' }) },
    { value: 'FRAUDULENT_CHARGE', label: t('refund.reasons.FRAUDULENT_CHARGE', { defaultValue: 'Cargo fraudulento' }) },
    { value: 'OTHER', label: t('refund.reasons.OTHER', { defaultValue: 'Otro' }) },
  ]

  // --- Footer state machine ---
  const itemsCanProceedSelect = selectedItemIds.size > 0 && itemsRefundAmount > 0 && itemsRefundAmount <= maxRefundable
  const canFinalConfirm =
    !!reason &&
    (tab === 'amount'
      ? parsedAmount > 0 && parsedAmount <= maxRefundable
      : itemsCanProceedSelect)

  const onNextFromSelect = () => {
    if (restockableItems.length > 0) {
      // Default restock: all restockable items checked
      setRestockItemIds(new Set(restockableItems.map(i => i.id)))
      setItemStep('restock')
    } else {
      setItemStep('confirm')
    }
  }

  const toggleItem = (id: string) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const toggleRestock = (id: string) => {
    setRestockItemIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 [&>button]:hidden overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border/60">
          {tab === 'items' && itemStep !== 'select' ? (
            <Button
              variant="secondary"
              size="icon"
              className="rounded-full h-9 w-9"
              onClick={() => setItemStep(itemStep === 'confirm' && restockableItems.length > 0 ? 'restock' : 'select')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="secondary" size="icon" className="rounded-full h-9 w-9" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          )}
          <h2 className="flex-1 text-center text-lg font-semibold pr-9">
            {tab === 'items' && itemStep === 'restock'
              ? t('refund.restock.title', { defaultValue: 'Reabastecer existencias' })
              : tab === 'items' && itemStep === 'confirm'
                ? t('refund.confirmTitle', {
                    defaultValue: `Reembolso de ${Currency(itemsRefundAmount)}`,
                    amount: Currency(itemsRefundAmount),
                  })
                : t('refund.title', { defaultValue: 'Emitir reembolso' })}
          </h2>
        </div>

        {/* Tabs (hidden on step 2/3 of items flow to avoid accidental switch) */}
        {!(tab === 'items' && itemStep !== 'select') && (
          <div className="grid grid-cols-2 border-b border-border/60">
            <TabButton
              active={tab === 'items'}
              disabled={orderItems.length === 0}
              onClick={() => setTab('items')}
              label={t('refund.tabs.items', { defaultValue: 'Reembolsar artículos' })}
            />
            <TabButton
              active={tab === 'amount'}
              onClick={() => setTab('amount')}
              label={t('refund.tabs.amount', { defaultValue: 'Reembolsos por importe' })}
            />
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-6 space-y-5 max-h-[60vh] overflow-y-auto">
          {tab === 'items' && itemStep === 'select' && (
            <ItemsSelectBody
              items={orderItems}
              selectedIds={selectedItemIds}
              onToggle={toggleItem}
              t={t}
            />
          )}

          {tab === 'items' && itemStep === 'restock' && (
            <RestockBody
              items={restockableItems}
              selectedIds={restockItemIds}
              onToggle={toggleRestock}
              venueName={venueName}
              t={t}
            />
          )}

          {tab === 'items' && itemStep === 'confirm' && (
            <ConfirmBody
              amountToRefund={itemsRefundAmount}
              methodLabel={methodLabel}
              reason={reason}
              onReasonChange={setReason}
              reasons={reasons}
              t={t}
            />
          )}

          {tab === 'amount' && (
            <AmountBody
              amountStr={amountStr}
              onAmountChange={setAmountStr}
              maxRefundable={maxRefundable}
              methodLabel={methodLabel}
              reason={reason}
              onReasonChange={setReason}
              reasons={reasons}
              overLimit={parsedAmount > maxRefundable}
              t={t}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-border/60">
          {tab === 'items' && itemStep === 'restock' && (
            <Button
              variant="secondary"
              className="rounded-full"
              onClick={() => {
                setRestockItemIds(new Set())
                setItemStep('confirm')
              }}
            >
              {t('refund.restock.skip', { defaultValue: 'Omitir' })}
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="secondary" className="rounded-full" onClick={() => onOpenChange(false)}>
            {tCommon('cancel', { defaultValue: 'Cancelar' })}
          </Button>

          {tab === 'items' && itemStep === 'select' && (
            <Button
              className="rounded-full px-6 bg-foreground text-background hover:bg-foreground/90"
              disabled={!itemsCanProceedSelect}
              onClick={onNextFromSelect}
            >
              {t('refund.tabs.items', { defaultValue: 'Reembolsar artículos' })}
            </Button>
          )}

          {tab === 'items' && itemStep === 'restock' && (
            <Button
              className="rounded-full px-6 bg-foreground text-background hover:bg-foreground/90"
              onClick={() => setItemStep('confirm')}
            >
              {t('refund.restock.confirm', { defaultValue: 'Reabastecer existencias' })}
            </Button>
          )}

          {((tab === 'items' && itemStep === 'confirm') || tab === 'amount') && (
            <Button
              className="rounded-full px-6 bg-foreground text-background hover:bg-foreground/90"
              disabled={!canFinalConfirm || refundMutation.isPending}
              onClick={() => refundMutation.mutate()}
            >
              {refundMutation.isPending
                ? tCommon('processing', { defaultValue: 'Procesando...' })
                : t('refund.confirm', { defaultValue: 'Reembolsar' })}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ==========================================================================
// Step bodies
// ==========================================================================

function ItemsSelectBody({
  items,
  selectedIds,
  onToggle,
  t,
}: {
  items: RefundableItem[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
  t: (k: string, o?: any) => string
}) {
  return (
    <>
      <div>
        <h3 className="text-lg font-semibold">
          {t('refund.items.heading', { defaultValue: 'Selecciona los artículos a reembolsar' })}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {t('refund.items.note', {
            defaultValue:
              'El importe del artículo incluye impuestos y descuentos, si aplica. La comisión del empleado obtenida de la venta original no será modificada.',
          })}
        </p>
      </div>

      <div className="rounded-lg border border-border/60 divide-y divide-border/60">
        <div className="flex items-center justify-between px-4 py-3 text-sm font-medium">
          <span>{t('refund.items.column.item', { defaultValue: 'Artículos' })}</span>
          <span>{t('refund.items.column.amount', { defaultValue: 'Importe' })}</span>
        </div>
        {items.map(i => (
          <label
            key={i.id}
            className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30"
          >
            <Checkbox
              className="mt-0.5"
              checked={selectedIds.has(i.id)}
              onCheckedChange={() => onToggle(i.id)}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {i.quantity > 1 && (
                  <Badge variant="secondary" className="font-medium shrink-0">
                    {i.quantity}x
                  </Badge>
                )}
                <span className="font-medium">{i.productName || t('refund.items.customLabel', { defaultValue: 'Importe personalizado' })}</span>
              </div>
              {i.quantity > 1 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {Currency(i.unitPrice)} {t('refund.items.each', { defaultValue: 'c/u' })}
                </p>
              )}
            </div>
            <span className="font-medium whitespace-nowrap">{Currency(i.total)}</span>
          </label>
        ))}
      </div>
    </>
  )
}

function RestockBody({
  items,
  selectedIds,
  onToggle,
  venueName,
  t,
}: {
  items: RefundableItem[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
  venueName?: string
  t: (k: string, o?: any) => string
}) {
  return (
    <>
      <div>
        <h3 className="text-lg font-semibold">
          {t('refund.restock.heading', { defaultValue: 'Seleccionar artículos para reabastecer' })}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {t('refund.restock.note', {
            defaultValue: `Los artículos se reabastecerán en el lugar de compra original: ${venueName ?? ''}`,
            venue: venueName ?? '',
          })}
        </p>
      </div>

      <div className="rounded-lg border border-border/60 divide-y divide-border/60">
        <div className="flex items-center justify-between px-4 py-3 text-sm font-medium">
          <span>{t('refund.items.column.item', { defaultValue: 'Artículos' })}</span>
          <span>{t('refund.items.column.amount', { defaultValue: 'Importe' })}</span>
        </div>
        {items.map(i => (
          <label
            key={i.id}
            className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30"
          >
            <Checkbox
              className="mt-0.5"
              checked={selectedIds.has(i.id)}
              onCheckedChange={() => onToggle(i.id)}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {i.quantity > 1 && (
                  <Badge variant="secondary" className="font-medium shrink-0">
                    {i.quantity}x
                  </Badge>
                )}
                <span className="font-medium">{i.productName}</span>
              </div>
            </div>
            <span className="font-medium whitespace-nowrap">{Currency(i.total)}</span>
          </label>
        ))}
      </div>
    </>
  )
}

function ConfirmBody({
  amountToRefund,
  methodLabel,
  reason,
  onReasonChange,
  reasons,
  t,
}: {
  amountToRefund: number
  methodLabel: string
  reason: Reason | ''
  onReasonChange: (r: Reason) => void
  reasons: { value: Reason; label: string }[]
  t: (k: string, o?: any) => string
}) {
  return (
    <>
      <div>
        <h3 className="text-lg font-semibold">
          {t('refund.confirmHeading', { defaultValue: 'Selecciona el motivo del reembolso' })}
        </h3>
      </div>
      <div className="rounded-lg border border-border/60 divide-y divide-border/60 text-sm">
        <Row label={t('refund.amount.refundTo', { defaultValue: 'Reembolsar a' })} value={<span>{methodLabel}</span>} />
        <Row label={t('refund.amount.importe', { defaultValue: 'Importe' })} value={<span>{Currency(amountToRefund)}</span>} />
        <div className="flex items-center">
          <div className="w-1/3 px-4 py-3 bg-muted/30 text-muted-foreground">
            {t('refund.amount.reason', { defaultValue: 'Motivo del reembolso' })}
          </div>
          <div className="flex-1 px-4 py-2">
            <Select value={reason} onValueChange={v => onReasonChange(v as Reason)}>
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
    </>
  )
}

function AmountBody({
  amountStr,
  onAmountChange,
  maxRefundable,
  methodLabel,
  reason,
  onReasonChange,
  reasons,
  overLimit,
  t,
}: {
  amountStr: string
  onAmountChange: (s: string) => void
  maxRefundable: number
  methodLabel: string
  reason: Reason | ''
  onReasonChange: (r: Reason) => void
  reasons: { value: Reason; label: string }[]
  overLimit: boolean
  t: (k: string, o?: any) => string
}) {
  return (
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
              onChange={e => onAmountChange(e.target.value)}
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
            <Select value={reason} onValueChange={v => onReasonChange(v as Reason)}>
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

      {overLimit && (
        <p className="text-sm text-destructive">
          {t('refund.amount.exceeds', { defaultValue: 'El importe excede el máximo reembolsable' })}
        </p>
      )}
    </>
  )
}

function TabButton({
  active,
  onClick,
  label,
  disabled,
}: {
  active: boolean
  onClick: () => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`py-3 text-sm transition-colors ${
        active
          ? 'border-2 border-foreground rounded-lg m-2 font-semibold'
          : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed'
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
