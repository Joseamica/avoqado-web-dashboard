import { Badge } from '@/components/ui/badge'
import type { Order } from '@/types'
import { getOrderTypeConfig } from '@/utils/orderStatus'
import { DateTime } from 'luxon'
import { useTranslation } from 'react-i18next'

interface Props {
  order: Order
  venueTimezone: string
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex justify-between gap-4 py-2 border-b border-border last:border-b-0">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-sm font-medium text-foreground text-right">{children}</span>
  </div>
)

export function DetailsSection({ order, venueTimezone }: Props) {
  const { t } = useTranslation('orders')

  const email = order.customerEmail || (order as any).customer?.email
  const phone = order.customerPhone || (order as any).customer?.phone
  const customerName = (order as any).customer
    ? `${(order as any).customer.firstName ?? ''} ${(order as any).customer.lastName ?? ''}`.trim()
    : null
  const server = order.servedBy ?? order.createdBy
  const serverName = server ? `${server.firstName ?? ''} ${server.lastName ?? ''}`.trim() : null
  const createdAt = DateTime.fromISO(order.createdAt, { zone: 'utc' })
    .setZone(venueTimezone)
    .toFormat("d 'de' LLL yyyy, HH:mm", { locale: 'es' })
  const typeCfg = getOrderTypeConfig(order.type)

  return (
    <section>
      <h2 className="text-lg font-semibold text-foreground mb-3">{t('drawer.sections.details')}</h2>
      <div className="rounded-lg border border-border bg-background px-4">
        {email && <Row label={t('drawer.details.email')}>{email}</Row>}
        {phone && <Row label={t('drawer.details.phone')}>{phone}</Row>}
        {customerName && <Row label={t('drawer.details.customer')}>{customerName}</Row>}
        <Row label={t('drawer.details.createdAt')}>{createdAt}</Row>
        <Row label={t('drawer.details.source')}>
          {t(`drawer.sources.${order.source}`, { defaultValue: order.source })}
        </Row>
        {order.terminal?.name && <Row label={t('drawer.details.terminal')}>{order.terminal.name}</Row>}
        {order.table?.number && <Row label={t('drawer.details.table')}>{order.table.number}</Row>}
        {serverName && <Row label={t('drawer.details.server')}>{serverName}</Row>}
        <Row label={t('drawer.details.type')}>
          <Badge variant="outline" className={`${typeCfg.bg} ${typeCfg.color} border-transparent`}>
            {typeCfg.label}
          </Badge>
        </Row>
      </div>
    </section>
  )
}
