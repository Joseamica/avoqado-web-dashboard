import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import type { Order } from '@/types'
import { Currency } from '@/utils/currency'
import { buildOrderActivity, type ActivityEvent } from '@/utils/orderActivity'
import { AlertCircle, CheckCircle2, ChevronDown, CreditCard, FileText, Plus, RotateCcw } from 'lucide-react'
import { DateTime } from 'luxon'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  order: Order
  venueTimezone: string
}

const iconFor = (e: ActivityEvent) => {
  switch (e.type) {
    case 'created': return FileText
    case 'items_added': return Plus
    case 'action': return AlertCircle
    case 'payment': return CreditCard
    case 'refund': return RotateCcw
    case 'completed': return CheckCircle2
  }
}

const Node = ({ event, isLast, venueTimezone }: { event: ActivityEvent; isLast: boolean; venueTimezone: string }) => {
  const { t } = useTranslation('orders')
  const [open, setOpen] = useState(false)
  const Icon = iconFor(event)
  const time = DateTime.fromISO(event.timestamp, { zone: 'utc' }).setZone(venueTimezone).toFormat("d LLL, HH:mm", { locale: 'es' })

  let title = ''
  let detail: React.ReactNode = null
  switch (event.type) {
    case 'created':
      title = t('drawer.activity.created')
      if (event.staffName) detail = event.staffName
      break
    case 'items_added':
      title = t('drawer.activity.itemsAdded', { count: event.count })
      detail = (
        <ul className="mt-1 space-y-0.5">
          {event.items.map((it, i) => (
            <li key={i}>• {it.name} × {it.quantity}</li>
          ))}
        </ul>
      )
      break
    case 'action':
      title = `${event.actionType}${event.reason ? `: ${event.reason}` : ''}`
      if (event.staffName) detail = event.staffName
      break
    case 'payment':
      title = t('drawer.activity.paymentProcessed', {
        amount: Currency(event.amount),
        method: event.cardBrand ?? event.method,
      })
      break
    case 'refund':
      title = t('drawer.activity.refundIssued', { amount: Currency(Math.abs(event.amount)) })
      if (event.refundReason) {
        detail = t(`drawer.refundReasons.${event.refundReason}`, { defaultValue: event.refundReason })
      }
      break
    case 'completed':
      title = t('drawer.activity.completed')
      break
  }

  const expandable = detail !== null
  const dotColor =
    event.type === 'refund'
      ? 'border-red-500 text-red-500'
      : event.type === 'completed'
        ? 'border-green-500 text-green-600'
        : 'border-border text-muted-foreground'

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`w-7 h-7 rounded-full border-2 ${dotColor} bg-background flex items-center justify-center shrink-0`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        {!isLast && <div className="w-0.5 flex-1 bg-muted-foreground/50 dark:bg-muted-foreground/40 mt-1 min-h-[24px]" />}
      </div>
      <div className="flex-1 pb-4">
        <p className="text-sm text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{time}</p>
        {expandable && (
          <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-auto p-0 mt-1 text-xs underline" data-print-hide>
                {open ? t('drawer.activity.hideDetails') : t('drawer.activity.showDetails')}
                <ChevronDown className={`ml-1 w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="text-xs text-muted-foreground mt-1">{detail}</CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  )
}

export function ActivitySection({ order, venueTimezone }: Props) {
  const { t } = useTranslation('orders')
  const events = buildOrderActivity(order)

  return (
    <section>
      <h2 className="text-lg font-semibold text-foreground mb-3">{t('drawer.sections.activity')}</h2>
      <div className="rounded-lg border border-border bg-background p-4">
        {events.map((e, i) => (
          <Node key={i} event={e} isLast={i === events.length - 1} venueTimezone={venueTimezone} />
        ))}
      </div>
    </section>
  )
}
