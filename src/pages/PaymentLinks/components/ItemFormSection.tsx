import { useQuery } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { SearchCombobox } from '@/components/search-combobox'
import type { SearchComboboxItem } from '@/components/search-combobox'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { getProducts } from '@/services/menu.service'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Product } from '@/types'
import type { CustomFieldDefinition, TippingConfig } from '@/services/paymentLink.service'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface ItemFormSectionProps {
  selectedProduct: Product | null
  onProductSelect: (product: Product) => void
  customFields: CustomFieldDefinition[]
  onCustomFieldsChange: (fields: CustomFieldDefinition[]) => void
  customFieldsEnabled: boolean
  onCustomFieldsEnabledChange: (val: boolean) => void
  tippingConfig: TippingConfig | null
  onTippingConfigChange: (config: TippingConfig | null) => void
  redirectUrl: string
  onRedirectUrlChange: (val: string) => void
  redirectEnabled: boolean
  onRedirectEnabledChange: (val: boolean) => void
}

let fieldCounter = 0

export function ItemFormSection({
  selectedProduct,
  onProductSelect,
  customFields,
  onCustomFieldsChange,
  customFieldsEnabled,
  onCustomFieldsEnabledChange,
  tippingConfig,
  onTippingConfigChange,
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

  const formatPrice = (price: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(price)

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

  // ─── Custom field handlers ──────────────────────────────
  const addCustomField = () => {
    if (customFields.length >= 5) return
    fieldCounter += 1
    onCustomFieldsChange([...customFields, { id: `cf_${Date.now()}_${fieldCounter}`, type: 'TEXT', label: '', required: false }])
  }

  const updateField = (index: number, updates: Partial<CustomFieldDefinition>) => {
    const updated = [...customFields]
    updated[index] = { ...updated[index], ...updates }
    onCustomFieldsChange(updated)
  }

  const removeField = (index: number) => {
    onCustomFieldsChange(customFields.filter((_, i) => i !== index))
  }

  // ─── Tipping handlers ──────────────────────────────────
  const tippingEnabled = tippingConfig !== null
  const handleTippingToggle = (enabled: boolean) => {
    if (enabled) {
      onTippingConfigChange({ presets: [10, 15, 20], allowCustom: true })
    } else {
      onTippingConfigChange(null)
    }
  }

  const updatePreset = (index: number, value: string) => {
    if (!tippingConfig) return
    const num = parseInt(value, 10)
    if (isNaN(num) || num < 1 || num > 100) return
    const presets = [...tippingConfig.presets]
    presets[index] = num
    onTippingConfigChange({ ...tippingConfig, presets })
  }

  return (
    <div className="space-y-8">
      {/* ── Product selector ──────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('itemForm.article')}</h2>
        <p className="text-sm text-muted-foreground">{t('itemForm.articleHint')}</p>

        <SearchCombobox
          placeholder={t('itemForm.selectProduct')}
          items={productItems}
          isLoading={productsLoading}
          value={productSearch}
          onChange={setProductSearch}
          onSelect={item => {
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

        {/* Custom fields toggle */}
        <div className="flex items-center justify-between py-2">
          <span className="text-sm font-medium">{t('itemForm.customFields')}</span>
          <Switch
            checked={customFieldsEnabled}
            onCheckedChange={val => {
              onCustomFieldsEnabledChange(val)
              if (!val) {
                onCustomFieldsChange([])
              } else if (customFields.length === 0) {
                onCustomFieldsChange([{ id: `cf_${Date.now()}`, type: 'TEXT', label: '', required: false }])
              }
            }}
            className="cursor-pointer"
          />
        </div>

        {/* Custom fields list */}
        {customFieldsEnabled && (
          <div className="space-y-3">
            {customFields.map((field, index) => (
              <div key={field.id} className="rounded-xl border border-input bg-card p-3.5 space-y-2.5">
                {/* Row 1: Label + Delete */}
                <div className="flex items-center gap-2">
                  <Input
                    value={field.label}
                    onChange={e => updateField(index, { label: e.target.value })}
                    placeholder={t('itemForm.customFieldPlaceholder')}
                    className="flex-1 h-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0 text-muted-foreground hover:text-destructive cursor-pointer"
                    onClick={() => removeField(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* Row 2: Type selector + Required checkbox */}
                <div className="flex items-center gap-3">
                  <Select
                    value={field.type}
                    onValueChange={val =>
                      updateField(index, {
                        type: val as 'TEXT' | 'SELECT',
                        options: val === 'SELECT' ? field.options || [''] : undefined,
                      })
                    }
                  >
                    <SelectTrigger className="w-[100px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TEXT">{t('itemForm.fieldTypeText')}</SelectItem>
                      <SelectItem value="SELECT">{t('itemForm.fieldTypeSelect')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <Checkbox
                      checked={field.required}
                      onCheckedChange={val => updateField(index, { required: val === true })}
                      className="cursor-pointer"
                    />
                    <span className="text-xs text-muted-foreground">{t('itemForm.requiredField')}</span>
                  </label>
                </div>

                {/* Options for SELECT type */}
                {field.type === 'SELECT' && (
                  <div className="space-y-1.5 pl-1">
                    {(field.options || ['']).map((opt, optIdx) => (
                      <div key={optIdx} className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground w-4">{optIdx + 1}.</span>
                        <Input
                          value={opt}
                          onChange={e => {
                            const opts = [...(field.options || [''])]
                            opts[optIdx] = e.target.value
                            updateField(index, { options: opts })
                          }}
                          placeholder={t('itemForm.optionPlaceholder')}
                          className="h-8 text-sm flex-1"
                        />
                        {(field.options || []).length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => {
                              const opts = (field.options || []).filter((_, i) => i !== optIdx)
                              updateField(index, { options: opts })
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {(field.options || []).length < 10 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          const opts = [...(field.options || []), '']
                          updateField(index, { options: opts })
                        }}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        {t('itemForm.addOption')}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}

            {customFields.length < 5 && (
              <button
                type="button"
                onClick={addCustomField}
                className="w-full rounded-full border border-dashed border-border bg-muted/40 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground hover:border-foreground/20 transition-colors cursor-pointer"
              >
                {t('itemForm.addCustomField')}
              </button>
            )}
            <p className="text-xs text-muted-foreground text-center">
              {t('itemForm.customFieldsLimit', { count: customFields.length, max: 5 })}
            </p>
          </div>
        )}

        {/* Tips toggle */}
        <div className="flex items-center justify-between py-2">
          <span className="text-sm font-medium">{t('itemForm.tips')}</span>
          <Switch checked={tippingEnabled} onCheckedChange={handleTippingToggle} className="cursor-pointer" />
        </div>

        {/* Tipping config */}
        {tippingEnabled && tippingConfig && (
          <div className="rounded-xl border border-input bg-card p-4 space-y-4">
            <div>
              <p className="text-sm font-medium mb-2.5">{t('itemForm.tipPresets')}</p>
              <div className="grid grid-cols-3 gap-2">
                {tippingConfig.presets.map((preset, index) => (
                  <div key={index} className="relative">
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={preset}
                      onChange={e => updatePreset(index, e.target.value)}
                      className="h-10 text-center pr-7 text-base font-medium"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-border/50">
              <span className="text-sm">{t('itemForm.allowCustomTip')}</span>
              <Switch
                checked={tippingConfig.allowCustom}
                onCheckedChange={val => onTippingConfigChange({ ...tippingConfig, allowCustom: val })}
                className="cursor-pointer"
              />
            </div>
          </div>
        )}
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
