/**
 * «Devolver a la tarjeta» de un pedido en línea cobrado con tarjeta, y «Devolver por otro medio» si la devolución falló DESPUÉS.
 * Patrón de `IssueRefundSheet`, pero el monto viaja en PESOS como texto («120.50»), nunca centavos (contrato del servidor).
 * 🔴 Nada se decide aquí que el servidor ya decide: el tope es una pista (manda su `400 CARD_REFUND_EXCEEDS_REMAINING`) y el texto de
 * cada desenlace sale de `cardRefundStatus`.
 */
import { useEffect, useRef, useState, type MutableRefObject } from 'react'
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

type RefundBody = { amount: string; reason: CardRefundReason; note?: string }
const bodyOf = (amount: string, reason: CardRefundReason, note: string): RefundBody => ({ amount, reason, ...(note ? { note } : {}) })

/**
 * El servidor deduplica por LLAVE, no por monto: dos llaves para la misma devolución pueden devolver dos veces (Codex panel r1 #1,
 * r2 #1). Por eso hay UN intento pendiente por negocio y cuenta, compartido entre pestañas (localStorage):
 * - se guarda ANTES de mandar y se LEE AL ENVIAR (no sólo al abrir): el mismo cuerpo reusa SU llave; otro cuerpo NO se manda
 *   mientras siga vivo (nunca lo reemplaza);
 * - se borra con un desenlace definitivo de su llave, o cuando la lista trae SU LLAVE (S9) en un estado terminado (r3: exacto, nunca
 *   por monto ni fecha). Si la lista no trae su llave: los primeros 2 min «todavía puede estar en camino»; después «no llegó al
 *   servidor» y se puede descartar. Con un servidor que no manda llaves no se adivina: sólo descartar, pasados 2 min;
 * - sin almacenamiento queda en la memoria de la hoja, y protege la confirmación de «otra devolución del mismo monto».
 */
type SavedAttempt = { key: string; amount: string; reason: CardRefundReason; note: string; savedAt: number }
type Mem = MutableRefObject<SavedAttempt | null>
const savedKey = (venueId: string, orderId: string) => `avq:card-refund-attempt:${venueId}:${orderId}`
const loadPending = (k: string, mem: Mem): SavedAttempt | null => {
  try {
    const v = JSON.parse(window.localStorage.getItem(k) ?? 'null') as Partial<SavedAttempt> | null
    if (!v || typeof v.key !== 'string' || typeof v.amount !== 'string' || !REASONS.includes(v.reason as CardRefundReason)) return mem.current
    const note = typeof v.note === 'string' ? v.note : ''
    return { key: v.key, amount: v.amount, reason: v.reason as CardRefundReason, note, savedAt: typeof v.savedAt === 'number' ? v.savedAt : 0 }
  } catch {
    return mem.current
  }
}
const savePending = (k: string, mem: Mem, v: SavedAttempt) => {
  try {
    window.localStorage.setItem(k, JSON.stringify(v))
    mem.current = null
  } catch {
    mem.current = v // modo privado o lleno: lo recuerda esta hoja
  }
}
const clearPending = (k: string, mem: Mem, key: string) => {
  if (mem.current?.key === key) mem.current = null
  try {
    if (loadPending(k, mem)?.key === key) window.localStorage.removeItem(k)
  } catch {
    // sin almacenamiento: no hay nada que borrar
  }
}
const sigOf = (b: RefundBody) => JSON.stringify(b)
const sigOfSaved = (p: SavedAttempt) => sigOf(bodyOf(p.amount, p.reason, p.note))

const IN_FLIGHT: ReadonlySet<string> = new Set(['REQUESTED', 'SENDING', 'PENDING'])
const ARRIVAL_MS = 2 * 60_000

/** Con la lista FRESCA: si trae la llave del pendiente en un estado terminado, se borra. Devuelve el pendiente que sigue vivo. */
const reconcilePending = (k: string, mem: Mem, refunds: CardRefund[]): SavedAttempt | null => {
  const p = loadPending(k, mem)
  const r = p ? refunds.find(x => x.key === p.key) : undefined
  if (p && r && !IN_FLIGHT.has(r.status)) clearPending(k, mem, p.key)
  return loadPending(k, mem)
}

/**
 * Qué decir del pendiente vivo. `inFlight` = su llave está en la lista (en curso). Sin su llave: si la lista sí sabe de llaves (o está
 * vacía) es `mayArrive` y, pasados 2 min, `notArrived`; si no (servidor viejo, o sin lista) no se sabe: `unknown`.
 */
const pendingView = (p: SavedAttempt, refunds: CardRefund[] | undefined, now: number) => {
  const late = now - p.savedAt >= ARRIVAL_MS
  const knowsKeys = !!refunds && (refunds.length === 0 || refunds.some(r => typeof r.key === 'string'))
  if (refunds?.some(r => r.key === p.key)) return { text: 'cardRefund.pendingAttempt', canDiscard: false }
  if (!knowsKeys) return { text: 'cardRefund.pendingAttempt', canDiscard: late }
  return late ? { text: 'cardRefund.notArrived', canDiscard: true } : { text: 'cardRefund.mayArrive', canDiscard: false }
}
const RECENT_MS = 10 * 60_000
/** Sin intento guardado (otra pestaña con el almacenamiento roto): una del mismo monto de hace ≤ 10 min que sí devolvió o va en curso. */
const recentTwin = (amount: string, refunds: CardRefund[], now: number) =>
  refunds.find(
    r => cents(r.amount) === cents(amount) && r.status !== 'FAILED' && r.status !== 'CANCELED' && now - Date.parse(r.createdAt) <= RECENT_MS,
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

  const storeKey = savedKey(venueId, order.orderId)
  const mem = useRef<SavedAttempt | null>(null)
  // Una devolución en duda de antes (otra apertura, otra pestaña u otra carga de la página): se avisa y precarga el formulario.
  const [pending, setPending] = useState(() => loadPending(storeKey, mem))
  // null = el cajero no ha tocado el monto: va lo que queda (la pista).
  const [amountStr, setAmountStr] = useState<string | null>(pending?.amount ?? null)
  const [reason, setReason] = useState<CardRefundReason | null>(pending?.reason ?? null)
  const [note, setNote] = useState(pending?.note ?? '')
  const [blocked, setBlocked] = useState(false)
  const [confirm, setConfirm] = useState<{ sig: string; amount: string; minutes: number } | null>(null)
  const [checking, setChecking] = useState(false)
  const busy = useRef(false) // candado síncrono: dos clics no corren dos revisiones
  const [, setTick] = useState(0)

  const listKey = onlineOrderingKeys.cardRefunds(venueId, order.orderId)
  const list = useQuery({ queryKey: listKey, queryFn: () => listCardRefunds(venueId, order.orderId) })
  const hint = list.data ? refundableCents(order.card?.capturedAmount, list.data) : null
  const shownAmount = amountStr ?? (hint ? (hint / 100).toFixed(2) : '')
  const amountCents = parseCents(shownAmount)
  const currentSig = amountCents && reason ? sigOf(bodyOf((amountCents / 100).toFixed(2), reason, note.trim())) : null

  // Cada lectura de la lista (al abrir, tras enviar, al refrescar) concilia el intento por su llave.
  useEffect(() => {
    setPending(list.data ? reconcilePending(storeKey, mem, list.data) : loadPending(storeKey, mem))
  }, [list.data, storeKey])

  // A los 2 min de guardado, se relee la lista y se vuelve a pintar: «todavía en camino» pasa a «no llegó» si no aparece.
  useEffect(() => {
    if (!pending) return
    const left = pending.savedAt + ARRIVAL_MS - Date.now()
    if (left <= 0) return
    const id = setTimeout(() => {
      setTick(n => n + 1)
      void qc.invalidateQueries({ queryKey: onlineOrderingKeys.cardRefunds(venueId, order.orderId) })
    }, left + 500)
    return () => clearTimeout(id)
  }, [pending, qc, venueId, order.orderId])
  const view = pending ? pendingView(pending, list.isError ? undefined : list.data, Date.now()) : null

  const discard = () => {
    if (pending) clearPending(storeKey, mem, pending.key)
    setPending(loadPending(storeKey, mem))
    setBlocked(false)
  }

  const reread = () => {
    void qc.invalidateQueries({ queryKey: listKey })
    void qc.invalidateQueries({ queryKey: onlineOrderingKeys.inbox(venueId) })
    void qc.invalidateQueries({ queryKey: ['order', venueId, order.orderId] })
  }

  /** Desenlace definitivo de `key` ⇒ se olvida su llave; si no, queda guardada y se avisa. */
  const settle = (key: string, definitive: boolean) => {
    if (definitive) clearPending(storeKey, mem, key)
    setPending(loadPending(storeKey, mem))
  }

  const refund = useMutation({
    mutationFn: (v: { body: RefundBody; key: string }) => createCardRefund(venueId, order.orderId, v.body, v.key),
    onSuccess: (res, v) => {
      // PENDING y UNKNOWN siguen en curso en el servidor: repetir el mismo cuerpo debe dar la MISMA (replay). Lo demás ya terminó.
      settle(v.key, res.status !== 'PENDING' && res.status !== 'UNKNOWN')
      if (res.status === 'RECORDED') {
        setAmountStr(null)
        setReason(null)
        setNote('')
      }
      const failed = res.cardRefundStatus === 'FAILED' || res.cardRefundStatus === 'CANCELED'
      toast({ title: t(outcomeKey(res)), ...(failed ? { variant: 'destructive' as const } : {}) })
    },
    onError: (err, v) => {
      const doubt = inDoubt(err)
      settle(v.key, !doubt) // un 4xx es definitivo: el siguiente intento es otra operación
      if (doubt) return toast({ title: t('cardRefund.noResponse') })
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

  const submit = async (confirmed = false) => {
    if (!amountCents || !reason || busy.current) return
    const body = bodyOf((amountCents / 100).toFixed(2), reason, note.trim())
    setBlocked(false)
    // El mismo cuerpo que el pendiente (de aquí o de otra pestaña) siempre se puede reenviar con SU llave: el servidor repite.
    const same = loadPending(storeKey, mem)
    if (same && sigOfSaved(same) === sigOf(body)) return refund.mutate({ body, key: same.key })
    busy.current = true
    setChecking(true)
    try {
      // Se relee la lista ANTES de decidir: concilia el pendiente por su llave y busca una devolución igual de hace poco.
      const fresh = await list.refetch()
      // Sin la lista fresca no se sabe nada: no se manda (los datos viejos de la caché no cuentan).
      if (fresh.isError || !fresh.data) return void toast({ title: t('cardRefund.loadFailed'), variant: 'destructive' })
      const alive = reconcilePending(storeKey, mem, fresh.data)
      setPending(alive)
      if (alive) {
        if (sigOfSaved(alive) === sigOf(body)) return refund.mutate({ body, key: alive.key })
        return setBlocked(true) // otro cuerpo con un pendiente vivo: nunca lo reemplaza
      }
      if (!confirmed) {
        // ¿Ya hay una igual de hace poco? (otra pestaña sin almacenamiento, o un pendiente descartado)
        const now = Date.now()
        const twin = recentTwin(body.amount, fresh.data, now)
        if (twin) {
          const minutes = Math.max(0, Math.round((now - Date.parse(twin.createdAt)) / 60_000))
          return void setConfirm({ sig: sigOf(body), amount: body.amount, minutes })
        }
      }
      const key = crypto.randomUUID()
      // ANTES de tocar la red: una recarga a medio envío tampoco inventa otra llave.
      savePending(storeKey, mem, { key, amount: body.amount, reason: body.reason, note: body.note ?? '', savedAt: Date.now() })
      setConfirm(null)
      refund.mutate({ body, key })
    } finally {
      busy.current = false
      setChecking(false)
    }
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
          {pending && view && (
            <Alert role="status">
              <AlertDescription className="space-y-2">
                <p>{t(view.text, { amount: Currency(Number(pending.amount)) })}</p>
                {view.canDiscard && (
                  <Button type="button" size="sm" variant="outline" onClick={discard}>
                    {t('cardRefund.discard')}
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}
          {/* Con «Descartar y hacer otra» a la vista, el aviso de arriba ya dice qué hacer. */}
          {blocked && pending && !view?.canDiscard && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {t('cardRefund.blocked', { amount: Currency(Number(pending.amount)) })}
            </p>
          )}
          {confirm && confirm.sig === currentSig && (
            <Alert role="alert">
              <AlertDescription className="space-y-2">
                <p>{t('cardRefund.confirmAnother', { amount: Currency(Number(confirm.amount)), minutes: confirm.minutes })}</p>
                <Button type="button" size="sm" variant="destructive" disabled={refund.isPending || checking} onClick={() => void submit(true)}>
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
          <Button type="button" disabled={!amountCents || !reason || refund.isPending || checking} onClick={() => void submit()}>
            {refund.isPending ? t('cardRefund.sending') : t('cardRefund.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
