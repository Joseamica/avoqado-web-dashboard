import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { SearchCombobox } from '@/components/search-combobox'
import type { SearchComboboxItem } from '@/components/search-combobox'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { getProducts } from '@/services/menu.service'
import { Pencil } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Product } from '@/types'

interface ItemFormSectionProps {
  selectedProduct: Product | null
  onProductSelect: (product: Product) => void
  customFields: boolean
  onCustomFieldsChange: (val: boolean) => void
  tips: boolean
  onTipsChange: (val: boolean) => void
  redirectUrl: string
  onRedirectUrlChange: (val: string) => void
  redirectEnabled: boolean
  onRedirectEnabledChange: (val: boolean) => void
}

export function ItemFormSection({
  selectedProduct,
  onProductSelect,
  customFields,
  onCustomFieldsChange,
  tips,
  onTipsChange,
  redirectUrl,
  onRedirectUrlChange,
  redirectEnabled,
  onRedirectEnabledChange,
}: ItemFormSectionProps) {
  const { t } = useTranslation('paymentLinks')
  const { venueId } = useCurrentVenue()
  const [productSearch, setProductSearch] = useState('')

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['products', venueId],
    queryFn: () => getProducts(venueId, { orderBy: 'name' }),
    enabled: !!venueId,
  })

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(price)

  const productItems: SearchComboboxItem[] = useMemo(() => {
    const q = productSearch.toLowerCase()
    return products
      .filter(p => !q || p.name.toLowerCase().includes(q))
      .map(p => ({
        id: p.id,
        label: p.name,
        endLabel: formatPrice(p.price),
      }))
  }, [products, productSearch])

  return (
    <div className="space-y-8">
      {/* ── Product selector ──────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('itemForm.article')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('itemForm.articleHint')}
        </p>

        <SearchCombobox
          placeholder={t('itemForm.selectProduct')}
          items={productItems}
          isLoading={productsLoading}
          value={productSearch}
          onChange={setProductSearch}
          onSelect={(item) => {
            const product = products.find(p => p.id === item.id)
            if (product) {
              onProductSelect(product)
              setProductSearch(product.name)
            }
          }}
        />

        {/* Selected product display */}
        {selectedProduct && (
          <div className="flex items-center justify-between py-3 border-t border-input">
            <div>
              <span className="font-medium">{selectedProduct.name}</span>
              {selectedProduct.description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{selectedProduct.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{formatPrice(selectedProduct.price)}</span>
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </div>
        )}
      </section>

      <hr className="border-border" />

      {/* ── Payment process ───────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{t('itemForm.paymentProcess')}</h2>

        <div className="flex items-center justify-between py-2">
          <span className="text-sm font-medium">{t('itemForm.customFields')}</span>
          <Switch checked={customFields} onCheckedChange={onCustomFieldsChange} className="cursor-pointer" />
        </div>

        {customFields && (
          <div className="space-y-3 pl-0">
            <div className="rounded-xl border border-input bg-card p-4 space-y-2">
              <Label className="text-xs text-muted-foreground">{t('itemForm.customFieldTitle')}</Label>
              <Input placeholder={t('itemForm.customFieldPlaceholder')} className="h-9" />
            </div>
            <button
              type="button"
              className="w-full rounded-xl border border-input bg-muted/50 py-3 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              {t('itemForm.addCustomField')}
            </button>
          </div>
        )}

        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{t('itemForm.tips')}</span>
            <Badge variant="outline" className="text-[10px] h-4 px-1.5">Muy pronto</Badge>
          </div>
          <Switch checked={tips} onCheckedChange={onTipsChange} disabled className="cursor-pointer" />
        </div>
      </section>

      <hr className="border-border" />

      {/* ── Confirmation ──────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{t('itemForm.confirmation')}</h2>

        <div className="flex items-center justify-between py-2">
          <span className="text-sm">{t('itemForm.redirectAfterPayment')}</span>
          <Switch checked={redirectEnabled} onCheckedChange={onRedirectEnabledChange} className="cursor-pointer" />
        </div>

        {redirectEnabled && (
          <Input
            type="url"
            value={redirectUrl}
            onChange={e => onRedirectUrlChange(e.target.value)}
            placeholder={t('itemForm.redirectPlaceholder')}
          />
        )}
      </section>
    </div>
  )
}
