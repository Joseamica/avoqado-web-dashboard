import { ExchangeLinksCard } from '@/pages/Payment/components/ExchangeLinksCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useBreadcrumb } from '@/context/BreadcrumbContext'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import * as orderService from '@/services/order.service'
import { Currency } from '@/utils/currency'
import { formatOrderNumber, getOrderStatusConfig } from '@/utils/orderStatus'
import { OrderCardRefund } from '@/pages/OnlineOrdering/components/CardRefundSheet'
import { marcaDelPedido } from '@/pages/OnlineOrdering/lib/marcaDelPedido'
import { usePedidoEnLinea } from '@/pages/OnlineOrdering/lib/usePedidoEnLinea'
import { useQuery } from '@tanstack/react-query'
import { MoreHorizontal, Printer, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { OrderActionsSheet } from './components/OrderActionsSheet'
import { ActivitySection } from './components/sections/ActivitySection'
import { DetailsSection } from './components/sections/DetailsSection'
import { ItemsSection } from './components/sections/ItemsSection'
import { StampRewardsSection } from './components/StampRewardsSection'
import { PaymentsSection, type EstadoDevolucion } from './components/sections/PaymentsSection'

interface Props {
  orderId: string
  onClose: () => void
}

export function OrderDrawerContent({ orderId, onClose }: Props) {
  const { t } = useTranslation('orders')
  const { t: tOnline } = useTranslation('onlineOrdering')
  const { venueId, venue, fullBasePath } = useCurrentVenue()
  const venueTimezone = venue?.timezone || 'America/Mexico_City'
  const { setCustomSegment, clearCustomSegment } = useBreadcrumb()
  const [actionsOpen, setActionsOpen] = useState(false)

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', venueId, orderId],
    queryFn: () => orderService.getOrder(venueId, orderId),
    enabled: !!orderId,
  })
  // D661 · Ruling 89: la misma lectura del pedido en línea que hace «Devolver» (una sola petición). Tras una reversa del banco el
  // SERVIDOR conserva el asiento del reembolso, pero a la clienta se le debe: lo dice la marca. Ronda 5: de una cuenta en línea, la
  // etiqueta del reembolso espera a esa lectura («Revisando la devolución…»); si falla, dice que no se pudo revisar.
  // Ruling 102: sólo con una lectura que terminó después de abrir este detalle (`fresca`), nunca con la de la caché.
  const { aplica: esEnLinea, lectura: enLinea, fresca } = usePedidoEnLinea(venueId, orderId, order?.source, !!order)
  const devolucion: EstadoDevolucion | undefined = !esEnLinea
    ? undefined
    : fresca
      ? enLinea.data && marcaDelPedido(enLinea.data) === 'reversed'
        ? 'seLeDebe'
        : undefined
      : enLinea.isError && !enLinea.isFetching
        ? 'sinRevisar'
        : 'revisando'

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
        <p className="text-muted-foreground">{t('detail.notFound', { defaultValue: 'Orden no encontrada' })}</p>
        <Button onClick={onClose}>{t('detail.backToOrders', { defaultValue: 'Volver a pedidos' })}</Button>
      </div>
    )
  }

  const statusCfg = getOrderStatusConfig(order.status)
  const paymentStatusCfg = getOrderStatusConfig(order.paymentStatus)
  const hasCustomerLink = Boolean((order.orderCustomers?.length || 0) > 0 || order.customerId)
  const hasPendingBalance = Number(order.remainingBalance ?? 0) > 0
  // Carril del reembolso (server, 2026-08-18). Ausente = comportamiento de siempre.
  const refundState = order.refundState ?? 'NONE'
  const refundedAmount = Number(order.refundedAmount ?? 0)
  const isRefunded = refundState !== 'NONE'
  const isPayLaterOrder =
    hasCustomerLink &&
    hasPendingBalance &&
    (order.paymentStatus === 'PENDING' || order.paymentStatus === 'PARTIAL') &&
    // 🔴 Una venta devuelta NO se persigue para cobrar: el saldo que quedó abierto
    // es consecuencia del reembolso, no una deuda del cliente. Sin esto la pantalla
    // decía "Por Cobrar" sobre dinero que el negocio ya regresó.
    !isRefunded

  return (
    <div data-print-root className="flex flex-col h-full bg-background">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-border bg-background" data-print-hide>
        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
          <X className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => window.print()} className="rounded-full" title={t('drawer.actions.print')}>
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
          <h1 className="text-2xl font-semibold text-foreground">{t('drawer.title', { number: formatOrderNumber(order.orderNumber) })}</h1>
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant="outline" className={`${statusCfg.bg} ${statusCfg.color} ${statusCfg.border}`}>
              {t(`detail.statuses.${order.status}`, { defaultValue: order.status })}
            </Badge>
            <Badge variant="outline" className={`${paymentStatusCfg.bg} ${paymentStatusCfg.color} ${paymentStatusCfg.border}`}>
              {t(`detail.statuses.${order.paymentStatus}`, { defaultValue: order.paymentStatus })}
            </Badge>
            {isPayLaterOrder && (
              <Badge
                variant="outline"
                className="text-xs px-1.5 py-0.5 bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
              >
                {t('payLater.badge', { defaultValue: 'Por Cobrar' })}
              </Badge>
            )}
            {isRefunded && (
              <Badge
                variant="outline"
                className={
                  devolucion === 'revisando' || devolucion === 'sinRevisar'
                    ? 'text-xs px-1.5 py-0.5 text-muted-foreground'
                    : 'text-xs px-1.5 py-0.5 bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800'
                }
              >
                {devolucion === 'seLeDebe'
                  ? tOnline('inbox.card.mark.reversed')
                  : devolucion
                    ? t(devolucion === 'revisando' ? 'drawer.refund.checking' : 'drawer.refund.unchecked')
                    : refundState === 'FULL'
                      ? t('drawer.refund.full', { defaultValue: 'Reembolsada' })
                      : t('drawer.refund.partial', {
                          amount: Currency(refundedAmount),
                          defaultValue: 'Reembolso parcial: {{amount}}',
                        })}
              </Badge>
            )}
          </div>
        </div>

        <DetailsSection order={order} venueTimezone={venueTimezone} />
        <ItemsSection order={order} />
        {/*
          Va después de lo que se pidió y antes de lo que se pagó: es el momento en
          que el cajero decide qué cobrar. La sección se oculta sola cuando no hay
          nada que canjear.
        */}
        <StampRewardsSection order={order} />
        <PaymentsSection order={order} venueTimezone={venueTimezone} devolucion={devolucion} />
        {/* Pedido en línea cobrado con tarjeta: se devuelve aquí (la bandeja sólo guarda 24 h). Sale solo si aplica. */}
        <OrderCardRefund venueId={venueId} orderId={order.id} source={order.source} />
        <ExchangeLinksCard orderId={order.id} links={order.exchange} />
        <ActivitySection order={order} venueTimezone={venueTimezone} />
      </div>

      <OrderActionsSheet order={order} open={actionsOpen} onOpenChange={setActionsOpen} fullBasePath={fullBasePath} />
    </div>
  )
}
