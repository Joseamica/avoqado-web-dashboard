/**
 * «Devolver a la tarjeta» de un pedido en línea cobrado con tarjeta, y «Devolver por otro medio» si la devolución falló DESPUÉS.
 * Patrón de `IssueRefundSheet`, pero el monto viaja en PESOS como texto («120.50»), nunca centavos (contrato del servidor).
 * 🔴 Nada se decide aquí que el servidor ya decide: el tope es una pista (manda su `400 CARD_REFUND_EXCEEDS_REMAINING`) y el texto de
 * cada desenlace sale de `cardRefundStatus`.
 */
import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useAccess } from '@/hooks/use-access'
import { useToast } from '@/hooks/use-toast'
import {
  createCardRefund,
  getOnlineOrder,
  listCardRefunds,
  onlineOrderingKeys,
  resolveCardRefund,
  serverMessage,
} from '@/services/onlineOrdering.service'
import type { CardRefund, CardRefundReason, CardRefundResolveMethod, CardRefundResult, InboxOrder } from '@/types/onlineOrdering'
import { Currency } from '@/utils/currency'
import { useVenueDateTime } from '@/utils/datetime'

const REASONS: CardRefundReason[] = ['RETURNED_GOODS', 'ACCIDENTAL_CHARGE', 'CANCELLED_ORDER', 'FRAUDULENT_CHARGE', 'OTHER']
const NOTE_MAX = 200 // el mismo tope del servidor

/** El texto de cada estado de una devolución (la lista y el desenlace usan el mismo). */
const STATUS_KEY: Record<string, string> = {
  SUCCEEDED: 'cardRefund.outcome.done',
  RECORDED: 'cardRefund.outcome.done',
  REQUESTED: 'cardRefund.outcome.processing',
  SENDING: 'cardRefund.outcome.processing',
  PENDING: 'cardRefund.outcome.processing',
  FAILED: 'cardRefund.outcome.failed',
  CANCELED: 'cardRefund.outcome.failed',
  REVERSED: 'cardRefund.outcome.reversed',
  RESOLVED: 'cardRefund.outcome.resolved',
}
const statusKey = (s: string | undefined) => (s && STATUS_KEY[s]) || 'cardRefund.outcome.unknown'

/**
 * El desenlace de `POST …/card-refund`. `UNKNOWN` = el servidor quedó en duda (su recorrido la termina): «en proceso, revisa». Lo
 * demás por `cardRefundStatus`, nunca por `status` (en una repetición dice `RECORDED` también para REVERSED y RESOLVED).
 */
const outcomeKey = (r: Pick<CardRefundResult, 'status' | 'cardRefundStatus'>) => (r.status === 'UNKNOWN' ? statusKey(undefined) : statusKey(r.cardRefundStatus))

const cents = (pesos: string | number) => Math.round(Number(pesos) * 100)

/** Lo que aún se puede devolver, en centavos: lo cobrado menos lo devuelto o en curso (no cuentan FAILED, CANCELED ni REVERSED sin resolver). */
const refundableCents = (capturedAmount: number | null | undefined, refunds: CardRefund[]) =>
  Math.max(
    0,
    cents(capturedAmount ?? 0) -
      refunds
        .filter(r => r.status !== 'FAILED' && r.status !== 'CANCELED' && !(r.status === 'REVERSED' && !r.reversal?.resolvedAt))
        .reduce((sum, r) => sum + cents(r.amount), 0),
  )

/** «120.5» ⇒ 12050 centavos; vacío, cero, negativo o con más de 2 decimales ⇒ null. */
const parseCents = (s: string): number | null => {
  const v = s.trim()
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return null
  const c = cents(v)
  return c > 0 ? c : null
}

/** El servidor pudo haberla hecho sin que nos enteráramos: sin respuesta o 5xx. Se reintenta con la MISMA llave. */
const inDoubt = (err: unknown) => {
  const status = (err as { response?: { status?: unknown } } | undefined)?.response?.status
  return typeof status !== 'number' || status >= 500
}

const isCardCaptured = (o: Pick<InboxOrder, 'paymentMode' | 'card'>) => o.paymentMode === 'CARD_ONLINE' && o.card?.status === 'CAPTURED'

/** El botón y su hoja. Quien lo pinta ya comprobó `payments:refund` (el servidor lo vuelve a exigir). */
export function CardRefundButton({ venueId, order }: { venueId: string; order: InboxOrder }) {
  const { t } = useTranslation('onlineOrdering')
  const [open, setOpen] = useState(false)
  if (!isCardCaptured(order)) return null
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} data-tour="online-order-card-refund">
        {t('cardRefund.open')}
      </Button>
      {open && <CardRefundSheet venueId={venueId} order={order} onClose={() => setOpen(false)} />}
    </>
  )
}

/**
 * El detalle de la cuenta (vive siempre; la bandeja sólo guarda 24 h). Sólo una cuenta de origen en línea (`WEB`, o sin el dato) se
 * consulta por la ruta de S3; su 404 llega como `null` = no es pedido en línea, sin botón.
 */
export function OrderCardRefund({ venueId, orderId, source }: { venueId: string; orderId: string; source?: string | null }) {
  const { can } = useAccess()
  const enabled = can('payments:refund') && (!source || source === 'WEB')
  const { data } = useQuery({
    queryKey: onlineOrderingKeys.order(venueId, orderId),
    queryFn: () => getOnlineOrder(venueId, orderId),
    enabled: enabled && !!venueId,
  })
  if (!enabled || !data) return null
  return <CardRefundButton venueId={venueId} order={data} />
}

function CardRefundSheet({ venueId, order, onClose }: { venueId: string; order: InboxOrder; onClose: () => void }) {
  const { t } = useTranslation('onlineOrdering')
  const { t: tPay } = useTranslation('payment')
  const { toast } = useToast()
  const { can } = useAccess()
  const { formatDateTime } = useVenueDateTime()
  const qc = useQueryClient()

  // null = el cajero no ha tocado el monto: va lo que queda (la pista).
  const [amountStr, setAmountStr] = useState<string | null>(null)
  const [reason, setReason] = useState<CardRefundReason | null>(null)
  const [note, setNote] = useState('')
  // La llave es de la OPERACIÓN: nueva al abrir (la hoja se monta al abrir) o al cambiar el cuerpo; la MISMA en sus reintentos.
  const attempt = useRef<{ body: string; key: string } | null>(null)

  const listKey = onlineOrderingKeys.cardRefunds(venueId, order.orderId)
  const list = useQuery({ queryKey: listKey, queryFn: () => listCardRefunds(venueId, order.orderId) })
  const hint = list.data ? refundableCents(order.card?.capturedAmount, list.data) : null
  const shownAmount = amountStr ?? (hint ? (hint / 100).toFixed(2) : '')
  const amountCents = parseCents(shownAmount)

  const reread = () => {
    void qc.invalidateQueries({ queryKey: listKey })
    void qc.invalidateQueries({ queryKey: onlineOrderingKeys.inbox(venueId) })
    void qc.invalidateQueries({ queryKey: ['order', venueId, order.orderId] })
  }

  const refund = useMutation({
    mutationFn: (v: { body: { amount: string; reason: CardRefundReason; note?: string }; key: string }) =>
      createCardRefund(venueId, order.orderId, v.body, v.key),
    onSuccess: res => {
      // PENDING y UNKNOWN siguen en curso en el servidor: repetir el mismo cuerpo debe dar la MISMA (replay). Lo demás ya terminó.
      if (res.status !== 'PENDING' && res.status !== 'UNKNOWN') attempt.current = null
      if (res.status === 'RECORDED') {
        setAmountStr(null)
        setReason(null)
        setNote('')
      }
      const failed = res.cardRefundStatus === 'FAILED' || res.cardRefundStatus === 'CANCELED'
      toast({ title: t(outcomeKey(res)), ...(failed ? { variant: 'destructive' as const } : {}) })
    },
    onError: err => {
      if (inDoubt(err)) return toast({ title: t('cardRefund.noResponse') })
      attempt.current = null // un 4xx es definitivo: el siguiente intento es otra operación
      toast({ title: serverMessage(err, t('cardRefund.error')), variant: 'destructive' })
    },
    onSettled: reread,
  })

  const resolve = useMutation({
    mutationFn: (v: { refundId: string; method: CardRefundResolveMethod }) =>
      resolveCardRefund(venueId, order.orderId, v.refundId, { method: v.method }),
    onSuccess: () => toast({ title: t('cardRefund.outcome.resolved') }),
    // 409 CASH_DRAWER_NOT_OPEN y los demás: el texto del servidor. Repetir es idempotente.
    onError: err => toast({ title: serverMessage(err, t('cardRefund.error')), variant: 'destructive' }),
    onSettled: reread,
  })

  const submit = () => {
    if (!amountCents || !reason) return
    const trimmed = note.trim()
    const body = { amount: (amountCents / 100).toFixed(2), reason, ...(trimmed ? { note: trimmed } : {}) }
    const sig = JSON.stringify(body)
    if (attempt.current?.body !== sig) attempt.current = { body: sig, key: crypto.randomUUID() }
    refund.mutate({ body, key: attempt.current.key })
  }

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('cardRefund.title', { number: order.orderNumber })}</DialogTitle>
          <DialogDescription>{t('cardRefund.description')}</DialogDescription>
        </DialogHeader>

        <section className="space-y-2">
          <h3 className="text-sm font-medium">{t('cardRefund.history')}</h3>
          {list.isLoading ? (
            <Skeleton className="h-12 w-full rounded-lg" />
          ) : list.isError ? (
            <p className="text-sm text-destructive">{t('cardRefund.loadFailed')}</p>
          ) : !list.data?.length ? (
            <p className="text-sm text-muted-foreground">{t('cardRefund.empty')}</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-input">
              {list.data.map(r => (
                <li key={r.id} data-testid={`card-refund-${r.id}`} className="space-y-1 p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{Currency(Number(r.amount))}</span>
                    <span className="text-right text-muted-foreground">{t(statusKey(r.status))}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(r.createdAt)} · {tPay(`refund.reasons.${r.reason}`)}
                  </p>
                  {r.status === 'REVERSED' && !r.reversal?.resolvedAt && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-xs font-medium">{t('cardRefund.other.title')}</span>
                      {can('payments:refund-to-cash') && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={resolve.isPending}
                          onClick={() => resolve.mutate({ refundId: r.id, method: 'CASH' })}
                        >
                          {t('cardRefund.other.cash')}
                        </Button>
                      )}
                      {can('payments:refund') && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={resolve.isPending}
                          onClick={() => resolve.mutate({ refundId: r.id, method: 'BANK_TRANSFER' })}
                        >
                          {t('cardRefund.other.transfer')}
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-4">
          {hint !== null && <p className="text-sm font-medium">{t('cardRefund.upTo', { amount: Currency(hint / 100) })}</p>}
          <div className="space-y-1.5">
            <Label htmlFor="card-refund-amount">{t('cardRefund.amount')}</Label>
            <Input
              id="card-refund-amount"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={shownAmount}
              onChange={e => setAmountStr(e.target.value)}
            />
            {shownAmount !== '' && !amountCents && <p className="text-xs text-destructive">{t('cardRefund.amountInvalid')}</p>}
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">{t('cardRefund.reason')}</p>
            <div className="grid grid-cols-2 gap-2">
              {REASONS.map(r => (
                <Button key={r} type="button" variant={reason === r ? 'default' : 'outline'} aria-pressed={reason === r} onClick={() => setReason(r)}>
                  {tPay(`refund.reasons.${r}`)}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="card-refund-note">{t('cardRefund.note')}</Label>
            <Textarea id="card-refund-note" maxLength={NOTE_MAX} value={note} onChange={e => setNote(e.target.value)} />
            <p className="text-right text-xs text-muted-foreground">
              {note.length}/{NOTE_MAX}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" disabled={!amountCents || !reason || refund.isPending} onClick={submit}>
            {refund.isPending ? t('cardRefund.sending') : t('cardRefund.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
