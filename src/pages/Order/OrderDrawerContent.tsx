import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useBreadcrumb } from '@/context/BreadcrumbContext'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import * as orderService from '@/services/order.service'
import { formatOrderNumber, getOrderStatusConfig } from '@/utils/orderStatus'
import { useQuery } from '@tanstack/react-query'
import { MoreHorizontal, Printer, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { OrderActionsSheet } from './components/OrderActionsSheet'
import { ActivitySection } from './components/sections/ActivitySection'
import { DetailsSection } from './components/sections/DetailsSection'
import { ItemsSection } from './components/sections/ItemsSection'
import { PaymentsSection } from './components/sections/PaymentsSection'

interface Props {
  orderId: string
  onClose: () => void
}

export function OrderDrawerContent({ orderId, onClose }: Props) {
  const { t } = useTranslation('orders')
  const { venueId, venue, fullBasePath } = useCurrentVenue()
  const venueTimezone = venue?.timezone || 'America/Mexico_City'
  const { setCustomSegment, clearCustomSegment } = useBreadcrumb()
  const [actionsOpen, setActionsOpen] = useState(false)

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', venueId, orderId],
    queryFn: () => orderService.getOrder(venueId, orderId),
    enabled: !!orderId,
  })

  // Keep breadcrumb readable: replace cuid in URL with formatted "#XXXXXX"
  useEffect(() => {
    if (order?.orderNumber && orderId) {
      setCustomSegment(orderId, `#${formatOrderNumber(order.orderNumber)}`)
    }
    return () => {
      if (orderId) clearCustomSegment(orderId)
    }
  }, [order?.orderNumber, orderId, setCustomSegment, clearCustomSegment])

  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        <div className="h-6 w-32 bg-muted rounded animate-pulse" />
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="h-32 bg-muted rounded animate-pulse mt-6" />
        <div className="h-32 bg-muted rounded animate-pulse" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-muted-foreground">
          {t('detail.notFound', { defaultValue: 'Orden no encontrada' })}
        </p>
        <Button onClick={onClose}>
          {t('detail.backToOrders', { defaultValue: 'Volver a pedidos' })}
        </Button>
      </div>
    )
  }

  const statusCfg = getOrderStatusConfig(order.status)
  const paymentStatusCfg = getOrderStatusConfig(order.paymentStatus)

  return (
    <div data-print-root className="flex flex-col h-full bg-background">
      {/* Sticky header */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-border bg-background"
        data-print-hide
      >
        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
          <X className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.print()}
            className="rounded-full"
            title={t('drawer.actions.print')}
          >
            <Printer className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setActionsOpen(true)}
            className="rounded-full"
            title={t('drawer.actions.more')}
          >
            <MoreHorizontal className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {/* Title */}
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {t('drawer.title', { number: formatOrderNumber(order.orderNumber) })}
          </h1>
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant="outline" className={`${statusCfg.bg} ${statusCfg.color} ${statusCfg.border}`}>
              {t(`detail.statuses.${order.status}`, { defaultValue: order.status })}
            </Badge>
            <Badge
              variant="outline"
              className={`${paymentStatusCfg.bg} ${paymentStatusCfg.color} ${paymentStatusCfg.border}`}
            >
              {t(`detail.statuses.${order.paymentStatus}`, { defaultValue: order.paymentStatus })}
            </Badge>
          </div>
        </div>

        <DetailsSection order={order} venueTimezone={venueTimezone} />
        <ItemsSection order={order} />
        <PaymentsSection order={order} venueTimezone={venueTimezone} />
        <ActivitySection order={order} venueTimezone={venueTimezone} />
      </div>

      <OrderActionsSheet
        order={order}
        open={actionsOpen}
        onOpenChange={setActionsOpen}
        fullBasePath={fullBasePath}
      />
    </div>
  )
}
