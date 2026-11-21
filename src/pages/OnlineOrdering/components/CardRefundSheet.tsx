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
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { falloDeCarga } from '@/lib/falloDeCarga'
import {
  createCardRefund,
  getOnlineOrder,
  listCardRefunds,
  onlineOrderingKeys,
  resolveCardRefund,
  serverMessage,
} from '@/services/onlineOrdering.service'
import type {
  CardRefund,
  CardRefundDestino,
  CardRefundReason,
  CardRefundResolveMethod,
  CardRefundResult,
  InboxOrder,
} from '@/types/onlineOrdering'
import { Currency } from '@/utils/currency'
import { useVenueDateTime } from '@/utils/datetime'

import { ponerDuda, quitarDuda, useDuda } from '../lib/devolucionEnDuda'
import { marcaDelPedido } from '../lib/marcaDelPedido'
import { invalidateToPay } from '../lib/toPayLive'
import { MarcaDelPedido } from './OrderCard'

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
const outcomeKey = (r: Pick<CardRefundResult, 'status' | 'cardRefundStatus'>) =>
  r.status === 'UNKNOWN' ? statusKey(undefined) : statusKey(r.cardRefundStatus)

const cents = (pesos: string | number) => Math.round(Number(pesos) * 100)

/**
 * Lo que aún se puede devolver, en centavos: lo cobrado menos todo lo que no sea FAILED o CANCELED. Una REVERSED sigue en el libro del
 * servidor (su tope la descuenta): ese dinero se devuelve por otro medio, no a la tarjeta (Q1).
 */
const refundableCents = (capturedAmount: number | null | undefined, refunds: CardRefund[]) =>
  Math.max(
    0,
    cents(capturedAmount ?? 0) -
      refunds.filter(r => r.status !== 'FAILED' && r.status !== 'CANCELED').reduce((sum, r) => sum + cents(r.amount), 0),
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

// D661: el destino viaja sólo en un pedido de «Nadie» (en «Mi equipo» la petición queda como siempre, sin él).
type RefundBody = { amount: string; reason: CardRefundReason; note?: string; destino?: CardRefundDestino }
const bodyOf = (amount: string, reason: CardRefundReason, note: string, destino?: CardRefundDestino): RefundBody => ({
  amount,
  reason,
  ...(note ? { note } : {}),
  ...(destino ? { destino } : {}),
})
const sigOf = (b: RefundBody) => JSON.stringify(b)

/** D661: el saldo a favor no se pudo (sin clienta, sin teléfono verificado, otro teléfono, sin llaves, tope…): queda la tarjeta. */
const sinSaldoAFavor = (code: unknown) =>
  typeof code === 'string' && (code.startsWith('STORE_CREDIT_') || code === 'REFUND_DESTINATION_NOT_AVAILABLE')
/** D661: un estado pasajero, no un error: el texto del servidor dice qué hacer y la lista se relee sola. */
const PASAJERO = new Set(['PRINT_IN_FLIGHT', 'ORDER_STATE_CHANGED'])

/**
 * Nunca devolver dos veces lo decide el SERVIDOR, no el navegador (Codex panel r4): cada devolución dice cuál es la última que vio el
 * operador, y bajo el candado de la orden sólo pasa si sigue siendo la última. Da igual el orden, la demora, las pestañas o las personas.
 * Por eso aquí no se guarda nada entre aperturas, salvo lo mandado sin respuesta (Ruling 61, `lib/devolucionEnDuda`): ese envío puede
 * ganar todavía y, hasta saber qué pasó, sólo se reintenta igual. Lo que se manda se congela en la memoria de la hoja: tocar otra vez lo
 * mismo reusa llave y vista (replay si ya llegó); una relectura NUNCA renueva la vista de un envío (si la lista cambió, hay que decidir
 * otra vez).
 */
type Attempt = { key: string; expected: string | null; sig: string }
/**
 * Ruling 61: lo que se mandó y todavía no se sabe en qué quedó (se anota ANTES de mandar); mientras exista, sólo se reintenta eso mismo
 * (`lib/devolucionEnDuda`). `desde`: cuándo salió la última petición con esa llave (la salida de 10 minutos cuenta desde ahí).
 */
type EnDuda = { body: RefundBody; attempt: Attempt; desde: number }
/** Ruling 61: muy por encima de la revisión de Stripe del SERVIDOR, que corre antes de crear la fila. */
const SALIDA_MS = 10 * 60_000

/** Ruling 60: las devoluciones que siguen en camino (la misma regla que el seguimiento público llama `PENDING`). */
const EN_CAMINO = new Set(['REQUESTED', 'SENDING', 'PENDING'])

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

/**
 * El botón y su hoja. Quien lo pinta ya comprobó `payments:refund` (el servidor lo vuelve a exigir). D661: un pedido de «Nadie» se
 * devuelve completo, a saldo a favor o a su tarjeta: «Cancelar y devolver» mientras está por entregar, «Devolver» ya cerrado.
 */
export function CardRefundButton({ venueId, order }: { venueId: string; order: InboxOrder }) {
  const { t } = useTranslation('onlineOrdering')
  const [open, setOpen] = useState(false)
  if (!isCardCaptured(order)) return null
  const label =
    order.requiresAcceptance !== false
      ? 'cardRefund.open'
      : order.status === 'COMPLETED'
        ? 'cardRefund.nadie.open'
        : 'cardRefund.nadie.cancelAndRefund'
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} data-tour="online-order-card-refund">
        {t(label)}
      </Button>
      {open && <CardRefundSheet venueId={venueId} order={order} onClose={() => setOpen(false)} />}
    </>
  )
}

/**
 * El detalle de la cuenta (vive siempre; la bandeja sólo guarda 24 h). Sólo una cuenta de origen en línea (`WEB`, o sin el dato) se
 * consulta por la ruta de S3; su 404 llega como `null` = no es pedido en línea, sin botón. D661: en qué quedó el pedido lo ve quien
 * ve la cuenta (`orders:read`, lo que pide esa ruta); el botón, sólo quien puede devolver (`payments:refund`).
 */
export function OrderCardRefund({ venueId, orderId, source }: { venueId: string; orderId: string; source?: string | null }) {
  const { can } = useAccess()
  const enabled = can('orders:read') && (!source || source === 'WEB')
  const { data } = useQuery({
    queryKey: onlineOrderingKeys.order(venueId, orderId),
    queryFn: () => getOnlineOrder(venueId, orderId),
    enabled: enabled && !!venueId,
  })
  const canRefund = can('payments:refund')
  if (!enabled || !data || (!(canRefund && isCardCaptured(data)) && !marcaDelPedido(data))) return null
  // D661: junto al botón, en qué quedó un pedido de «Nadie» («Devolviendo…», «Devuelto», «No lo recogió»).
  return (
    <div className="flex flex-wrap items-center gap-2">
      <MarcaDelPedido order={data} />
      {canRefund && <CardRefundButton venueId={venueId} order={data} />}
    </div>
  )
}

function CardRefundSheet({ venueId, order, onClose }: { venueId: string; order: InboxOrder; onClose: () => void }) {
  const { t } = useTranslation('onlineOrdering')
  const { t: tPay } = useTranslation('payment')
  const { toast } = useToast()
  const { can } = useAccess()
  const { formatDateTime } = useVenueDateTime()
  const { venue } = useCurrentVenue()
  const qc = useQueryClient()
  // D661: «Nadie» (los pedidos que entran solos) se devuelve completo, a saldo a favor o a su tarjeta; «Mi equipo», como siempre.
  const nadie = order.requiresAcceptance === false
  const negocio = venue?.name ?? t('cardRefund.destino.thisBusiness')

  // null = el cajero no ha tocado el monto: va lo que queda (la pista).
  const [amountStr, setAmountStr] = useState<string | null>(null)
  const [reason, setReason] = useState<CardRefundReason | null>(null)
  const [note, setNote] = useState('')
  // D661: nada viene elegido (decide quien devuelve). `sinSaldo` = por qué el saldo a favor no se puede (texto del servidor);
  // `porFuera` = ya se devolvió por fuera de Avoqado, en Stripe: no se ofrece ningún destino. Los dos son del pedido: duran lo que la hoja.
  const [destino, setDestino] = useState<CardRefundDestino | null>(null)
  const [sinSaldo, setSinSaldo] = useState<string | null>(null)
  const [porFuera, setPorFuera] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ sig: string; amount: string; minutes: number } | null>(null)
  // La última devolución que ve el operador. `undefined` = falta una lectura posterior a `readAfter`: sin ella no se manda.
  const [seen, setSeen] = useState<string | null | undefined>(undefined)
  const [readAfter, setReadAfter] = useState(() => Date.now())
  const [changed, setChanged] = useState(false)
  const [other, setOther] = useState<{ id: string; method: CardRefundResolveMethod } | null>(null)
  const attempt = useRef<Attempt | null>(null)
  const busy = useRef(false) // candado síncrono: `isPending` aún no cambia en el segundo de dos clics pegados
  // Ruling 61: lo mandado puede ganar hasta que se sepa qué pasó. Destino, monto, motivo, nota y llave quedan fijos desde que sale (también
  // si la hoja se cierra y se vuelve a abrir); sin una respuesta definitiva, sólo «Reintentar» (lo mismo) y «Cerrar».
  const enDuda = useDuda<EnDuda>(venueId, order.orderId)
  const ponerEnDuda = (d: EnDuda) => ponerDuda(venueId, order.orderId, d)
  const soltarDuda = () => quitarDuda(venueId, order.orderId)

  const listKey = onlineOrderingKeys.cardRefunds(venueId, order.orderId)
  // Cada apertura lee la lista aunque haya caché: lo que se decide debe salir de una lectura de ahora.
  const list = useQuery({ queryKey: listKey, queryFn: () => listCardRefunds(venueId, order.orderId), refetchOnMount: 'always' })
  const latest = list.data ? (list.data[0]?.id ?? null) : undefined
  const hint = list.data ? refundableCents(order.card?.capturedAmount, list.data) : null
  const fullAmount = hint ? (hint / 100).toFixed(2) : ''
  // «Nadie»: siempre lo que queda, el 100 % y sin editar (el servidor contesta FULL_REFUND_ONLY a otra cosa).
  const shownAmount = nadie ? fullAmount : (amountStr ?? fullAmount)
  const amountCents = parseCents(shownAmount)
  const sendDestino = nadie ? (destino ?? undefined) : undefined
  const currentSig =
    amountCents && reason && (!nadie || destino) ? sigOf(bodyOf((amountCents / 100).toFixed(2), reason, note.trim(), sendDestino)) : null

  const clearForm = () => {
    setAmountStr(null)
    setReason(null)
    setNote('')
    setDestino(null)
    setConfirm(null)
    attempt.current = null
  }
  /** Decidir otra vez: formulario vacío y una lectura posterior a este momento; hasta entonces «Devolver» queda apagado. */
  const startOver = () => {
    clearForm()
    setSeen(undefined)
    setReadAfter(Date.now())
  }

  // Todo lo que lee este pedido: la lista de devoluciones (va dentro de la llave del pedido), el pedido del detalle, la Bandeja,
  // «Por entregar» (D661: ahí se ve «Devolviendo…» y de ahí sale al cerrarse) y la cuenta.
  const reread = () => {
    void qc.invalidateQueries({ queryKey: onlineOrderingKeys.order(venueId, order.orderId) })
    void qc.invalidateQueries({ queryKey: onlineOrderingKeys.inbox(venueId) })
    void invalidateToPay(qc, venueId)
    void qc.invalidateQueries({ queryKey: ['order', venueId, order.orderId] })
  }

  const refund = useMutation({
    mutationFn: (v: { body: RefundBody; attempt: Attempt }) =>
      createCardRefund(venueId, order.orderId, { ...v.body, expectedLatestRefundId: v.attempt.expected }, v.attempt.key),
    onSuccess: (res, v) => {
      soltarDuda() // una respuesta definitiva para esa llave
      const failed = res.cardRefundStatus === 'FAILED' || res.cardRefundStatus === 'CANCELED'
      // También con FAILED: mientras tardó la respuesta pudo hacerse otra devolución, y el formulario lleno se la saltaría (Codex panel r5).
      startOver()
      // D661: a saldo a favor nace `RESOLVED` (en la tarjeta eso significa «ya se devolvió por otro medio»): se dice lo que es.
      const title =
        v.body.destino === 'STORE_CREDIT' && res.status === 'RECORDED' ? t('cardRefund.outcome.storeCredit') : t(outcomeKey(res))
      toast({ title, ...(failed ? { variant: 'destructive' as const } : {}) })
    },
    onError: err => {
      const code = codeOf(err)
      // Ruling 61 (enmendado): una respuesta pasajera —sin respuesta, 5xx, 408, o el SERVIDOR pidiendo intentar en un momento
      // (STRIPE_REFUND_CHECK_UNAVAILABLE, PRINT_IN_FLIGHT, ORDER_STATE_CHANGED)— no dice qué pasó con una petición anterior con la misma
      // llave: la duda (anotada al mandar) se queda y sólo se ofrece «Reintentar». Sin código, «no hubo respuesta»; con él, su texto.
      if (inDoubt(err) || (typeof code === 'string' && PASAJERO.has(code))) {
        return toast({ title: typeof code === 'string' ? serverMessage(err, t('cardRefund.noResponse')) : t('cardRefund.noResponse') })
      }
      soltarDuda() // un rechazo definitivo: esa llave no hizo ni va a hacer nada
      attempt.current = null
      if (code === 'CARD_REFUND_STALE_VIEW') {
        startOver()
        setChanged(true)
        return
      }
      // D661: alguien ya devolvió este cobro por fuera, directo en Stripe: ningún destino ni reintento; se termina desde Stripe.
      if (code === 'EXTERNAL_REFUND_DETECTED') return setPorFuera(serverMessage(err, t('cardRefund.error')))
      // D661: el saldo a favor no se pudo: se dice por qué, en la hoja, y queda «A su tarjeta», ya elegida.
      if (sinSaldoAFavor(code)) {
        setSinSaldo(serverMessage(err, t('cardRefund.error')))
        setDestino('CARD')
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

  // Ruling 61: si la lista ya trae una devolución más nueva que la que se vio al mandar, se sabe qué pasó (si no fue esa petición, el
  // SERVIDOR ya no la deja hacer otra: pide la misma «última vista»). Una lista sin nada nuevo NO suelta: la primera petición pudo no
  // haber creado su fila todavía (el SERVIDOR revisa Stripe antes de crearla). La salida: una lectura de 10 minutos después de la última
  // petición, sin nada nuevo, ya no puede cruzarse con ella.
  const salidaEn = enDuda ? enDuda.desde + SALIDA_MS : null
  useEffect(() => {
    if (!enDuda || latest === undefined) return
    if (latest !== enDuda.attempt.expected || list.dataUpdatedAt >= enDuda.desde + SALIDA_MS) quitarDuda(venueId, order.orderId)
  }, [enDuda, latest, list.dataUpdatedAt, venueId, order.orderId])
  // …y si la hoja sigue abierta, esa lectura se pide sola al cumplirse los 10 minutos.
  useEffect(() => {
    if (salidaEn === null || refund.isPending) return
    const id = setTimeout(
      () => void qc.invalidateQueries({ queryKey: onlineOrderingKeys.cardRefunds(venueId, order.orderId) }),
      Math.max(0, salidaEn - Date.now()) + 100,
    )
    return () => clearTimeout(id)
  }, [salidaEn, refund.isPending, qc, venueId, order.orderId])

  // Sólo se decide con el historial a la vista: si la relectura falló o está en pausa (sin internet), se oculta y no se manda.
  const canSend = seen !== undefined && !list.isError && !list.isPaused

  const resolve = useMutation({
    mutationFn: (v: { refundId: string; method: CardRefundResolveMethod }) =>
      resolveCardRefund(venueId, order.orderId, v.refundId, { method: v.method }),
    onSuccess: () => toast({ title: t('cardRefund.outcome.resolved') }),
    // 409 CASH_DRAWER_NOT_OPEN y los demás: el texto del servidor. Repetir es idempotente.
    onError: err => toast({ title: serverMessage(err, t('cardRefund.error')), variant: 'destructive' }),
    onSettled: () => {
      setOther(null)
      reread()
    },
  })

  // D661: en «Nadie» falta elegir a dónde; con una devolución hecha por fuera (en Stripe) no se manda nada.
  const blocked = (nadie && !destino) || !!porFuera

  const submit = (confirmed = false) => {
    if (enDuda || !amountCents || !reason || !canSend || blocked || busy.current) return
    const body = bodyOf((amountCents / 100).toFixed(2), reason, note.trim(), sendDestino)
    const sig = sigOf(body)
    setChanged(false)
    if (attempt.current?.sig === sig) {
      busy.current = true
      const otraVez = { body, attempt: attempt.current, desde: Date.now() }
      ponerEnDuda(otraVez) // Ruling 61: anotada ANTES de mandar
      return refund.mutate(otraVez)
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
    // Ruling 61: anotada ANTES de mandar: si la hoja se cierra mientras dice «Devolviendo…», al volver a abrirla sale fija.
    const envio = { body, attempt: attempt.current, desde: Date.now() }
    ponerEnDuda(envio)
    refund.mutate(envio)
  }

  /** Ruling 61: lo mismo que se mandó, con la misma llave y la misma «última vista»; los 10 minutos cuentan desde este envío. */
  const retry = () => {
    if (!enDuda || busy.current) return
    busy.current = true
    const otraVez = { ...enDuda, desde: Date.now() }
    ponerEnDuda(otraVez)
    refund.mutate(otraVez)
  }
  // Fija (sin la petición de esta hoja en camino): lo único que se puede hacer es «Reintentar» o «Cerrar».
  const fija = !!enDuda && !refund.isPending

  // Lo que se ve en el formulario: lo mandado mientras esté en duda; si no, lo que se está llenando.
  const destinoVisto = enDuda ? (enDuda.body.destino ?? null) : destino
  const motivoVisto = enDuda ? enDuda.body.reason : reason
  const notaVista = enDuda ? (enDuda.body.note ?? '') : note
  // Ruling 60: sin nada por devolver a la tarjeta, la hoja dice cómo está el dinero: en camino, regresado por el banco o ya nada.
  const enCamino = !!list.data?.some(r => EN_CAMINO.has(r.status))
  const seDebe = !!list.data?.some(r => r.status === 'REVERSED' && !r.reversal?.resolvedAt)

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {nadie ? t('cardRefund.nadie.title', { folio: order.orderNumber }) : t('cardRefund.title', { number: order.orderNumber })}
          </DialogTitle>
          <DialogDescription>
            {t(nadie ? 'cardRefund.nadie.description' : 'cardRefund.description')}
            {/* D661: «Cancelar y devolver» no avisa a nadie; quien devuelve le avisa a cocina (límite declarado de la promesa). */}
            {nadie && order.status !== 'COMPLETED' && <span className="block">{t('cardRefund.nadie.kitchen')}</span>}
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-2">
          <h3 className="text-sm font-medium">{t('cardRefund.history')}</h3>
          {/* Lo leído sigue a la vista, marcado como posiblemente viejo; con él no se decide: enviar y resolver quedan bloqueados. */}
          {falloDeCarga(list) && (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-destructive">{t('cardRefund.loadFailed')}</p>
              <Button type="button" size="sm" variant="outline" disabled={list.isFetching} onClick={() => void list.refetch()}>
                {t('cardRefund.reload')}
              </Button>
            </div>
          )}
          {list.data === undefined ? (
            !falloDeCarga(list) && <Skeleton className="h-12 w-full rounded-lg" />
          ) : !list.data.length ? (
            <p className="text-sm text-muted-foreground">{t('cardRefund.empty')}</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-input">
              {list.data.map(r => (
                <li key={r.id} data-testid={`card-refund-${r.id}`} className="space-y-1 p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{Currency(Number(r.amount))}</span>
                    {/* D661: la de saldo a favor nace RESOLVED; en la tarjeta eso es «ya se devolvió por otro medio». */}
                    <span className="text-right text-muted-foreground">
                      {t(r.toStoreCredit ? 'cardRefund.outcome.storeCredit' : statusKey(r.status))}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(r.createdAt)} · {tPay(`refund.reasons.${r.reason}`)}
                  </p>
                  {canSend &&
                    !enDuda &&
                    r.status === 'REVERSED' &&
                    !r.reversal?.resolvedAt &&
                    (other?.id === r.id ? (
                      // Sale de la caja o queda anotado, y no se deshace: nunca con un solo toque (Q1).
                      <div className="space-y-2 pt-1">
                        <p className="text-xs font-medium">
                          {t(`cardRefund.other.confirm${other.method}`, { amount: Currency(Number(r.amount)) })}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={resolve.isPending}
                            onClick={() => resolve.mutate({ refundId: r.id, method: other.method })}
                          >
                            {t('cardRefund.other.confirmYes')}
                          </Button>
                          <Button type="button" size="sm" variant="outline" disabled={resolve.isPending} onClick={() => setOther(null)}>
                            {t('cardRefund.other.confirmNo')}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="text-xs font-medium">{t('cardRefund.other.title')}</span>
                        {can('payments:refund-to-cash') && (
                          <Button type="button" size="sm" variant="outline" onClick={() => setOther({ id: r.id, method: 'CASH' })}>
                            {t('cardRefund.other.cash')}
                          </Button>
                        )}
                        {can('payments:refund') && (
                          <Button type="button" size="sm" variant="outline" onClick={() => setOther({ id: r.id, method: 'BANK_TRANSFER' })}>
                            {t('cardRefund.other.transfer')}
                          </Button>
                        )}
                      </div>
                    ))}
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
          {fija && (
            <Alert role="status">
              <AlertDescription className="space-y-1">
                <p>{t('cardRefund.lockedTitle')}</p>
                <p>{t('cardRefund.lockedHint')}</p>
                <p>{t('cardRefund.lockedExit')}</p>
              </AlertDescription>
            </Alert>
          )}
          {!enDuda && confirm && confirm.sig === currentSig && (
            <Alert role="alert">
              <AlertDescription className="space-y-2">
                <p>{t('cardRefund.confirmAnother', { amount: Currency(Number(confirm.amount)), minutes: confirm.minutes })}</p>
                <Button type="button" size="sm" variant="destructive" disabled={refund.isPending} onClick={() => submit(true)}>
                  {t('cardRefund.confirmYes')}
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {porFuera && (
            <Alert variant="destructive">
              <AlertDescription>{porFuera}</AlertDescription>
            </Alert>
          )}
          {nadie ? (
            <>
              {hint !== null && (
                <p className="text-sm font-medium">
                  {hint
                    ? t('cardRefund.nadie.amount', { amount: Currency(hint / 100) })
                    : enCamino
                      ? t('cardRefund.nadie.inProcess')
                      : seDebe
                        ? t('inbox.card.mark.reversed')
                        : t('cardRefund.nadie.nothingLeft')}
                </p>
              )}
              <div className="space-y-1.5">
                <p className="text-sm font-medium">{t('cardRefund.destino.title')}</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    className="h-auto whitespace-normal py-2"
                    data-tour="online-order-refund-store-credit"
                    variant={destinoVisto === 'STORE_CREDIT' ? 'default' : 'outline'}
                    aria-pressed={destinoVisto === 'STORE_CREDIT'}
                    disabled={!!sinSaldo || !!porFuera || !!enDuda}
                    onClick={() => setDestino('STORE_CREDIT')}
                  >
                    {t('cardRefund.destino.storeCredit', { negocio })}
                  </Button>
                  <Button
                    type="button"
                    className="h-auto whitespace-normal py-2"
                    data-tour="online-order-refund-card"
                    variant={destinoVisto === 'CARD' ? 'default' : 'outline'}
                    aria-pressed={destinoVisto === 'CARD'}
                    disabled={!!porFuera || !!enDuda}
                    onClick={() => setDestino('CARD')}
                  >
                    {t('cardRefund.destino.card')}
                  </Button>
                </div>
                {sinSaldo ? (
                  <p role="alert" className="text-xs">
                    {sinSaldo}
                  </p>
                ) : (
                  destinoVisto === 'STORE_CREDIT' && (
                    <p className="text-xs text-muted-foreground">{t('cardRefund.destino.storeCreditHelp', { negocio })}</p>
                  )
                )}
                {destinoVisto === 'CARD' && <p className="text-xs font-medium">{t('cardRefund.destino.cardFee')}</p>}
              </div>
            </>
          ) : (
            <>
              {hint !== null && <p className="text-sm font-medium">{t('cardRefund.upTo', { amount: Currency(hint / 100) })}</p>}
              <div className="space-y-1.5">
                <Label htmlFor="card-refund-amount">{t('cardRefund.amount')}</Label>
                <Input
                  id="card-refund-amount"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={enDuda ? enDuda.body.amount : shownAmount}
                  disabled={!!enDuda}
                  onChange={e => setAmountStr(e.target.value)}
                />
                {!enDuda && shownAmount !== '' && !amountCents && (
                  <p className="text-xs text-destructive">{t('cardRefund.amountInvalid')}</p>
                )}
              </div>
            </>
          )}
          <div className="space-y-1.5">
            <p className="text-sm font-medium">{t('cardRefund.reason')}</p>
            <div className="grid grid-cols-2 gap-2">
              {REASONS.map(r => (
                <Button
                  key={r}
                  type="button"
                  variant={motivoVisto === r ? 'default' : 'outline'}
                  aria-pressed={motivoVisto === r}
                  disabled={!!enDuda}
                  onClick={() => setReason(r)}
                >
                  {tPay(`refund.reasons.${r}`)}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="card-refund-note">{t('cardRefund.note')}</Label>
            <Textarea
              id="card-refund-note"
              maxLength={NOTE_MAX}
              value={notaVista}
              disabled={!!enDuda}
              onChange={e => setNote(e.target.value)}
            />
            <p className="text-right text-xs text-muted-foreground">
              {notaVista.length}/{NOTE_MAX}
            </p>
          </div>
        </div>

        <DialogFooter>
          {fija ? (
            // Ruling 61: lo único que se puede hacer hasta saber qué pasó.
            <>
              <Button type="button" variant="outline" onClick={onClose}>
                {t('cardRefund.close')}
              </Button>
              <Button type="button" onClick={retry}>
                {t('cardRefund.retry')}
              </Button>
            </>
          ) : (
            <Button type="button" disabled={!amountCents || !reason || !canSend || blocked || refund.isPending} onClick={() => submit()}>
              {refund.isPending
                ? t('cardRefund.sending')
                : nadie
                  ? t('cardRefund.nadie.submit', { amount: Currency((amountCents ?? 0) / 100) })
                  : t('cardRefund.submit')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
