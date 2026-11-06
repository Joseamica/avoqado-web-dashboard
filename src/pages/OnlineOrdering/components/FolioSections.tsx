import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { getSettings, getToPay, onlineOrderingKeys } from '@/services/onlineOrdering.service'
import type { FolioOrder } from '@/types/onlineOrdering'
import { Currency } from '@/utils/currency'
import { useVenueDateTime } from '@/utils/datetime'

import { useExtraPages } from '../hooks/useExtraPages'
import { toPayModeIsLive } from '../lib/toPayLive'

export type FolioAction = 'ready' | 'delivered' | 'cancelFolio'
type Section = 'toPay' | 'toDeliver'

interface Props {
  venueId: string
  canAnswer: boolean
  canCancel: boolean
  busy: boolean
  /** Folios ya tocados con éxito: salen de la lista al instante (también los de «Cargar más» hasta que el sondeo los relea). */
  hidden: ReadonlySet<string>
  /** Ids de folios de «Nadie» ACTIVOS que la Bandeja ve: sólo dan un empujón único a to-pay, no cambian su modo. */
  inboxNadieIds?: string[]
  onAct: (order: FolioOrder, action: FolioAction) => void
}

/** «Por pagar» y «Por entregar» de «Nadie». Salen del `to-pay` del panel (sin latido: el panel no cobra) y no se repiten en «En preparación». */
export function FolioSections({ venueId, canAnswer, canCancel, busy, hidden, inboxNadieIds = [], onAct }: Props) {
  const { t } = useTranslation('onlineOrdering')
  const { toast } = useToast()
  // «Nadie» según los ajustes (misma llave que Configuración). Sin esa señal ni un to-pay con folios, no se enseña nada nuevo.
  const settings = useQuery({
    queryKey: onlineOrderingKeys.settings(venueId),
    queryFn: () => getSettings(venueId),
    enabled: !!venueId,
    retry: false,
  })
  const nadie = settings.data?.requiresAcceptance === false
  const { data, isError, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: onlineOrderingKeys.toPay(venueId),
    queryFn: () => getToPay(venueId),
    enabled: !!venueId,
    // El modo sale sólo de la última respuesta buena (ver toPayLive): VIVO 10 s o LENTO 120 s; en error o arranque en frío, LENTO.
    // ponytail: tras pasar a «Nadie» desde otra computadora, el primer folio sin pagar puede tardar hasta 120 s en verse en el panel
    // (la caja cobra en la TPV o el POS, no aquí); la Bandeja lo adelanta con un empujón si trae ese folio.
    refetchInterval: q => (toPayModeIsLive(q.state.data) ? 10_000 : 120_000),
    refetchIntervalInBackground: false,
    retry: 1,
  })
  // Empujón ÚNICO de la Bandeja: un folio de «Nadie» activo que to-pay aún no tiene ⇒ se relee una vez (no deja bandera pegada).
  const known = new Set([...(data?.toPay ?? []), ...(data?.toDeliver ?? [])].map(o => o.orderId))
  const nudged = useRef(new Set<string>())
  const fresh = (data ? inboxNadieIds : []).filter(id => !known.has(id) && !nudged.current.has(id))
  const freshKey = fresh.join('|')
  useEffect(() => {
    if (!freshKey) return
    freshKey.split('|').forEach(id => nudged.current.add(id))
    void refetch()
  }, [freshKey, refetch])
  // Lo traído con «Cargar más» se RELEE en cada sondeo (ver useExtraPages): nunca queda un folio viejo congelado.
  const onMoreError = useCallback(() => toast({ title: t('folio.loadMoreFailed'), variant: 'destructive' }), [toast, t])
  const fetchSection = (section: Section) => async (cursor: string) => {
    const page = await getToPay(venueId, { section, cursor })
    return { items: page[section], next: page.nextCursors[section] }
  }
  const more = {
    toPay: useExtraPages(data?.nextCursors.toPay ?? null, dataUpdatedAt, fetchSection('toPay'), onMoreError, o => o.orderId),
    toDeliver: useExtraPages(data?.nextCursors.toDeliver ?? null, dataUpdatedAt, fetchSection('toDeliver'), onMoreError, o => o.orderId),
  }
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(id)
  }, [])

  if (!data) {
    if (!nadie) return null
    return isError ? (
      <Alert variant="destructive" data-testid="folio-error">
        <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
          {t('folio.loadFailed')}
          <Button size="sm" variant="outline" disabled={isFetching} onClick={() => void refetch()}>
            {t('folio.retry')}
          </Button>
        </AlertDescription>
      </Alert>
    ) : (
      <div className="space-y-3" data-testid="folio-loading">
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    )
  }
  if (!toPayModeIsLive(data)) return null

  const nowServer = Date.parse(data.serverTime) + (Math.max(now, dataUpdatedAt) - dataUpdatedAt)
  const build = (sec: Section) => {
    const seen = new Set(data[sec].map(o => o.orderId))
    return [...data[sec], ...more[sec].items.filter(o => !seen.has(o.orderId))].filter(o => !hidden.has(o.orderId))
  }
  const toDeliverList = build('toDeliver')
  // Un folio nunca sale en las dos secciones: si ya está por entregar, ya no está por pagar.
  const inDeliver = new Set(toDeliverList.map(o => o.orderId))
  const lists: Record<Section, FolioOrder[]> = { toPay: build('toPay').filter(o => !inDeliver.has(o.orderId)), toDeliver: toDeliverList }

  return (
    <div className="space-y-4" data-testid="folio-sections">
      {!data.requiresAcceptance && <p className="text-sm text-muted-foreground">{t('folio.note')}</p>}
      {(['toPay', 'toDeliver'] as const).map(section => {
        const list = lists[section]
        // Un folio quitado de «Por pagar» por estar ya en «Por entregar» no debe contradecir el número ni el «Mostrando».
        const removed = section === 'toPay' ? build('toPay').length - list.length : 0
        const total = data.counts[section] - removed
        const { next, loading, loadMore } = more[section]
        return (
          <section key={section} className="space-y-2" data-tour={`online-inbox-${section}`}>
            <h2 className="text-base font-semibold">
              {t(`folio.sections.${section}`)} <span className="text-muted-foreground">({total})</span>
            </h2>
            {list.length < total && (
              <p className="text-xs text-muted-foreground">{t('inbox.sections.showing', { shown: list.length, total })}</p>
            )}
            {list.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t(section === 'toPay' ? 'folio.emptyToPay' : 'folio.emptyToDeliver')}</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {list.map(order => (
                  <FolioCard
                    key={order.orderId}
                    order={order}
                    section={section}
                    nowServer={nowServer}
                    stale={isError}
                    canAnswer={canAnswer}
                    canCancel={canCancel}
                    busy={busy}
                    onAct={a => onAct(order, a)}
                  />
                ))}
              </div>
            )}
            {next && (
              <Button variant="outline" className="w-full" disabled={loading} onClick={() => void loadMore()}>
                {t('folio.loadMore')}
              </Button>
            )}
          </section>
        )
      })}
    </div>
  )
}

interface CardProps {
  order: FolioOrder
  section: Section
  nowServer: number
  /** La última lectura falló: el reloj ya no es de fiar, se dice la hora fija. */
  stale: boolean
  canAnswer: boolean
  canCancel: boolean
  busy: boolean
  onAct: (action: FolioAction) => void
}

function FolioCard({ order, section, nowServer, stale, canAnswer, canCancel, busy, onAct }: CardProps) {
  const { t } = useTranslation('onlineOrdering')
  const { formatTime } = useVenueDateTime()
  const partial = section === 'toPay' && order.remaining > 0 && order.remaining < order.total
  const units = order.items.reduce((n, i) => n + i.quantity, 0)
  const left = order.acceptDeadlineAt ? Date.parse(order.acceptDeadlineAt) - nowServer : null
  const minutes = left === null ? null : Math.ceil(left / 60_000)

  return (
    <div data-testid={`folio-${order.orderId}`} className="space-y-3 rounded-xl border border-input bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <p className="break-all text-2xl font-bold tracking-[0.25em]">{order.orderNumber}</p>
          {order.customerName && <p className="truncate text-sm font-medium">{order.customerName}</p>}
        </div>
        <div className="text-right">
          <p className="text-xl font-semibold">{Currency(section === 'toPay' ? order.remaining : order.total)}</p>
          {section === 'toDeliver' && <p className="text-xs font-medium text-muted-foreground">{t('folio.paidTag')}</p>}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        {section === 'toDeliver' && order.paidAt
          ? t('folio.paidAt', { time: formatTime(order.paidAt) })
          : t('folio.orderedAt', { time: formatTime(order.createdAt) })}{' '}
        · {t('folio.products', { count: units })}
      </p>
      <ul className="space-y-0.5 text-sm">
        {order.items.map((item, i) => (
          <li key={i} className="break-words">
            {item.quantity}× {item.name}
          </li>
        ))}
      </ul>
      {order.note && <p className="break-words rounded-lg bg-muted/50 p-2 text-sm">{order.note}</p>}

      {section === 'toPay' && (
        <div className="space-y-1 text-sm">
          {partial && (
            <>
              <p className="font-medium">{t('folio.missing', { remaining: Currency(order.remaining), total: Currency(order.total) })}</p>
              <p className="text-muted-foreground">{t('folio.alreadyPaid', { paid: Currency(order.total - order.remaining) })}</p>
            </>
          )}
          {minutes !== null &&
            !partial &&
            (stale ? (
              <p className="text-muted-foreground">{t('folio.expiresAt', { time: formatTime(order.acceptDeadlineAt!) })}</p>
            ) : minutes <= 0 ? (
              <p className="font-medium text-amber-700 dark:text-amber-400">{t('folio.expiring')}</p>
            ) : (
              <p className={minutes <= 5 ? 'font-medium text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}>
                {t('folio.expiresIn', { minutes })}
              </p>
            ))}
          {partial && <p className="font-medium">{t('folio.collectAtRegister')}</p>}
          {!partial && canCancel && (
            <div className="pt-4">
              <Button variant="outline" disabled={busy} onClick={() => onAct('cancelFolio')}>
                {t('folio.cancel')}
              </Button>
            </div>
          )}
        </div>
      )}

      {section === 'toDeliver' && canAnswer && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="flex-1" disabled={busy} onClick={() => onAct('ready')}>
            {t('inbox.actions.ready')}
          </Button>
          <Button className="flex-1" disabled={busy} onClick={() => onAct('delivered')}>
            {t('inbox.actions.delivered')}
          </Button>
        </div>
      )}
    </div>
  )
}
