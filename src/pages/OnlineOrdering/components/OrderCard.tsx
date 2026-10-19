import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { InboxOrder } from '@/types/onlineOrdering'
import { Currency } from '@/utils/currency'
import { useVenueDateTime } from '@/utils/datetime'

/** Cerrados SIN cobro: nunca hubo (ni habrá) dinero que cobrar al recoger. */
const NO_CHARGE: ReadonlySet<string> = new Set(['REJECTED', 'EXPIRED', 'CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_STAFF'])

export type OrderAction = 'accept' | 'reject' | 'ready' | 'delivered' | 'cancel'

/** Cuenta regresiva al vencimiento con el reloj del SERVIDOR (`skewMs` = hora del servidor − reloj local). */
function Countdown({ deadline, skewMs }: { deadline: string; skewMs: number }) {
  const { t } = useTranslation('onlineOrdering')
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const left = Date.parse(deadline) - (now + skewMs)
  if (!(left > 0)) return <span className="font-medium text-destructive">{t('inbox.card.expired')}</span>
  const minutes = Math.floor(left / 60_000)
  const seconds = String(Math.floor((left % 60_000) / 1000)).padStart(2, '0')
  return <span className="font-medium tabular-nums">{t('inbox.card.deadline', { time: `${minutes}:${seconds}` })}</span>
}

interface Props {
  order: InboxOrder
  skewMs: number
  canAnswer: boolean
  canCancel: boolean
  busy: boolean
  onAction: (action: OrderAction) => void
}

export function OrderCard({ order, skewMs, canAnswer, canCancel, busy, onAction }: Props) {
  const { t } = useTranslation('onlineOrdering')
  const { formatTime } = useVenueDateTime()
  const noCharge = NO_CHARGE.has(order.status)
  const owes = !noCharge && order.remaining > 0
  const isPending = order.status === 'PENDING_ACCEPTANCE'
  const isActive = order.status === 'ACCEPTED' || order.status === 'READY'
  const isDone = !isPending && !isActive

  return (
    <div data-testid={`order-${order.orderId}`} className="space-y-3 rounded-xl border border-input bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">#{order.orderNumber}</span>
            <Badge variant="outline" className="whitespace-nowrap">
              {t('inbox.card.pickup')}
            </Badge>
          </div>
          {order.customerName && <p className="truncate text-sm font-medium">{order.customerName}</p>}
          {order.customerPhone && <p className="text-sm text-muted-foreground">{order.customerPhone}</p>}
        </div>
        <div className="shrink-0 text-right text-sm text-muted-foreground">
          <p>{formatTime(order.createdAt)}</p>
        </div>
      </div>
      {isPending && order.acceptDeadlineAt && (
        <p className="text-sm">
          <Countdown deadline={order.acceptDeadlineAt} skewMs={skewMs} />
        </p>
      )}

      <ul className="space-y-1 text-sm">
        {order.items.map((item, i) => (
          <li key={i}>
            <span className="font-medium">
              {item.quantity}× {item.name}
            </span>
            {item.modifiers.length > 0 && (
              <ul className="pl-4 text-muted-foreground">
                {item.modifiers.map((m, j) => (
                  <li key={j}>
                    + {m.quantity > 1 ? `${m.quantity}× ` : ''}
                    {m.name}
                  </li>
                ))}
              </ul>
            )}
            {item.note && <p className="break-words pl-4 italic text-muted-foreground">{item.note}</p>}
          </li>
        ))}
      </ul>

      {order.note && <p className="break-words rounded-lg bg-muted/50 p-2 text-sm">{order.note}</p>}

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{t('inbox.card.total')}</span>
        <span className="font-semibold">{Currency(order.total)}</span>
      </div>
      <p className={owes ? 'text-sm font-medium' : 'text-sm text-muted-foreground'}>
        {noCharge
          ? t('inbox.card.noCharge')
          : owes
            ? t('inbox.card.payAtPickup', { amount: Currency(order.remaining) })
            : t('inbox.card.paid')}
      </p>

      {isDone && <Badge variant="secondary">{t(`inbox.card.status.${order.status}`, { defaultValue: order.status })}</Badge>}

      {isPending && canAnswer && (
        <div className="flex gap-2">
          <Button className="flex-1" disabled={busy} onClick={() => onAction('accept')} data-tour="online-inbox-accept">
            {t('inbox.actions.accept')}
          </Button>
          <Button variant="outline" className="flex-1" disabled={busy} onClick={() => onAction('reject')}>
            {t('inbox.actions.reject')}
          </Button>
        </div>
      )}

      {isActive && (canAnswer || canCancel) && (
        <div className="flex flex-wrap items-center gap-2">
          {canAnswer && order.status === 'ACCEPTED' && (
            <Button className="flex-1" disabled={busy} onClick={() => onAction('ready')}>
              {t('inbox.actions.ready')}
            </Button>
          )}
          {canAnswer && order.status === 'READY' && (
            <Button className="flex-1" disabled={busy || owes} onClick={() => onAction('delivered')}>
              {t('inbox.actions.delivered')}
            </Button>
          )}
          {canCancel && (
            <Button variant="ghost" disabled={busy} onClick={() => onAction('cancel')}>
              {t('inbox.actions.cancel')}
            </Button>
          )}
          {canAnswer && order.status === 'READY' && owes && (
            <p className="w-full text-xs text-muted-foreground">{t('inbox.card.collectFirst')}</p>
          )}
        </div>
      )}
    </div>
  )
}
