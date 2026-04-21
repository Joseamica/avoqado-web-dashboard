/**
 * Slim Square-style body for the payment drawer.
 *
 * Lives next to Payments.tsx as a plain sub-component (not a route).
 * Rendered inside the <Sheet> that Payments.tsx mounts when the URL matches
 * /payments/:paymentId.
 */

import api from '@/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { RECEIPT_PATHS } from '@/constants/receipt'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { Currency } from '@/utils/currency'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MoreHorizontal, Send } from 'lucide-react'
import { DateTime } from 'luxon'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AddCustomerSheet, Customer, CustomerFormSheet } from './CustomerSheets'
import { IssueRefundSheet } from './IssueRefundSheet'

interface PaymentDrawerContentProps {
  paymentId: string
  onClose: () => void
  venueTimezone: string
}

export function PaymentDrawerContent({ paymentId, onClose, venueTimezone }: PaymentDrawerContentProps) {
  const { t } = useTranslation('payment')
  const { t: tCommon } = useTranslation('common')
  const { toast } = useToast()
  const { venueId, venue } = useCurrentVenue()
  const queryClient = useQueryClient()

  const [email, setEmail] = useState('')
  const [sendOpen, setSendOpen] = useState(false)

  // Customer flow state
  const [addCustomerOpen, setAddCustomerOpen] = useState(false)
  const [customerFormOpen, setCustomerFormOpen] = useState(false)
  const [customerFormInitial, setCustomerFormInitial] = useState<Customer | null>(null)

  // Refund flow state
  const [refundOpen, setRefundOpen] = useState(false)

  const { data: payment, isLoading } = useQuery({
    queryKey: ['payment', paymentId],
    queryFn: async () => (await api.get(`/api/v1/dashboard/venues/${venueId}/payments/${paymentId}`)).data,
    enabled: !!paymentId && !!venueId,
  })

  const { data: receipts = [] } = useQuery<any[]>({
    queryKey: ['receipts', paymentId],
    queryFn: async () => {
      try {
        const res = await api.get(`/api/v1/dashboard/venues/${venueId}/payments/${paymentId}/receipts`)
        return Array.isArray(res.data) ? res.data : []
      } catch (err: any) {
        if (err.response?.status === 404) return []
        throw err
      }
    },
    enabled: !!paymentId && !!venueId,
  })

  const { data: refunds = [] } = useQuery<any[]>({
    queryKey: ['refunds', paymentId],
    queryFn: async () => {
      const res = await api.get(`/api/v1/dashboard/venues/${venueId}/payments/${paymentId}/refunds`)
      return res.data?.data ?? []
    },
    enabled: !!paymentId && !!venueId,
  })

  const orderIdForCustomer: string | undefined = payment?.order?.id

  const linkCustomerMutation = useMutation({
    mutationFn: async (customerId: string | null) => {
      if (!orderIdForCustomer) throw new Error('Este pago no está asociado a una orden')
      const res = await api.put(`/api/v1/dashboard/venues/${venueId}/orders/${orderIdForCustomer}`, { customerId })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment', paymentId] })
    },
    onError: (err: any) => {
      toast({
        title: t('customer.linkError', { defaultValue: 'No se pudo asociar al cliente' }),
        description: err?.response?.data?.message || err?.message,
        variant: 'destructive',
      })
    },
  })

  const sendReceiptMutation = useMutation({
    mutationFn: async ({ recipientEmail }: { recipientEmail: string }) => {
      const res = await api.post(`/api/v1/dashboard/venues/${venueId}/payments/${paymentId}/send-receipt`, {
        recipientEmail,
      })
      return res.data
    },
    onSuccess: () => {
      toast({
        title: t('detail.toast.receiptSentTitle', { defaultValue: 'Recibo enviado' }),
        description: t('detail.toast.receiptSentDesc', { email, defaultValue: `Enviado a ${email}` }),
      })
      setEmail('')
      setSendOpen(false)
    },
    onError: () => {
      toast({
        title: t('detail.toast.receiptErrorTitle', { defaultValue: 'No se pudo enviar el recibo' }),
        variant: 'destructive',
      })
    },
  })

  if (isLoading || !payment) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  const amount = Number(payment.amount) || 0
  const tip = Number(payment.tipAmount) || 0
  const total = amount + tip
  const methodLabel = formatMethod(payment.method, t)
  const createdAt = DateTime.fromISO(payment.createdAt, { zone: 'utc' }).setZone(venueTimezone)
  const dateShort = createdAt.toFormat("d 'de' LLL. yyyy HH:mm", { locale: 'es' })

  const orderItems = payment.order?.items ?? []
  // Order-level cortesía detection: TPV applies 100% discount at order level (not per-item),
  // so OrderItem.total stays at original price — the signal is order.discountAmount > 0 && order.total === 0.
  const orderDiscountAmount = Number(payment.order?.discountAmount) || 0
  const orderTotalAmount = Number(payment.order?.total) || 0
  const isOrderFullyComped = orderDiscountAmount > 0 && orderTotalAmount === 0
  const items: DrawerLineItem[] =
    orderItems.length > 0
      ? orderItems.map((item: any) => {
          const unitPrice = Number(item.unitPrice) || 0
          const lineTotal = Number(item.total) || 0
          return {
            name: item.productName || item.product?.name || t('detail.customAmount', { defaultValue: 'Importe personalizado' }),
            quantity: item.quantity || 1,
            unitPrice,
            total: lineTotal,
            isCustom: !item.productId,
            isCourtesy: isOrderFullyComped || (unitPrice > 0 && lineTotal === 0),
            modifiers: (item.modifiers || []).map((m: any) => ({
              name: m.name ?? m.modifier?.name ?? '-',
              price: Number(m.price ?? m.modifier?.price ?? 0),
            })),
          }
        })
      : [
          {
            name: t('detail.customAmount', { defaultValue: 'Importe personalizado' }),
            quantity: 1,
            unitPrice: amount,
            total: amount,
            isCustom: true,
            isCourtesy: false,
            modifiers: [],
          },
        ]

  const staffName = payment.processedBy
    ? `${payment.processedBy.firstName ?? ''} ${payment.processedBy.lastName ?? ''}`.trim()
    : t('detail.noStaff', { defaultValue: 'Empleado sin seguimiento' })

  const deviceName = payment.tpv?.name ?? t('detail.noDevice', { defaultValue: 'Sin dispositivo' })
  const sourceLabel = t(`sources.${payment.source}`, { defaultValue: payment.source ?? '-' })
  const primaryReceipt = receipts[0]
  const receiptLabel = primaryReceipt?.accessKey?.slice(-4)

  // Merchant account — `displayName` or `externalMerchantId` for cards,
  // `null` for cash / non-card methods (backend never attaches a merchant
  // account to them), so fall back to a dash instead of showing "N/A".
  const merchantAccount = payment.merchantAccount
  const merchantAccountLabel = merchantAccount
    ? merchantAccount.displayName || merchantAccount.externalMerchantId || '-'
    : '-'
  const merchantAccountBank = merchantAccount?.bankName || null

  // Method label + card detail suffix (e.g. "Tarjeta de crédito · VISA 4242").
  // Keeps the top metadata row compact while still surfacing the identifying
  // digits an operator needs to match a physical receipt.
  const cardBrand = payment.cardBrand || payment.processorData?.cardBrand || null
  const last4Raw = payment.last4 || payment.processorData?.last4 || payment.processorData?.maskedPan || ''
  const last4Digits = last4Raw ? String(last4Raw).replace(/\D/g, '').slice(-4) : ''
  const methodSuffix = [cardBrand, last4Digits].filter(Boolean).join(' ')
  const methodDisplay = methodSuffix ? `${methodLabel} · ${methodSuffix}` : methodLabel

  // Refund calculations
  const refundedTotal = refunds.reduce((sum, r) => sum + Math.abs(Number(r.amount) || 0), 0)
  const remainingRefundable = Math.max(0, total - refundedTotal)
  const isFullyRefunded = refundedTotal >= total - 0.001 && total > 0

  const linkedCustomer: Customer | null = payment.order?.customer ?? null
  const linkedCustomerName = linkedCustomer
    ? `${linkedCustomer.firstName ?? ''} ${linkedCustomer.lastName ?? ''}`.trim() ||
      linkedCustomer.email ||
      linkedCustomer.phone ||
      '—'
    : null
  const canAttachCustomer = !!orderIdForCustomer

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header: Enviar recibo + 3-dots */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-6 py-4 bg-background border-b border-border/60">
        <Popover open={sendOpen} onOpenChange={setSendOpen}>
          <PopoverTrigger asChild>
            <Button variant="secondary" className="rounded-full px-6 flex-1 h-10 gap-2">
              <Send className="h-4 w-4" />
              {t('detail.actions.sendReceipt', { defaultValue: 'Enviar recibo' })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="start">
            <form
              className="space-y-3"
              onSubmit={e => {
                e.preventDefault()
                if (email && !sendReceiptMutation.isPending) {
                  sendReceiptMutation.mutate({ recipientEmail: email })
                }
              }}
            >
              <Label htmlFor="email">{t('detail.fields.email', { defaultValue: 'Correo electrónico' })}</Label>
              <Input
                id="email"
                type="email"
                placeholder="cliente@ejemplo.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoFocus
              />
              <Button type="submit" className="w-full" disabled={!email || sendReceiptMutation.isPending}>
                {sendReceiptMutation.isPending ? tCommon('sending', { defaultValue: 'Enviando...' }) : tCommon('send', { defaultValue: 'Enviar' })}
              </Button>
            </form>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="icon" className="rounded-full h-10 w-10">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              disabled={isFullyRefunded || remainingRefundable <= 0}
              onClick={() => {
                if (remainingRefundable <= 0) {
                  toast({ title: t('refund.nothingLeft', { defaultValue: 'Este pago ya fue reembolsado por completo' }) })
                  return
                }
                setRefundOpen(true)
              }}
            >
              {t('detail.actions.issueRefund', { defaultValue: 'Emitir reembolso' })}
            </DropdownMenuItem>
            {linkedCustomer ? (
              <DropdownMenuItem
                onClick={() => {
                  setCustomerFormInitial(linkedCustomer)
                  setCustomerFormOpen(true)
                }}
              >
                {t('detail.actions.editCustomer', { defaultValue: 'Editar cliente' })}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => {
                  if (!canAttachCustomer) {
                    toast({
                      title: t('customer.noOrder', {
                        defaultValue: 'Este pago no tiene orden asociada — no se puede agregar cliente',
                      }),
                    })
                    return
                  }
                  setAddCustomerOpen(true)
                }}
              >
                {t('detail.actions.addCustomer', { defaultValue: 'Añadir cliente' })}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => toast({ title: tCommon('comingSoon', { defaultValue: 'Próximamente' }) })}>
              {t('detail.actions.attachContract', { defaultValue: 'Adjuntar un contrato' })}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {/* Refund cards (one per refund) — stacked above original payment */}
        {refunds.map(r => (
          <RefundCard
            key={r.id}
            amount={Math.abs(Number(r.amount) || 0)}
            createdAt={r.createdAt}
            methodLabel={formatMethod(r.method, t)}
            reason={
              (r.processorData as any)?.refundReason as string | undefined
            }
            venueName={venue?.name ?? '-'}
            sourceLabel={sourceLabel}
            venueTimezone={venueTimezone}
            t={t}
          />
        ))}

        {/* Amount + meta card */}
        <div className="rounded-xl border border-border/60 bg-card p-6 space-y-5">
          <div className="space-y-1">
            <h2 className="text-3xl font-semibold tracking-tight">
              {Currency(total)} {t('detail.paid', { defaultValue: 'pagado' })}
            </h2>
            <p className="text-sm text-muted-foreground">{dateShort}</p>
          </div>

          <div className="space-y-1.5 text-sm text-muted-foreground">
            <InfoLine label={t('detail.fields.chargedAt', { defaultValue: 'Cobrado en' })} value={venue?.name ?? '-'} />
            <InfoLine
              label={t('detail.fields.merchantAccount', { defaultValue: 'Cuenta comercial' })}
              value={merchantAccountBank ? `${merchantAccountLabel} · ${merchantAccountBank}` : merchantAccountLabel}
            />
            <InfoLine label={t('detail.fields.method', { defaultValue: 'Método de pago' })} value={methodDisplay} />
            <InfoLine label={t('detail.fields.device', { defaultValue: 'Dispositivo' })} value={deviceName} />
            <InfoLine label={t('detail.fields.orderSource', { defaultValue: 'Fuente del pedido' })} value={sourceLabel} />
            <InfoLine label={t('detail.fields.attributedTo', { defaultValue: 'Venta atribuida a' })} value={staffName} />
            {linkedCustomerName && (
              <p>
                <span>{t('detail.fields.paidBy', { defaultValue: 'Pagado por' })}: </span>
                <button
                  type="button"
                  onClick={() => {
                    setCustomerFormInitial(linkedCustomer)
                    setCustomerFormOpen(true)
                  }}
                  className="text-foreground underline underline-offset-2 hover:text-primary"
                >
                  {linkedCustomerName}
                </button>
              </p>
            )}
          </div>
        </div>

        {/* Line items card */}
        <div className="rounded-xl bg-muted/30 p-2 space-y-1">
          {items.map((item, idx) => (
            <div key={idx} className="rounded-lg px-3 py-3 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="font-medium shrink-0">
                    {item.quantity}x
                  </Badge>
                  <span className="font-medium text-foreground truncate">{item.name}</span>
                  {item.isCourtesy && (
                    <Badge
                      variant="outline"
                      className="shrink-0 border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                    >
                      {t('detail.items.courtesy', { defaultValue: 'Cortesía' })}
                    </Badge>
                  )}
                </div>
                {item.modifiers.length > 0 && (
                  <div className="mt-2 space-y-1 ml-9">
                    {item.modifiers.map((m, mi) => (
                      <div key={mi} className="text-xs text-muted-foreground flex items-center gap-1">
                        <span>•</span>
                        <span>{m.name}</span>
                        {m.price > 0 && <span className="text-foreground font-medium">(+{Currency(m.price)})</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 text-right whitespace-nowrap">
                {item.quantity > 1 && (
                  <span className="text-xs text-muted-foreground">
                    {Currency(item.unitPrice)} {t('detail.items.each', { defaultValue: 'c/u' })}
                  </span>
                )}
                {item.isCourtesy ? (
                  <div className="flex flex-col items-end">
                    <span className="text-xs text-muted-foreground line-through">{Currency(item.unitPrice * item.quantity)}</span>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">{Currency(0)}</span>
                  </div>
                ) : (
                  <span className="font-medium text-foreground">{Currency(item.total)}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Totals card — pure money breakdown. Method and date live in the
         * meta card above so we don't repeat them here. Propina is always
         * visible (even $0.00) so the breakdown doesn't collapse for pagos
         * en efectivo sin propina. */}
        <div className="rounded-xl border border-border/60 bg-card p-6 space-y-3 text-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>{t('detail.subtotal', { defaultValue: 'Subtotal' })}</span>
            <span>{Currency(amount)}</span>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span>{t('detail.tip', { defaultValue: 'Propina' })}</span>
            <span>{Currency(tip)}</span>
          </div>
          <div className="flex items-center justify-between font-semibold text-base pt-2 border-t border-border/60">
            <span className="uppercase tracking-wide">{t('detail.total', { defaultValue: 'Total' })}</span>
            <span>{Currency(total)}</span>
          </div>
          {primaryReceipt?.accessKey && receiptLabel && (
            <a
              href={`${RECEIPT_PATHS.PUBLIC}/${primaryReceipt.accessKey}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block underline underline-offset-2 text-sm text-foreground hover:text-primary pt-2"
            >
              {t('detail.receiptNumber', { defaultValue: 'Recibo n.º' })} {receiptLabel}
            </a>
          )}
        </div>
      </div>

      {/* Sticky footer: Listo */}
      <div className="sticky bottom-0 flex justify-end px-6 py-4 bg-background border-t border-border/60">
        <Button onClick={onClose} className="rounded-full px-8 bg-foreground text-background hover:bg-foreground/90">
          {tCommon('done', { defaultValue: 'Listo' })}
        </Button>
      </div>

      {/* Customer picker */}
      <AddCustomerSheet
        venueId={venueId}
        open={addCustomerOpen}
        onOpenChange={setAddCustomerOpen}
        onConfirm={async selected => {
          await linkCustomerMutation.mutateAsync(selected.id)
          setAddCustomerOpen(false)
        }}
        onCreateNew={() => {
          setAddCustomerOpen(false)
          setCustomerFormInitial(null)
          setCustomerFormOpen(true)
        }}
      />

      {/* Refund modal */}
      <IssueRefundSheet
        venueId={venueId}
        paymentId={paymentId}
        maxRefundable={remainingRefundable}
        methodLabel={methodLabel}
        paymentTipAmount={tip}
        venueName={venue?.name}
        orderItems={orderItems.map((item: any) => {
          // Sum qty + amount already refunded for this orderItemId across
          // all prior REFUND payments on this payment.
          let priorRefundedQty = 0
          let priorRefundedAmount = 0
          refunds.forEach((r: any) => {
            const refundedItems = (r.processorData as any)?.refundedItems ?? []
            refundedItems.forEach((ri: any) => {
              if (ri.orderItemId === item.id) {
                priorRefundedQty += Number(ri.quantity) || 0
                priorRefundedAmount += Number(ri.amount) || 0
              }
            })
          })
          return {
            id: item.id,
            productId: item.productId,
            productName: item.productName || item.product?.name || null,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice) || 0,
            total: Number(item.total) || 0,
            trackInventory: !!item.product?.trackInventory,
            priorRefundedQty,
            priorRefundedAmount,
          }
        })}
        open={refundOpen}
        onOpenChange={setRefundOpen}
        onRefunded={() => setRefundOpen(false)}
      />

      {/* Customer create/edit form */}
      <CustomerFormSheet
        venueId={venueId}
        open={customerFormOpen}
        onOpenChange={setCustomerFormOpen}
        customer={customerFormInitial}
        onSaved={async saved => {
          // Link newly created customer to the order, or refresh the edited one.
          if (!customerFormInitial?.id) {
            await linkCustomerMutation.mutateAsync(saved.id)
          } else {
            queryClient.invalidateQueries({ queryKey: ['payment', paymentId] })
          }
          setCustomerFormOpen(false)
          setCustomerFormInitial(null)
        }}
        onRemoveFromTransaction={async () => {
          await linkCustomerMutation.mutateAsync(null)
          setCustomerFormOpen(false)
          setCustomerFormInitial(null)
        }}
      />
    </div>
  )
}

function RefundCard({
  amount,
  createdAt,
  methodLabel,
  reason,
  venueName,
  sourceLabel,
  venueTimezone,
  t,
}: {
  amount: number
  createdAt: string
  methodLabel: string
  reason?: string
  venueName: string
  sourceLabel: string
  venueTimezone: string
  t: (key: string, opts?: any) => string
}) {
  const dt = DateTime.fromISO(createdAt, { zone: 'utc' }).setZone(venueTimezone)
  const dateShort = dt.toFormat("d 'de' LLL. yyyy HH:mm", { locale: 'es' })

  const reasonLabel = reason
    ? t(`refund.reasons.${reason}`, {
        defaultValue:
          reason === 'RETURNED_GOODS'
            ? 'Productos devueltos'
            : reason === 'ACCIDENTAL_CHARGE'
              ? 'Cargo accidental'
              : reason === 'CANCELLED_ORDER'
                ? 'Pedido cancelado'
                : reason === 'FRAUDULENT_CHARGE'
                  ? 'Cargo fraudulento'
                  : 'Otro',
      })
    : null

  const negative = `-${Currency(amount).replace(/^-/, '')}`

  return (
    <div className="rounded-xl border border-border/60 bg-card p-6 space-y-5">
      <div className="space-y-1">
        <h2 className="text-3xl font-semibold tracking-tight">
          {Currency(amount)} {t('refund.refunded', { defaultValue: 'reembolsado' })}
        </h2>
        <p className="text-sm text-muted-foreground">{dateShort}</p>
      </div>

      <div className="space-y-1.5 text-sm text-muted-foreground">
        <p>
          <span>{t('detail.fields.issuedAt', { defaultValue: 'Emitido en' })}: </span>
          <span className="text-foreground">{venueName}</span>
        </p>
        <p>
          <span>{t('detail.fields.orderSource', { defaultValue: 'Fuente del pedido' })}: </span>
          <span className="text-foreground">{sourceLabel}</span>
        </p>
      </div>

      {reasonLabel && (
        <div className="pt-1">
          <p className="font-semibold text-foreground">{reasonLabel}</p>
        </div>
      )}

      <div className="space-y-2 text-sm pt-2 border-t border-border/60">
        <div className="flex items-center justify-between font-semibold text-base">
          <span className="uppercase tracking-wide">{t('detail.total', { defaultValue: 'Total' })}</span>
          <span>{negative}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-foreground">{methodLabel}</span>
          <span>{negative}</span>
        </div>
        <p className="text-xs text-muted-foreground">{dateShort}</p>
      </div>
    </div>
  )
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span>{label}: </span>
      <span className="text-foreground">{value}</span>
    </p>
  )
}

function formatMethod(method: string | undefined, t: (key: string, opts?: any) => string): string {
  const m = method?.toUpperCase()
  if (m === 'CASH') return t('methods.CASH', { defaultValue: 'Efectivo' })
  if (m === 'CREDIT_CARD') return t('methods.CREDIT_CARD', { defaultValue: 'Tarjeta de crédito' })
  if (m === 'DEBIT_CARD') return t('methods.DEBIT_CARD', { defaultValue: 'Tarjeta de débito' })
  if (m === 'DIGITAL_WALLET') return t('methods.DIGITAL_WALLET', { defaultValue: 'Billetera digital' })
  return method ?? '-'
}

interface DrawerLineItem {
  name: string
  quantity: number
  unitPrice: number
  total: number
  isCustom: boolean
  isCourtesy: boolean
  modifiers: Array<{ name: string; price: number }>
}
