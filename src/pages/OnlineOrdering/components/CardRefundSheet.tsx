/**
 * «Devolver a la tarjeta» de un pedido en línea cobrado con tarjeta, y «Devolver por otro medio» si la devolución falló DESPUÉS.
 * Patrón de `IssueRefundSheet`, pero el monto viaja en PESOS como texto («120.50»), nunca centavos (contrato del servidor).
 * 🔴 Nada se decide aquí que el servidor ya decide: el tope es una pista (manda su `400 CARD_REFUND_EXCEEDS_REMAINING`) y el texto de
 * cada desenlace sale de `cardRefundStatus`.
 */
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription } from '@/components/ui/alert'
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
  REQUESTED: 'cardRefund.outcome.sending',
  SENDING: 'cardRefund.outcome.sending',
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

/** El servidor pudo haberla hecho sin que nos enteráramos: sin respuesta, 5xx o 408. Se reintenta con la MISMA llave. */
const inDoubt = (err: unknown) => {
  const status = (err as { response?: { status?: unknown } } | undefined)?.response?.status
  return typeof status !== 'number' || status >= 500 || status === 408
}
const codeOf = (err: unknown) => (err as { response?: { data?: { code?: unknown } } } | undefined)?.response?.data?.code

type RefundBody = { amount: string; reason: CardRefundReason; note?: string }
const bodyOf = (amount: string, reason: CardRefundReason, note: string): RefundBody => ({ amount, reason, ...(note ? { note } : {}) })
const sigOf = (b: RefundBody) => JSON.stringify(b)

/**
 * Nunca devolver dos veces lo decide el SERVIDOR, no el navegador (Codex panel r4): cada devolución dice cuál es la última que vio el
 * operador, y bajo el candado de la orden sólo pasa si sigue siendo la última. Da igual el orden, la demora, las pestañas o las personas.
 * Por eso aquí no se guarda nada entre aperturas. Lo que se manda se congela en la memoria de la hoja: tocar otra vez lo mismo reusa
 * llave y vista (replay si ya llegó); una relectura NUNCA renueva la vista de un envío (si la lista cambió, hay que decidir otra vez).
 */
type Attempt = { key: string; expected: string | null; sig: string }

const RECENT_MS = 10 * 60_000
/** Ayuda para el operador, no la garantía: una del mismo monto de hace ≤ 10 min que sí devolvió o va en curso. */
const recentTwin = (amount: string, refunds: CardRefund[], now: number) =>
  refunds.find(
    r =>
      cents(r.amount) === cents(amount) &&
      r.status !== 'FAILED' &&
      r.status !== 'CANCELED' &&
      r.status !== 'REVERSED' &&
      now - Date.parse(r.createdAt) <= RECENT_MS,
  )

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
  const [confirm, setConfirm] = useState<{ sig: string; amount: string; minutes: number } | null>(null)
  // La última devolución que ve el operador. `undefined` = falta una lectura posterior a `readAfter`: sin ella no se manda.
  const [seen, setSeen] = useState<string | null | undefined>(undefined)
  const [readAfter, setReadAfter] = useState(() => Date.now())
  const [changed, setChanged] = useState(false)
  const attempt = useRef<Attempt | null>(null)
  const busy = useRef(false) // candado síncrono: `isPending` aún no cambia en el segundo de dos clics pegados

  const listKey = onlineOrderingKeys.cardRefunds(venueId, order.orderId)
  // Cada apertura lee la lista aunque haya caché: lo que se decide debe salir de una lectura de ahora.
  const list = useQuery({ queryKey: listKey, queryFn: () => listCardRefunds(venueId, order.orderId), refetchOnMount: 'always' })
  const latest = list.data ? (list.data[0]?.id ?? null) : undefined
  const hint = list.data ? refundableCents(order.card?.capturedAmount, list.data) : null
  const shownAmount = amountStr ?? (hint ? (hint / 100).toFixed(2) : '')
  const amountCents = parseCents(shownAmount)
  const currentSig = amountCents && reason ? sigOf(bodyOf((amountCents / 100).toFixed(2), reason, note.trim())) : null

  const clearForm = () => {
    setAmountStr(null)
    setReason(null)
    setNote('')
    setConfirm(null)
    attempt.current = null
  }
  /** Decidir otra vez: formulario vacío y una lectura posterior a este momento; hasta entonces «Devolver» queda apagado. */
  const startOver = () => {
    clearForm()
    setSeen(undefined)
    setReadAfter(Date.now())
  }

  const reread = () => {
    void qc.invalidateQueries({ queryKey: listKey })
    void qc.invalidateQueries({ queryKey: onlineOrderingKeys.inbox(venueId) })
    void qc.invalidateQueries({ queryKey: ['order', venueId, order.orderId] })
  }

  const refund = useMutation({
    mutationFn: (v: { body: RefundBody; attempt: Attempt }) =>
      createCardRefund(venueId, order.orderId, { ...v.body, expectedLatestRefundId: v.attempt.expected }, v.attempt.key),
    onSuccess: res => {
      const failed = res.cardRefundStatus === 'FAILED' || res.cardRefundStatus === 'CANCELED'
      // También con FAILED: mientras tardó la respuesta pudo hacerse otra devolución, y el formulario lleno se la saltaría (Codex panel r5).
      startOver()
      toast({ title: t(outcomeKey(res)), ...(failed ? { variant: 'destructive' as const } : {}) })
    },
    onError: err => {
      if (inDoubt(err)) return toast({ title: t('cardRefund.noResponse') })
      attempt.current = null
      if (codeOf(err) === 'CARD_REFUND_STALE_VIEW') {
        startOver()
        setChanged(true)
        return
      }
      toast({ title: serverMessage(err, t('cardRefund.error')), variant: 'destructive' })
    },
    onSettled: () => {
      busy.current = false
      reread()
    },
  })

  // Lo que ve es lo que decide: si la lista trae otra devolución con la hoja abierta, se avisa y hay que decidir otra vez.
  useEffect(() => {
    if (latest === undefined) return
    if (seen === undefined) {
      if (list.dataUpdatedAt >= readAfter) {
        clearForm() // lo llenado sin ver esta lista no cuenta (Codex panel r6)
        setSeen(latest)
      }
    } else if (latest !== seen) {
      clearForm()
      setChanged(true)
      setSeen(latest)
    }
  }, [latest, seen, readAfter, list.dataUpdatedAt])

  // Sólo se decide con el historial a la vista: si la relectura falló, se oculta y no se manda.
  const canSend = seen !== undefined && !list.isError

  const resolve = useMutation({
    mutationFn: (v: { refundId: string; method: CardRefundResolveMethod }) =>
      resolveCardRefund(venueId, order.orderId, v.refundId, { method: v.method }),
    onSuccess: () => toast({ title: t('cardRefund.outcome.resolved') }),
    // 409 CASH_DRAWER_NOT_OPEN y los demás: el texto del servidor. Repetir es idempotente.
    onError: err => toast({ title: serverMessage(err, t('cardRefund.error')), variant: 'destructive' }),
    onSettled: reread,
  })

  const submit = (confirmed = false) => {
    if (!amountCents || !reason || !canSend || busy.current) return
    const body = bodyOf((amountCents / 100).toFixed(2), reason, note.trim())
    const sig = sigOf(body)
    setChanged(false)
    if (attempt.current?.sig === sig) {
      busy.current = true
      return refund.mutate({ body, attempt: attempt.current })
    }
    if (!confirmed) {
      const now = Date.now()
      const twin = recentTwin(body.amount, list.data ?? [], now)
      if (twin) {
        const minutes = Math.max(0, Math.round((now - Date.parse(twin.createdAt)) / 60_000))
        return setConfirm({ sig, amount: body.amount, minutes })
      }
    }
    setConfirm(null)
    attempt.current = { key: crypto.randomUUID(), expected: seen, sig }
    busy.current = true
    refund.mutate({ body, attempt: attempt.current })
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
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-destructive">{t('cardRefund.loadFailed')}</p>
              <Button type="button" size="sm" variant="outline" disabled={list.isFetching} onClick={() => void list.refetch()}>
                {t('cardRefund.reload')}
              </Button>
            </div>
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
          {changed && (
            <Alert role="status">
              <AlertDescription>{t('cardRefund.changed')}</AlertDescription>
            </Alert>
          )}
          {confirm && confirm.sig === currentSig && (
            <Alert role="alert">
              <AlertDescription className="space-y-2">
                <p>{t('cardRefund.confirmAnother', { amount: Currency(Number(confirm.amount)), minutes: confirm.minutes })}</p>
                <Button type="button" size="sm" variant="destructive" disabled={refund.isPending} onClick={() => submit(true)}>
                  {t('cardRefund.confirmYes')}
                </Button>
              </AlertDescription>
            </Alert>
          )}
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
          <Button type="button" disabled={!amountCents || !reason || !canSend || refund.isPending} onClick={() => submit()}>
            {refund.isPending ? t('cardRefund.sending') : t('cardRefund.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
