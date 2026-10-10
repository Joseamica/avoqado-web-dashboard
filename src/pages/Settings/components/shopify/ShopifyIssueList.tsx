import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useDebounce } from '@/hooks/useDebounce'
import { useShopifyIssues } from '@/hooks/use-shopify'
import { SHOPIFY_ISSUE_REASONS, type ShopifyIssueReason } from '@/types/shopify'
import { ListaPaginada } from './ShopifyListStates'
import { dedupe } from './shopify.helpers'

export function ShopifyIssueList({ venueId }: { venueId: string }) {
  const { t } = useTranslation('shopify')
  const { fullBasePath } = useCurrentVenue()
  const [busqueda, setBusqueda] = useState('')
  const [motivo, setMotivo] = useState<ShopifyIssueReason | null>(null)
  const q = useDebounce(busqueda.trim(), 300)
  const lista = useShopifyIssues(venueId, q, motivo, true)
  const items = useMemo(() => dedupe(lista.data?.pages.flatMap(p => p.items) ?? [], i => i.id), [lista.data?.pages])

  return (
    <section className="space-y-3" data-tour="shopify-issues">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{t('issues.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('issues.intro')}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder={t('issues.search')}
          aria-label={t('issues.search')}
          className="w-full sm:w-64"
          data-tour="shopify-issues-search"
        />
        {/* ponytail: select nativo (accesible y probado en jsdom); el filtro estilo Stripe cuando la lista lo pida. */}
        <select
          aria-label={t('issues.reasonLabel')}
          value={motivo ?? ''}
          onChange={e => setMotivo((e.target.value || null) as ShopifyIssueReason | null)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          data-tour="shopify-issues-reason"
        >
          <option value="">{t('issues.allReasons')}</option>
          {SHOPIFY_ISSUE_REASONS.map(r => (
            <option key={r} value={r}>
              {t(`issues.reasonNames.${r}`)}
            </option>
          ))}
        </select>
      </div>
      <ListaPaginada
        q={lista}
        cuantos={items.length}
        total={lista.data?.pages[0]?.total ?? 0}
        vacio={q || motivo ? t('issues.noMatches') : t('issues.empty')}
        textoError={t('issues.loadError')}
      >
        {items.map(i => (
          <div key={i.id} className="rounded-lg border border-input p-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="font-medium text-foreground">{i.title}</span>
              <span className="text-muted-foreground">{i.sku ?? '—'}</span>
            </div>
            {/* Z8: `detail` siempre llega null en ERROR_IMPORTACION (el servidor no saca el texto crudo): el texto es del motivo. */}
            <p className="text-muted-foreground">{t(`issues.reasons.${i.reason}`)}</p>
            {/* L8 (X2): una fila con producto lleva a su ficha; SIN_INVENTARIO a su pestaña de inventario («Volver a cantidad»). */}
            {i.productId && (
              <Link
                to={`${fullBasePath}/menumaker/products/${i.productId}${i.reason === 'SIN_INVENTARIO' ? '#inventory' : ''}`}
                className="mt-1 inline-block text-xs font-medium text-primary underline-offset-4 hover:underline"
                data-tour="shopify-issue-product-link"
              >
                {i.reason === 'SIN_INVENTARIO' ? t('issues.backToQuantity') : t('issues.viewProduct')}
              </Link>
            )}
          </div>
        ))}
      </ListaPaginada>
    </section>
  )
}
