import { useEffect, useReducer, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
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
import { useToast } from '@/hooks/use-toast'
import {
  acceptOrder,
  cancelOrder,
  markDelivered,
  markReady,
  onlineOrderingKeys,
  rejectOrder,
  serverMessage,
} from '@/services/onlineOrdering.service'
import type { Inbox, InboxOrder, OnlineOrderStatus } from '@/types/onlineOrdering'
import { useVenueDateTime } from '@/utils/datetime'

import { useOnlineOrdersInbox } from '../hooks/useOnlineOrdersInbox'
import { actionOutcome } from '../lib/actionOutcome'
import { createChime, type Chime } from '../lib/chime'
import { pauseLabel } from '../lib/pauseLabel'
import { AcceptDialog } from './AcceptDialog'
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

type DialogState = { kind: 'accept' | 'reject' | 'cancel'; order: InboxOrder } | null
type Act = { target: OnlineOrderStatus; run: () => Promise<unknown> }

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
  const { canAnswer, canCancel, canPause, keepsStoreOpen } = useOnlineOrderingStatus()
  const { data, isError, error, dataUpdatedAt } = useOnlineOrdersInbox(venueId, { trayActive: () => keepsStoreOpen })

  const [dialog, setDialog] = useState<DialogState>(null)
  const [soundOn, setSoundOn] = useState(readSoundPref)
  const [, rerender] = useReducer((n: number) => n + 1, 0)
  const pending = data?.counts.pending ?? 0

  // Insiste en cada sondeo mientras haya algo por aceptar (`play()` no hace nada si el navegador no ha dejado sonar).
  useEffect(() => {
    if (soundOn && pending > 0) chime().play()
  }, [dataUpdatedAt, soundOn, pending])

  const refresh = () => queryClient.invalidateQueries({ queryKey: onlineOrderingKeys.inbox(venueId) })

  const action = useMutation({
    mutationFn: (a: Act) => a.run(),
    onSuccess: () => refresh(),
    // onSuccess/onError DEVUELVEN el refresco: `isPending` lo cubre y los botones no se reactivan con la tarjeta vieja.
    onError: (err: unknown, a: Act) => {
      const outcome = actionOutcome(err, a.target)
      if (outcome === 'success') return refresh()
      const title =
        outcome === 'gone'
          ? t('inbox.outcome.gone')
          : outcome === 'paymentRequired'
            ? t('inbox.card.collectFirst')
            : outcome === 'hasPayments'
              ? t('inbox.outcome.hasPayments')
              : outcome === 'network'
                ? t('inbox.outcome.network')
                : serverMessage(err, t('inbox.outcome.error'))
      toast({ title, ...(outcome === 'error' ? { variant: 'destructive' as const } : {}) })
      return outcome === 'network' ? undefined : refresh()
    },
  })

  const run = (target: OnlineOrderStatus, fn: () => Promise<unknown>) => {
    setDialog(null)
    action.mutate({ target, run: fn })
  }

  const onAction = (order: InboxOrder, a: OrderAction) => {
    if (a === 'ready') return run('READY', () => markReady(venueId, order.orderId))
    if (a === 'delivered') return run('COMPLETED', () => markDelivered(venueId, order.orderId))
    setDialog({ kind: a, order })
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

  if (!data) {
    return isError ? (
      <Alert variant="destructive">
        <AlertDescription>{serverMessage(error, t('inbox.loadFailed'))}</AlertDescription>
      </Alert>
    ) : (
      <div className="space-y-3" data-testid="online-inbox-loading">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    )
  }

  const store = data.store
  const pause = pauseLabel(store, formatTime)
  const soundSupported = chime().state() !== 'unsupported'
  const skewMs = Date.parse(data.serverTime) - dataUpdatedAt

  return (
    <div className="space-y-4" data-testid="online-inbox">
      <div className="space-y-3 rounded-xl border border-input p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {store && (
            <p className="text-sm">
              <span className="text-muted-foreground">{t('settings.status.label')}: </span>
              <span className="font-medium">
                {pause ? t(pause.key, pause.params) : t(`settings.status.${store.status}`, { defaultValue: store.status })}
              </span>
            </p>
          )}
          <PauseControl venueId={venueId} store={store} canPause={canPause} />
        </div>
        <p className="text-sm text-muted-foreground">{keepsStoreOpen ? t('inbox.keepsOpen') : t('inbox.viewOnly')}</p>
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
      {soundSupported && !soundOn && pending > 0 && <p className="rounded-xl bg-muted/50 p-3 text-sm font-medium">{t('inbox.sound.nag')}</p>}

      {SECTIONS.map(section => {
        const list = data.orders.filter(o => section.match(o.status))
        const total = data.counts[section.key]
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
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {list.map(order => (
                  <OrderCard
                    key={order.orderId}
                    order={order}
                    skewMs={skewMs}
                    canAnswer={canAnswer}
                    canCancel={canCancel}
                    busy={action.isPending}
                    onAction={a => onAction(order, a)}
                  />
                ))}
              </div>
            )}
          </section>
        )
      })}

      {dialog?.kind === 'accept' && (
        <AcceptDialog
          order={dialog.order}
          onClose={() => setDialog(null)}
          onAccept={minutes => run('ACCEPTED', () => acceptOrder(venueId, dialog.order.orderId, minutes))}
        />
      )}
      {dialog?.kind === 'reject' && (
        <RejectDialog
          order={dialog.order}
          onClose={() => setDialog(null)}
          onReject={(reason, note) => run('REJECTED', () => rejectOrder(venueId, dialog.order.orderId, reason, note))}
        />
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
    </div>
  )
}
