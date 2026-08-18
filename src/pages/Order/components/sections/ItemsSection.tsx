import { Separator } from '@/components/ui/separator'
import type { Order, OrderItem, OrderPromotionSummary } from '@/types'
import { Currency } from '@/utils/currency'
import { Tags } from 'lucide-react'
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

/**
 * El bloque de un combo: nombre arriba, componentes anidados debajo.
 *
 * Es el patrón que usa TODO el mercado y que aquí faltaba — el detalle mostraba
 * los tres productos sueltos y un descuento anónimo, sin decir nunca que venían
 * de "Combo Café + 2 Medialunas". Fudo imprime "el nombre del combo y, debajo,
 * cada producto asociado"; Square marca el refresco como "part of the Burger
 * Combo"; Maitre'D lo lleva a reportes, pantalla, cuenta y recibo.
 *
 * El nombre viene del snapshot del server: es el que se COBRÓ, no el actual.
 */
const PromotionBlock = ({ promotion, items }: { promotion: OrderPromotionSummary; items: OrderItem[] }) => {
  const { t } = useTranslation('orders')

  return (
    <div className="border-b border-border last:border-b-0">
      <div className="flex items-center justify-between gap-2 pt-3">
        <div className="flex min-w-0 items-center gap-2">
          <Tags className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="truncate text-sm font-semibold text-foreground">{promotion.name}</span>
        </div>
        {promotion.discount > 0 && (
          <span className="whitespace-nowrap text-sm font-medium text-emerald-600 dark:text-emerald-400">
            -{Currency(promotion.discount)}
          </span>
        )}
      </div>
      {promotion.needsReview && (
        <p className="pl-6 pt-1 text-xs text-amber-600 dark:text-amber-400">
          {t('drawer.items.promotionNeedsReview', {
            defaultValue: 'Esta promoción se registró fuera de vigencia: los productos entraron a precio de lista.',
          })}
        </p>
      )}
      <div className="pl-6">
        {items.map(item => (
          <ItemRow key={item.id} item={item} />
        ))}
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
  // 100% off (discount covers full subtotal) = cortesía; anything less = descuento parcial.
  const isFullyComped = discount > 0 && subtotal > 0 && discount >= subtotal

  // Agrupación por promoción. Aditiva: si el server no manda `promotions` (o la
  // orden no trae combos), `promotionBlocks` queda vacío y la lista se pinta
  // plana, exactamente como antes.
  const promotions = order.promotions ?? []
  const itemsById = new Map(items.map(i => [i.id, i]))
  const claimedItemIds = new Set<string>()
  const promotionBlocks = promotions
    .map(promotion => {
      const promotionItems = promotion.itemIds.map(id => itemsById.get(id)).filter((i): i is OrderItem => Boolean(i))
      promotionItems.forEach(i => claimedItemIds.add(i.id))
      return { promotion, items: promotionItems }
    })
    .filter(block => block.items.length > 0)
  const looseItems = items.filter(i => !claimedItemIds.has(i.id))

  return (
    <section>
      <h2 className="text-lg font-semibold text-foreground mb-3">{t('drawer.sections.items')}</h2>
      <div className="rounded-lg border border-border bg-background px-4">
        {items.length > 0 ? (
          <>
            {promotionBlocks.map(block => (
              <PromotionBlock key={block.promotion.id} promotion={block.promotion} items={block.items} />
            ))}
            {looseItems.map(item => (
              <ItemRow key={item.id} item={item} />
            ))}
          </>
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
              <span className="text-muted-foreground">
                {isFullyComped
                  ? t('drawer.totals.courtesy', { defaultValue: 'Cortesía' })
                  : t('drawer.totals.discount')}
              </span>
              <span className={isFullyComped ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-foreground'}>
                -{Currency(discount)}
              </span>
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
