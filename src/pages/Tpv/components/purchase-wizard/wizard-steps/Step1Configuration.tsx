import { AlertCircle, ChevronDown, Minus, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  calculateCartTotals,
  formatMxnCents,
  TPV_CATALOG,
  TpvCatalogKey,
  type CartLine,
  type TpvCatalogEntry,
} from '@/config/tpvCatalog'

export interface Step1Data {
  cart: CartLine[]
  // Legacy fields kept optional until Task 22 rewrites Step4ReviewConfirm + parent.
  // Do not rely on these in new code — they are scaffolding.
  quantity?: number
  namePrefix?: string
  autoGenerate?: boolean
  serialNumbers?: string[]
}

interface Step1ConfigurationProps {
  cart: CartLine[]
  onChange: (cart: CartLine[]) => void
  /** Parent sets this true when the user clicks "Siguiente" with an empty cart. */
  showEmptyError?: boolean
}

const CATALOG_ORDER: TpvCatalogKey[] = ['PAX_A910S', 'NEXGO_N62', 'NEXGO_N86']
const MAX_TOTAL_UNITS = 10

export function Step1Configuration({ cart, onChange, showEmptyError }: Step1ConfigurationProps) {
  const { t } = useTranslation('tpv')
  const { t: tCommon } = useTranslation()
  const totals = calculateCartTotals(cart)
  const totalUnits = cart.reduce((sum, l) => sum + l.quantity, 0)
  // Highlight catalog "Agregar" buttons when the user clicked Siguiente with an empty cart.
  const cartEmpty = cart.length === 0
  const highlightAdd = Boolean(showEmptyError) && cartEmpty

  const updateQuantity = (key: TpvCatalogKey, delta: number) => {
    const existing = cart.find(l => l.catalogKey === key)
    if (!existing) {
      if (delta > 0) onChange([...cart, { catalogKey: key, quantity: 1 }])
      return
    }
    const newQty = existing.quantity + delta
    if (newQty <= 0) {
      onChange(cart.filter(l => l.catalogKey !== key))
    } else if (newQty <= MAX_TOTAL_UNITS) {
      onChange(cart.map(l => (l.catalogKey === key ? { ...l, quantity: newQty } : l)))
    }
  }

  const removeFromCart = (key: TpvCatalogKey) => onChange(cart.filter(l => l.catalogKey !== key))

  return (
    <div className="space-y-6">
      {/* Catalog cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {CATALOG_ORDER.map(key => {
          const entry = TPV_CATALOG[key]
          const inCart = cart.find(l => l.catalogKey === key)
          const modelSlug = entry.model.toLowerCase().replace(/[^a-z0-9]/g, '')
          return (
            <Card key={key} data-tour={`tpv-catalog-${modelSlug}`} className="p-4 flex flex-col gap-3 border-input">
              <div className="aspect-square w-full bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                <img
                  src={entry.image}
                  alt={entry.name}
                  className="object-contain max-w-full max-h-full"
                  onError={e => {
                    ;(e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-lg">{entry.name}</h3>
                <p className="text-sm text-muted-foreground">{entry.description}</p>
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground flex-1">
                {entry.features.map(f => (
                  <li key={f}>• {f}</li>
                ))}
              </ul>
              <div className="pt-2">
                <div className="text-2xl font-bold">{formatMxnCents(entry.unitPriceCents)}</div>
                <div className="text-xs text-muted-foreground">{t('purchaseWizard.step1.catalog.perUnitTaxNote')}</div>
              </div>
              <SpecsDrawer entry={entry} />
              {inCart ? (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => updateQuantity(key, -1)}
                    data-tour={`tpv-cart-decrement-${modelSlug}`}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-10 text-center font-semibold text-lg">{inCart.quantity}</span>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => updateQuantity(key, 1)}
                    disabled={totalUnits >= MAX_TOTAL_UNITS}
                    data-tour={`tpv-cart-increment-${modelSlug}`}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => updateQuantity(key, 1)}
                  className={`w-full ${
                    highlightAdd ? 'ring-2 ring-destructive/70 ring-offset-2 ring-offset-card animate-pulse' : ''
                  }`}
                  data-tour={`tpv-cart-add-${modelSlug}`}
                  disabled={totalUnits >= MAX_TOTAL_UNITS}
                >
                  {t('purchaseWizard.step1.catalog.add')}
                </Button>
              )}
            </Card>
          )
        })}
      </div>

      {/* Cart summary */}
      <Card
        className={`transition-colors ${highlightAdd ? 'border-destructive/70' : 'border-input'}`}
        data-tour="tpv-cart-summary"
      >
        <div className="p-5 space-y-3">
          <h3 className="font-semibold">{t('purchaseWizard.step1.cart.title')}</h3>
          {cartEmpty ? (
            showEmptyError ? (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{t('purchaseWizard.step1.cart.validationEmpty')}</span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('purchaseWizard.step1.cart.empty')}</p>
            )
          ) : (
            <>
              <div className="space-y-2">
                {cart.map(line => {
                  const entry = TPV_CATALOG[line.catalogKey]
                  if (!entry) return null
                  return (
                    <div key={line.catalogKey} className="flex items-center justify-between text-sm">
                      <span>
                        {entry.name} × {line.quantity}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{formatMxnCents(entry.unitPriceCents * line.quantity)}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeFromCart(line.catalogKey as TpvCatalogKey)}
                          aria-label={tCommon('common.delete')}
                          className="cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
              <hr className="border-input" />
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('purchaseWizard.step1.cart.subtotal')}</span>
                  <span>{formatMxnCents(totals.subtotalCents)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('purchaseWizard.step1.cart.tax')}</span>
                  <span>{formatMxnCents(totals.taxCents)}</span>
                </div>
                <div className="flex justify-between text-base font-bold pt-1 border-t border-input">
                  <span>{t('purchaseWizard.step1.cart.total')}</span>
                  <span>{formatMxnCents(totals.totalCents)} MXN</span>
                </div>
              </div>
            </>
          )}
        </div>
      </Card>

      {totalUnits >= MAX_TOTAL_UNITS && (
        <p className="text-sm text-amber-700 dark:text-amber-300">{t('purchaseWizard.step1.cart.maxUnits')}</p>
      )}
    </div>
  )
}

function SpecsDrawer({ entry }: { entry: TpvCatalogEntry }) {
  const { t } = useTranslation('tpv')
  const [open, setOpen] = useState(false)
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-between text-xs">
          {t('purchaseWizard.step1.catalog.viewSpecs')}
          <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2 text-xs text-muted-foreground space-y-1">
        {entry.specs.dimensions && (
          <div>
            <strong>{t('purchaseWizard.step1.specs.dimensions')}:</strong> {entry.specs.dimensions}
          </div>
        )}
        {entry.specs.weight && (
          <div>
            <strong>{t('purchaseWizard.step1.specs.weight')}:</strong> {entry.specs.weight}
          </div>
        )}
        {entry.specs.display && (
          <div>
            <strong>{t('purchaseWizard.step1.specs.display')}:</strong> {entry.specs.display}
          </div>
        )}
        {entry.specs.battery && (
          <div>
            <strong>{t('purchaseWizard.step1.specs.battery')}:</strong> {entry.specs.battery}
          </div>
        )}
        {entry.specs.os && (
          <div>
            <strong>{t('purchaseWizard.step1.specs.os')}:</strong> {entry.specs.os}
          </div>
        )}
        {entry.specs.connectivity && (
          <div>
            <strong>{t('purchaseWizard.step1.specs.connectivity')}:</strong> {entry.specs.connectivity.join(', ')}
          </div>
        )}
        {entry.specs.scanner && (
          <div>
            <strong>{t('purchaseWizard.step1.specs.scanner')}:</strong> {entry.specs.scanner}
          </div>
        )}
        {entry.specs.camera && (
          <div>
            <strong>{t('purchaseWizard.step1.specs.camera')}:</strong> {entry.specs.camera}
          </div>
        )}
        {entry.specs.printer && (
          <div>
            <strong>{t('purchaseWizard.step1.specs.printer')}:</strong> {entry.specs.printer}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
