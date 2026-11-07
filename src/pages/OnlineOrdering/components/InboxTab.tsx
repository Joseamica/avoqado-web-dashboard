import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Volume2, WifiOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useOnlineOrderingStatus } from '@/hooks/use-online-ordering-status'
import { planTierQueryKey } from '@/hooks/use-tier-feature-access'
import { useToast } from '@/hooks/use-toast'
import {
  acceptOrder,
  cancelOrder,
  getInbox,
  getSettings,
  getToPay,
  markDelivered,
  markReady,
  onlineOrderingKeys,
  rejectOrder,
  serverMessage,
} from '@/services/onlineOrdering.service'
import type { FolioOrder, Inbox, InboxOrder, OnlineOrderStatus, ToPayResponse } from '@/types/onlineOrdering'
import { useVenueDateTime } from '@/utils/datetime'

import { useExtraPages } from '../hooks/useExtraPages'
import { useOnlineOrdersInbox } from '../hooks/useOnlineOrdersInbox'
import { actionOutcome } from '../lib/actionOutcome'
import { createChime, type Chime } from '../lib/chime'
import { pauseLabel } from '../lib/pauseLabel'
import { spaceFolio } from '../lib/spaceFolio'
import { invalidateToPay } from '../lib/toPayLive'
import { AcceptDialog } from './AcceptDialog'
import { CardRefundButton } from './CardRefundSheet'
import { FolioSections, type FolioAction, type FolioHide } from './FolioSections'
import { OrderCard, type OrderAction } from './OrderCard'
import { PauseControl } from './PauseControl'
import { RejectDialog } from './RejectDialog'

// Un solo timbre por pestaña del navegador: desbloqueado una vez, sigue sonando al volver de Menú o Configuración.
let sharedChime: Chime | null = null
const chime = () => (sharedChime ??= createChime())

const SOUND_KEY = 'avq:online-orders:sound'
const readSoundPref = () => {
  try {
    return window.localStorage.getItem(SOUND_KEY) === '1'
  } catch {
    return false
  }
}
const writeSoundPref = (on: boolean) => {
  try {
    window.localStorage.setItem(SOUND_KEY, on ? '1' : '0')
  } catch {
    // Sin almacenamiento (modo privado): la preferencia dura lo que dure la pestaña.
  }
}

const SECTIONS: Array<{ key: keyof Inbox['counts']; match: (s: OnlineOrderStatus) => boolean }> = [
  { key: 'pending', match: s => s === 'PENDING_ACCEPTANCE' },
  { key: 'accepted', match: s => s === 'ACCEPTED' },
  { key: 'ready', match: s => s === 'READY' },
  { key: 'done', match: s => s !== 'PENDING_ACCEPTANCE' && s !== 'ACCEPTED' && s !== 'READY' },
]

type DialogState = { kind: 'accept' | 'reject' | 'cancel' | 'cancelFolio'; order: InboxOrder } | null
type Act = { target: OnlineOrderStatus; run: () => Promise<unknown>; orderId?: string; okTitle?: string; hide?: FolioHide }

/**
 * Bandeja de pedidos en línea. 🔴 No depende del plan (R14): los pedidos que ya llegaron se ven, se contestan y se pausan.
 * Sólo late (mantiene abierta la tienda) si quien mira puede contestar, la pestaña está visible y es esta pantalla.
 */
export function InboxTab() {
  const { t } = useTranslation('onlineOrdering')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { formatTime } = useVenueDateTime()
  const venueId = useCurrentVenue().venueId ?? ''
  const { hasPlan, canAnswer, canCancel, canPause, canRefund, keepsStoreOpen } = useOnlineOrderingStatus()
  const { data, isError, error, dataUpdatedAt, refetch: refetchInbox } = useOnlineOrdersInbox(venueId, { trayActive: () => keepsStoreOpen })

  const [dialog, setDialog] = useState<DialogState>(null)
  // 409 CONFIRMING: «Aceptar» de ese pedido queda apagado hasta que una lectura EXITOSA posterior (dataUpdatedAt > la hora del
  // 409) lo traiga sin `cardStatus: 'CONFIRMING'`. Una relectura fallida no mueve `dataUpdatedAt`: sigue apagado.
  const [confirmingSince, setConfirmingSince] = useState<Record<string, number>>({})
  // Folios de «Nadie» ya tocados con éxito: salen de «Por pagar»/«Por entregar» sin esperar al sondeo.
  const [touched, setTouched] = useState<ReadonlyMap<string, FolioHide>>(new Map())
  const [soundOn, setSoundOn] = useState(readSoundPref)
  const [, rerender] = useReducer((n: number) => n + 1, 0)
  const pending = data?.counts.pending ?? 0
  // Más de 100 activos: la Bandeja sigue con `nextCursor` (status=active) y los relee en cada sondeo, como los folios.
  const onMoreError = useCallback(() => toast({ title: t('inbox.sections.loadMoreFailed'), variant: 'destructive' }), [toast, t])
  const activeMore = useExtraPages(
    data?.nextCursor ?? null,
    dataUpdatedAt,
    async cursor => {
      const page = await getInbox(venueId, { tray: false, status: 'active', cursor })
      return { items: page.orders, next: page.nextCursor }
    },
    onMoreError,
    o => o.orderId,
  )

  // Insiste en cada sondeo mientras haya algo por aceptar (`play()` no hace nada si el navegador no ha dejado sonar).
  useEffect(() => {
    if (soundOn && pending > 0) chime().play()
  }, [dataUpdatedAt, soundOn, pending])

  // El plan se cachea 5 min: con el plan vencido cada sondeo vuelve a pedirlo, para que el aviso se vaya solo al reactivarlo.
  useEffect(() => {
    if (!hasPlan && dataUpdatedAt) void queryClient.invalidateQueries({ queryKey: planTierQueryKey(venueId) })
  }, [hasPlan, dataUpdatedAt, venueId, queryClient])

  const refresh = () =>
    Promise.all([queryClient.invalidateQueries({ queryKey: onlineOrderingKeys.inbox(venueId) }), invalidateToPay(queryClient, venueId)])

  // `isPending` llega en otro turno del navegador: dos clics seguidos (7 ms) se cuelan antes de que el botón se deshabilite.
  // Este candado se cierra en el mismo clic y se suelta al terminar (con éxito o sin él), justo antes de que `isPending` baje.
  const inFlight = useRef(false)
  const action = useMutation({
    mutationFn: (a: Act) => a.run(),
    onSettled: () => {
      inFlight.current = false
    },
    onSuccess: (_res, a: Act) => {
      if (a.orderId && a.hide) setTouched(s => new Map(s).set(a.orderId!, a.hide!))
      if (a.okTitle) toast({ title: a.okTitle })
      return refresh()
    },
    // onSuccess/onError DEVUELVEN el refresco: `isPending` lo cubre y los botones no se reactivan con la tarjeta vieja.
    onError: (err: unknown, a: Act) => {
      const outcome = actionOutcome(err, a.target)
      if (a.orderId && a.hide && (outcome === 'success' || outcome === 'gone')) setTouched(s => new Map(s).set(a.orderId!, a.hide!))
      if (outcome === 'success') return refresh()
      if (outcome === 'confirming' && a.orderId) setConfirmingSince(m => ({ ...m, [a.orderId!]: Date.now() }))
      const title =
        outcome === 'gone'
          ? t('inbox.outcome.gone')
          : outcome === 'paymentRequired'
            ? t('inbox.card.collectFirst')
            : outcome === 'hasPayments'
              ? t('inbox.outcome.hasPayments')
              : outcome === 'network'
                ? t('inbox.outcome.network')
                : outcome === 'confirming'
                  ? serverMessage(err, t('inbox.card.cardConfirming'))
                  : outcome === 'paidByCard'
                    ? serverMessage(err, t('inbox.card.cardPaid'))
                    : serverMessage(err, t('inbox.outcome.error'))
      toast({ title, ...(outcome === 'error' ? { variant: 'destructive' as const } : {}) })
      return outcome === 'network' ? undefined : refresh()
    },
  })

  const run = (target: OnlineOrderStatus, fn: () => Promise<unknown>, orderId?: string, okTitle?: string, hide?: FolioHide) => {
    if (inFlight.current) return
    inFlight.current = true
    setDialog(null)
    action.mutate({ target, run: fn, orderId, okTitle, hide })
  }

  const onAction = (order: InboxOrder, a: OrderAction) => {
    if (a === 'ready') return run('READY', () => markReady(venueId, order.orderId))
    if (a === 'delivered') return run('COMPLETED', () => markDelivered(venueId, order.orderId))
    setDialog({ kind: a, order })
  }

  // Lo más reciente que se sabe del folio (la primera página de to-pay) al CONFIRMAR, no al abrir el diálogo.
  const latest = (o: FolioOrder): FolioOrder => {
    const d = queryClient.getQueryData<ToPayResponse>(onlineOrderingKeys.toPay(venueId))
    return [...(d?.toPay ?? []), ...(d?.toDeliver ?? [])].find(x => x.orderId === o.orderId) ?? o
  }
  const hideOf = (o: FolioOrder, section: 'toPay' | 'toDeliver'): FolioHide => {
    const c = latest(o)
    return { section, status: c.status, remainingCents: Math.round(c.remaining * 100) }
  }
  const onFolioAct = (order: FolioOrder, a: FolioAction) => {
    if (a === 'ready') return run('READY', () => markReady(venueId, order.orderId), order.orderId, undefined, hideOf(order, 'toDeliver'))
    if (a === 'delivered') {
      const okTitle = order.customerName
        ? t('folio.delivered', { folio: spaceFolio(order.orderNumber), name: order.customerName })
        : t('folio.deliveredNoName', { folio: spaceFolio(order.orderNumber) })
      return run('COMPLETED', () => markDelivered(venueId, order.orderId), order.orderId, okTitle, hideOf(order, 'toDeliver'))
    }
    setDialog({ kind: 'cancelFolio', order })
  }

  const unlockSound = async () => {
    await chime().unlock()
    rerender()
  }
  const toggleSound = (on: boolean) => {
    // Primero la preferencia: si `resume()` nunca resuelve (Safari), el interruptor no se traba.
    writeSoundPref(on)
    setSoundOn(on)
    if (on) unlockSound().catch(() => {}) // el estado ya quedó guardado; dentro del clic: es lo que el navegador exige para dejar sonar
  }

  // R88: los folios de «Nadie» viven de su propia consulta; SIEMPRE montados, aunque la Bandeja falle o aún cargue. La Bandeja
  // sólo les da un empujón único con los folios de «Nadie» ACTIVOS que ve (ni cerrados ni cancelados).
  // «Nadie»: la tienda no la mantiene abierta esta pestaña sino el latido de la TPV o el POS con «Pedidos por pagar».
  // Manda la lectura fresca de to-pay; mientras no haya (o si falla) sirven los ajustes. Es sólo un TEXTO: el modo de sondeo no lo lee.
  const toPayNadie = useQuery({
    queryKey: onlineOrderingKeys.toPay(venueId),
    queryFn: () => getToPay(venueId),
    enabled: false,
    select: d => d.requiresAcceptance === false,
  }).data
  const settingsNadie = useQuery({
    queryKey: onlineOrderingKeys.settings(venueId),
    queryFn: () => getSettings(venueId),
    enabled: !!venueId,
    retry: false,
    select: st => st.requiresAcceptance === false,
  }).data
  const nadieMode = toPayNadie ?? settingsNadie === true
  const CLOSED: ReadonlySet<string> = new Set(['COMPLETED', 'REJECTED', 'EXPIRED', 'CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_STAFF'])
  const nadieIds = [...(data?.orders ?? []), ...activeMore.items]
    .filter(o => o.requiresAcceptance === false && !CLOSED.has(o.status))
    .map(o => o.orderId)
  const dialogs = (
    <>
      {dialog?.kind === 'accept' && (
        <AcceptDialog
          order={dialog.order}
          onClose={() => setDialog(null)}
          onAccept={minutes => run('ACCEPTED', () => acceptOrder(venueId, dialog.order.orderId, minutes), dialog.order.orderId)}
        />
      )}
      {dialog?.kind === 'reject' && (
        <RejectDialog
          order={dialog.order}
          onClose={() => setDialog(null)}
          onReject={(reason, note) => run('REJECTED', () => rejectOrder(venueId, dialog.order.orderId, reason, note))}
        />
      )}
      {dialog?.kind === 'cancelFolio' && (
        <AlertDialog open onOpenChange={open => !open && setDialog(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('folio.cancelDialog.title', { folio: spaceFolio(dialog.order.orderNumber) })}</AlertDialogTitle>
              <AlertDialogDescription>
                {dialog.order.customerName
                  ? t('folio.cancelDialog.description', { name: dialog.order.customerName })
                  : t('folio.cancelDialog.descriptionNoName')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('folio.cancelDialog.back')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  run(
                    'CANCELLED_BY_STAFF',
                    () => cancelOrder(venueId, dialog.order.orderId),
                    dialog.order.orderId,
                    undefined,
                    hideOf(dialog.order, 'toPay'),
                  )
                }
              >
                {t('folio.cancelDialog.confirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {dialog?.kind === 'cancel' && (
        <AlertDialog open onOpenChange={open => !open && setDialog(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('inbox.cancel.title', { number: dialog.order.orderNumber })}</AlertDialogTitle>
              <AlertDialogDescription>{t('inbox.cancel.description')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('inbox.cancel.back')}</AlertDialogCancel>
              <AlertDialogAction onClick={() => run('CANCELLED_BY_STAFF', () => cancelOrder(venueId, dialog.order.orderId))}>
                {t('inbox.cancel.confirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  )
  const folioSections = (
    <FolioSections
      venueId={venueId}
      canAnswer={canAnswer}
      canCancel={canCancel}
      busy={action.isPending}
      hidden={touched}
      actionsLocked={isError}
      inboxIds={data ? [...data.orders, ...activeMore.items].map(o => o.orderId) : undefined}
      onPrune={ids =>
        setTouched(m => {
          const n = new Map(m)
          ids.forEach(id => n.delete(id))
          return n
        })
      }
      inboxNadieIds={nadieIds}
      onAct={onFolioAct}
    />
  )

  if (!data) {
    // Misma forma que el return de abajo (3 huecos: encabezado · folios · resto) para que FolioSections no se desmonte al llegar la Bandeja.
    return (
      <div className="space-y-4">
        <>
          {isError ? (
            <Alert variant="destructive">
              <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                {serverMessage(error, t('inbox.loadFailed'))}
                <Button size="sm" variant="outline" onClick={() => void refetchInbox()}>
                  {t('folio.retry')}
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3" data-testid="online-inbox-loading">
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-40 w-full rounded-xl" />
            </div>
          )}
        </>
        {folioSections}
        <></>
        {dialogs}
      </div>
    )
  }

  const store = data.store
  const pause = pauseLabel(store, formatTime)
  // Sin plan no llegan pedidos nuevos (el comensal recibe PLAN_REQUIRED) y quien no puede mantener abierta la tienda no
  // debe leer «deja la Bandeja abierta»: el texto no promete lo que no es cierto.
  const statusText = !hasPlan
    ? t('inbox.status.noPlan')
    : pause
      ? t(pause.key, pause.params)
      : store?.status === 'OFFLINE' && nadieMode
        ? t('inbox.status.offlineNadie')
        : store?.status === 'OFFLINE' && !keepsStoreOpen
          ? t('inbox.status.offlineNobody')
          : t(`settings.status.${store?.status}`, { defaultValue: store?.status })
  const soundSupported = chime().state() !== 'unsupported'
  const skewMs = Date.parse(data.serverTime) - dataUpdatedAt

  return (
    <div className="space-y-4" data-testid="online-inbox">
      <>
        <div className="space-y-3 rounded-xl border border-input p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {store && (
              <p className="text-sm">
                <span className="text-muted-foreground">{t('settings.status.label')}: </span>
                <span className="font-medium">{statusText}</span>
              </p>
            )}
            <PauseControl venueId={venueId} store={store} canPause={canPause} />
          </div>
          <p className="text-sm text-muted-foreground">
            {nadieMode ? t('inbox.keepsOpenNadie') : keepsStoreOpen ? t('inbox.keepsOpen') : t('inbox.viewOnly')}
          </p>
          {soundSupported ? (
            <div className="flex items-center gap-2">
              <Switch id="online-inbox-sound" checked={soundOn} onCheckedChange={toggleSound} data-tour="online-inbox-sound" />
              <Label htmlFor="online-inbox-sound">{t('inbox.sound.toggle')}</Label>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('inbox.sound.unsupported')}</p>
          )}
        </div>

        {isError && (
          <Alert>
            <WifiOff className="h-4 w-4" />
            <AlertDescription>{t('inbox.offline')}</AlertDescription>
          </Alert>
        )}
        {soundSupported && soundOn && chime().state() !== 'running' && (
          <Button variant="outline" className="w-full" onClick={unlockSound} data-tour="online-inbox-unlock-sound">
            <Volume2 />
            {t('inbox.sound.unlock')}
          </Button>
        )}
        {soundSupported && !soundOn && pending > 0 && (
          <p className="rounded-xl bg-muted/50 p-3 text-sm font-medium">{t('inbox.sound.nag')}</p>
        )}
      </>
      {folioSections}
      <>
        {SECTIONS.map(section => {
          // Los folios de «Nadie» ya están en «Por entregar»: no se repiten en «En preparación».
          const seen = new Set(data.orders.map(o => o.orderId))
          const all = [...data.orders, ...activeMore.items.filter(o => !seen.has(o.orderId))]
          const list = all.filter(o => section.match(o.status) && !(section.key === 'accepted' && o.requiresAcceptance === false))
          const total = section.key === 'accepted' ? (data.counts.acceptedTeam ?? data.counts.accepted) : data.counts[section.key]
          return (
            <section key={section.key} className="space-y-2">
              <h2 className="text-base font-semibold">
                {t(`inbox.sections.${section.key}`)} <span className="text-muted-foreground">({total})</span>
              </h2>
              {list.length < total && (
                <p className="text-xs text-muted-foreground">{t('inbox.sections.showing', { shown: list.length, total })}</p>
              )}
              {list.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('inbox.sections.empty')}</p>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {list.map(order => (
                    <OrderCard
                      key={order.orderId}
                      order={order}
                      skewMs={skewMs}
                      canAnswer={canAnswer}
                      canCancel={canCancel}
                      busy={action.isPending}
                      acceptLocked={order.orderId in confirmingSince && dataUpdatedAt <= confirmingSince[order.orderId]}
                      onAction={a => onAction(order, a)}
                    >
                      {canRefund && <CardRefundButton venueId={venueId} order={order} />}
                    </OrderCard>
                  ))}
                </div>
              )}
              {activeMore.next && (section.key === 'accepted' || section.key === 'ready') && (
                <Button variant="outline" className="w-full" disabled={activeMore.loading} onClick={() => void activeMore.loadMore()}>
                  {t('inbox.sections.loadMore')}
                </Button>
              )}
            </section>
          )
        })}
      </>
      {dialogs}
    </div>
  )
}
