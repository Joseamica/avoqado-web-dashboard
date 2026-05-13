import { useQuery } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { SearchCombobox } from '@/components/search-combobox'
import type { SearchComboboxItem } from '@/components/search-combobox'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { getProducts } from '@/services/menu.service'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Product, ModifierGroup, Modifier } from '@/types'
import type { CustomFieldDefinition, TippingConfig } from '@/services/paymentLink.service'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { includesNormalized } from '@/lib/utils'

/** A pre-selected modifier on a bundle line (e.g. "Large size", "Extra cheese").
 *  Mirrors PaymentLinkItemModifier in the backend. Price is denormalised so
 *  the UI can compute subtotals without re-fetching the modifier each render. */
export interface BundleItemModifier {
  modifierId: string
  name: string
  price: number
  quantity: number
}

/** One line in a bundle payment link — product + quantity + pre-selected
 *  modifiers. The customer pays sum(qty × (product.price + Σ modifier.price)).
 *  Mirrors the backend PaymentLinkItem + PaymentLinkItemModifier rows. */
export interface BundleItem {
  product: Product
  quantity: number
  modifiers: BundleItemModifier[]
}

interface ItemFormSectionProps {
  selectedItems: BundleItem[]
  onItemsChange: (items: BundleItem[]) => void
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
  selectedItems,
  onItemsChange,
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

  const selectedProductIds = useMemo(() => new Set(selectedItems.map(it => it.product.id)), [selectedItems])

  // Show only products not yet in the bundle. Picking adds a new line at qty=1;
  // bumping the quantity stays in the line list instead of the combobox.
  const productItems: SearchComboboxItem[] = useMemo(() => {
    return products
      .filter(p => !selectedProductIds.has(p.id))
      .filter(p => !productSearch || includesNormalized(p.name ?? '', productSearch))
      .map(p => ({
        id: p.id,
        label: p.name,
        endLabel: formatPrice(p.price),
      }))
  }, [products, productSearch, selectedProductIds])

  const addProduct = (product: Product) => {
    if (selectedProductIds.has(product.id)) return
    onItemsChange([...selectedItems, { product, quantity: 1, modifiers: [] }])
  }

  const setQuantity = (productId: string, qty: number) => {
    if (qty < 1) return
    if (qty > 999) return
    onItemsChange(selectedItems.map(it => (it.product.id === productId ? { ...it, quantity: qty } : it)))
  }

  const removeItem = (productId: string) => {
    onItemsChange(selectedItems.filter(it => it.product.id !== productId))
  }

  /** Toggle a modifier on/off for an item. For single-select groups
   *  (allowMultiple=false), picking a different modifier from the same group
   *  REPLACES the previous one; for multi-select groups it just adds/removes. */
  const toggleModifier = (productId: string, group: ModifierGroup, modifier: Modifier) => {
    onItemsChange(
      selectedItems.map(it => {
        if (it.product.id !== productId) return it
        const groupModIds = new Set((group.modifiers ?? []).map(m => m.id))
        const isPicked = it.modifiers.some(m => m.modifierId === modifier.id)
        const otherGroups = it.modifiers.filter(m => !groupModIds.has(m.modifierId))
        const sameGroup = it.modifiers.filter(m => groupModIds.has(m.modifierId))
        let newSameGroup: BundleItemModifier[]
        if (isPicked) {
          // Remove
          newSameGroup = sameGroup.filter(m => m.modifierId !== modifier.id)
        } else if (!group.allowMultiple) {
          // Single-select: replace anything else in this group
          newSameGroup = [{ modifierId: modifier.id, name: modifier.name, price: Number(modifier.price), quantity: 1 }]
        } else {
          // Multi-select: add
          newSameGroup = [...sameGroup, { modifierId: modifier.id, name: modifier.name, price: Number(modifier.price), quantity: 1 }]
        }
        return { ...it, modifiers: [...otherGroups, ...newSameGroup] }
      }),
    )
  }

  /** Per-line total = qty × (product price + Σ modifier price × modifier qty). */
  const lineTotal = (it: BundleItem) => {
    const modSum = it.modifiers.reduce((s, m) => s + m.price * m.quantity, 0)
    return (Number(it.product.price) + modSum) * it.quantity
  }

  const subtotal = selectedItems.reduce((sum, it) => sum + lineTotal(it), 0)

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
      {/* ── Bundle line items ─────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Artículos</h2>
        <p className="text-sm text-muted-foreground">
          Agrega uno o varios productos. El cliente paga el total exacto del bundle.
        </p>

        {/* Selected items list — each line has quantity stepper + inline
            modifier picker per product that has groups. */}
        {selectedItems.length > 0 && (
          <div className="rounded-xl border border-input bg-card divide-y divide-input">
            {selectedItems.map(it => {
              const groups: ModifierGroup[] = (it.product.modifierGroups ?? [])
                .map(pmg => pmg.group)
                .filter((g): g is ModifierGroup => !!g && (g.modifiers?.length ?? 0) > 0)
              const hasModifierGroups = groups.length > 0

              return (
                <div key={it.product.id} className="p-3 space-y-3">
                  {/* Top row: product + qty stepper + line total + remove */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{it.product.name}</p>
                      <p className="text-xs text-muted-foreground">{formatPrice(Number(it.product.price))} c/u</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 cursor-pointer"
                        onClick={() => setQuantity(it.product.id, it.quantity - 1)}
                        disabled={it.quantity <= 1}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <Input
                        type="number"
                        min={1}
                        max={999}
                        value={it.quantity}
                        onChange={e => {
                          const v = parseInt(e.target.value, 10)
                          if (!Number.isNaN(v)) setQuantity(it.product.id, v)
                        }}
                        className="h-8 w-14 text-center text-sm"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 cursor-pointer"
                        onClick={() => setQuantity(it.product.id, it.quantity + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="w-20 text-right font-medium text-sm">{formatPrice(lineTotal(it))}</div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive cursor-pointer"
                      onClick={() => removeItem(it.product.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Modifier groups for this product. Required + min/max info
                      is shown inline so the admin knows what to pick. */}
                  {hasModifierGroups && (
                    <div className="space-y-2 pl-2 border-l-2 border-muted">
                      {groups.map(group => {
                        const modifiers: Modifier[] = group.modifiers ?? []
                        const pickedInGroup = it.modifiers.filter(m =>
                          modifiers.some(gm => gm.id === m.modifierId),
                        )
                        const meta: string[] = []
                        if (group.required) meta.push('requerido')
                        if (group.minSelections > 0)
                          meta.push(`mín ${group.minSelections}`)
                        if (group.maxSelections != null)
                          meta.push(`máx ${group.maxSelections}`)
                        if (!group.allowMultiple && !group.required) meta.push('elige uno')
                        return (
                          <div key={group.id} className="space-y-1.5">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-medium">{group.name}</span>
                              {meta.length > 0 && (
                                <span className="text-muted-foreground">· {meta.join(' · ')}</span>
                              )}
                              {pickedInGroup.length > 0 && (
                                <span className="ml-auto text-muted-foreground">
                                  {pickedInGroup.length} seleccionado{pickedInGroup.length === 1 ? '' : 's'}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {modifiers.map(m => {
                                const picked = it.modifiers.some(mm => mm.modifierId === m.id)
                                return (
                                  <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => toggleModifier(it.product.id, group, m)}
                                    className={`rounded-full border px-2.5 py-1 text-xs transition-colors cursor-pointer ${
                                      picked
                                        ? 'border-foreground bg-foreground text-background'
                                        : 'border-input hover:bg-muted'
                                    }`}
                                  >
                                    {m.name}
                                    {Number(m.price) > 0 && (
                                      <span className={picked ? '' : 'text-muted-foreground'}>
                                        {' '}
                                        +{formatPrice(Number(m.price))}
                                      </span>
                                    )}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
            {/* Subtotal footer */}
            <div className="flex items-center justify-between p-3 bg-muted/40">
              <span className="text-sm font-medium">Subtotal</span>
              <span className="text-base font-semibold">{formatPrice(subtotal)}</span>
            </div>
          </div>
        )}

        {/* Product picker — adds a new line at qty=1 */}
        <SearchCombobox
          placeholder={selectedItems.length === 0 ? 'Selecciona un producto…' : 'Agregar otro producto…'}
          items={productItems}
          isLoading={productsLoading}
          value={productSearch}
          onChange={setProductSearch}
          onSelect={item => {
            const product = products.find(p => p.id === item.id)
            if (product) {
              addProduct(product)
              setProductSearch('') // reset so user can immediately search the next one
            }
          }}
        />
        {selectedItems.length > 0 && (
          <p className="text-xs text-muted-foreground">{selectedItems.length} de 20 productos</p>
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
