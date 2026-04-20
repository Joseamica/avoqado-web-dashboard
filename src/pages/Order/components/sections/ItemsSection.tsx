import { Separator } from '@/components/ui/separator'
import type { Order, OrderItem } from '@/types'
import { Currency } from '@/utils/currency'
import { useTranslation } from 'react-i18next'

interface Props {
  order: Order
}

const initials = (name: string) =>
  name
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

const ItemRow = ({ item }: { item: OrderItem }) => {
  const { t } = useTranslation('orders')
  const name = item.productName || (item as any).product?.name || t('drawer.items.customAmount')
  const sku = (item as any).productSku || (item as any).product?.sku
  const image = (item as any).product?.image
  const isCustom = !(item as any).productId
  const total = Number(item.total ?? 0)
  const unitPrice = Number(item.unitPrice ?? 0)
  const qty = Number((item as any).quantity ?? 1)

  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-b-0">
      {image ? (
        <img src={image} alt="" className="w-10 h-10 rounded-md object-cover bg-muted" />
      ) : (
        <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
          {isCustom ? 'Cu' : initials(name)}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between gap-2">
          <p className="text-sm font-medium text-foreground line-clamp-2">
            <span className="font-semibold">{name}</span> × {qty}
          </p>
          <p className="text-sm font-medium text-foreground whitespace-nowrap">{Currency(total)}</p>
        </div>
        {(sku || qty > 1) && (
          <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
            <span>{sku ? `SKU: ${sku}` : ''}</span>
            {qty > 1 && <span>{Currency(unitPrice)} {t('drawer.items.perUnit')}</span>}
          </div>
        )}
        {(item as any).modifiers && (item as any).modifiers.length > 0 && (
          <ul className="mt-1.5 space-y-0.5">
            {(item as any).modifiers.map((m: any, idx: number) => (
              <li key={idx} className="text-xs text-muted-foreground">
                • {m.name ?? m.modifier?.name} {Number(m.price ?? 0) > 0 && `(+${Currency(Number(m.price))})`}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export function ItemsSection({ order }: Props) {
  const { t } = useTranslation('orders')
  const items = order.items ?? []
  const subtotal = Number(order.subtotal ?? 0)
  const discount = Number((order as any).discountAmount ?? 0)
  const tax = Number(order.taxAmount ?? 0)
  const tip = Number(order.tipAmount ?? 0)
  const total = Number(order.total ?? 0)

  return (
    <section>
      <h2 className="text-lg font-semibold text-foreground mb-3">{t('drawer.sections.items')}</h2>
      <div className="rounded-lg border border-border bg-background px-4">
        {items.length > 0 ? (
          items.map(item => <ItemRow key={item.id} item={item} />)
        ) : (
          <p className="py-4 text-sm text-muted-foreground">{t('drawer.items.noItems', { defaultValue: 'Sin artículos' })}</p>
        )}
        <Separator className="my-2" />
        <div className="py-2 space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('drawer.totals.subtotal')}</span>
            <span className="text-foreground">{Currency(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('drawer.totals.discount')}</span>
              <span className="text-foreground">-{Currency(discount)}</span>
            </div>
          )}
          {tax > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('drawer.totals.tax')}</span>
              <span className="text-foreground">{Currency(tax)}</span>
            </div>
          )}
          {tip > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('drawer.totals.tip')}</span>
              <span className="text-foreground">{Currency(tip)}</span>
            </div>
          )}
          <div className="flex justify-between pt-2 border-t border-border">
            <span className="font-semibold text-foreground">{t('drawer.totals.total')}</span>
            <span className="font-bold text-base text-foreground">{Currency(total)}</span>
          </div>
        </div>
      </div>
    </section>
  )
}
