import { Check, ChevronDown, Circle, CreditCard, ExternalLink, ImageIcon, Lock, Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import type { Product } from '@/types'
import type { CustomFieldDefinition, TippingConfig } from '@/services/paymentLink.service'
import { PhoneFrame } from './PhoneFrame'

type PreviewTab = 'details' | 'payment' | 'confirmation'

interface ItemPreviewProps {
  product: Product | null
  redirectEnabled: boolean
  redirectUrl: string
  customFields?: CustomFieldDefinition[]
  tippingConfig?: TippingConfig | null
}

export function ItemPreview({ product, redirectEnabled, redirectUrl, customFields, tippingConfig }: ItemPreviewProps) {
  const { t } = useTranslation('paymentLinks')
  const { venue } = useCurrentVenue()
  const [activeTab, setActiveTab] = useState<PreviewTab>('details')
  const [quantity, setQuantity] = useState(1)
  const [selectedTip, setSelectedTip] = useState<number | null>(null)

  const formatPrice = (price: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(price)

  const tabs: { key: PreviewTab; label: string }[] = [
    { key: 'details', label: t('itemPreview.details') },
    { key: 'payment', label: t('itemPreview.paymentProcess') },
    { key: 'confirmation', label: t('itemPreview.confirmation') },
  ]

  const subtotal = product ? Number(product.price) * quantity : 0
  const tipAmount = selectedTip !== null ? subtotal * (selectedTip / 100) : 0
  const total = subtotal + tipAmount

  return (
    <div className="flex flex-col items-center">
      {/* Tabs — pill-style per ui-patterns */}
      <div className="flex items-center justify-center mb-5">
        <div className="inline-flex rounded-full bg-muted/60 px-1 py-1 border border-border">
          {tabs.map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                activeTab === tab.key ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <PhoneFrame
        footer={
          <div className="shrink-0 bg-muted/40 px-5 py-3.5 flex items-center justify-center gap-1.5 border-t border-border/40">
            <Lock className="h-3 w-3 text-muted-foreground/60" />
            <span className="text-[11px] text-muted-foreground/60">{t('preview.securePayment')}</span>
          </div>
        }
      >
        {/* Venue logo */}
        <div className="flex justify-center pt-5 pb-3">
          {venue?.logo ? (
            <img src={venue.logo} alt={venue.name} className="h-10 w-10 object-contain" />
          ) : (
            <p className="text-xs text-muted-foreground font-medium tracking-wide uppercase">{venue?.name || 'Venue'}</p>
          )}
        </div>

        {/* Product image — full width like Square */}
        {product?.imageUrl ? (
          <div className="border-y border-border">
            <img src={product.imageUrl} alt={product.name} className="w-full h-48 object-cover" />
          </div>
        ) : (
          <div className="border-y border-border bg-muted/30 w-full h-48 flex flex-col items-center justify-center gap-2">
            <ImageIcon className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.5} />
          </div>
        )}

        {/* Content */}
        <div className="px-5 pt-5 pb-4 space-y-5">
          {/* ═══ DETAILS TAB ═══ */}
          {activeTab === 'details' && (
            <>
              {/* Name, price, description */}
              <div>
                <h3 className="font-bold text-xl leading-snug">{product?.name || t('itemPreview.articlePlaceholder')}</h3>
                <p className="text-lg font-medium mt-1.5">{product ? formatPrice(Number(product.price)) : '$0.00'}</p>
                {product?.description && <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{product.description}</p>}
              </div>

              {/* Custom fields preview */}
              {customFields && customFields.length > 0 && (
                <>
                  {customFields.map(field => (
                    <div key={field.id} className="space-y-1.5">
                      <p className="text-sm font-semibold">
                        {field.label || t('itemForm.customFieldPlaceholder')}
                        {field.required && <span className="text-destructive ml-0.5">*</span>}
                      </p>
                      {field.type === 'SELECT' ? (
                        <div className="flex items-center justify-between rounded-lg border border-input px-3 py-2.5">
                          <span className="text-sm text-muted-foreground">{t('itemPreview.selectOne')}</span>
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        </div>
                      ) : (
                        <div className="rounded-lg border border-input bg-muted/30 px-3 py-2.5">
                          <span className="text-sm text-muted-foreground/60">{field.label || t('itemForm.customFieldPlaceholder')}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}

              {/* Fulfillment method */}
              <hr className="border-border" />
              <div className="space-y-2.5">
                <p className="text-sm font-semibold">{t('itemPreview.fulfillment')}</p>
                <div className="flex items-center gap-2.5">
                  <Circle className="h-5 w-5 text-foreground fill-foreground" />
                  <span className="text-sm">{t('itemPreview.shipping')}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Circle className="h-5 w-5 text-muted-foreground/40" />
                  <span className="text-sm text-muted-foreground">{t('itemPreview.pickup')}</span>
                </div>
              </div>

              <hr className="border-border" />

              {/* Quantity selector */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-9 h-9 rounded-lg border border-input flex items-center justify-center cursor-pointer hover:bg-muted transition-colors"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="text-base font-medium w-6 text-center">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-9 h-9 rounded-lg border border-input flex items-center justify-center cursor-pointer hover:bg-muted transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Subtotal */}
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold">{t('itemPreview.subtotal')}</p>
                  <p className="text-sm font-bold">{formatPrice(subtotal)}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{t('itemPreview.totalCalculated')}</p>
              </div>

              {/* CTA button */}
              <button className="w-full rounded-xl bg-primary py-3.5 text-base font-semibold text-primary-foreground">
                {t('itemPreview.processPayment')}
              </button>
            </>
          )}

          {/* ═══ PAYMENT TAB ═══ */}
          {activeTab === 'payment' && (
            <>
              <h3 className="font-bold text-base">{t('itemPreview.paymentProcess')}</h3>

              {/* Order summary */}
              <div className="flex items-center justify-between text-sm">
                <span>{t('itemPreview.orderSummary', { count: quantity })}</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </div>

              <hr className="border-border/60" />

              {/* Price breakdown */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>{t('itemPreview.subtotal')}</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>

                {/* Tip selector */}
                {tippingConfig && (
                  <div className="pt-1">
                    <p className="text-xs font-medium mb-2">{t('itemPreview.addTip')}</p>
                    <div className="flex gap-1.5">
                      {tippingConfig.presets.map(pct => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setSelectedTip(selectedTip === pct ? null : pct)}
                          className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                            selectedTip === pct
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-input text-muted-foreground hover:border-foreground/30'
                          }`}
                        >
                          {pct}%
                        </button>
                      ))}
                      {tippingConfig.allowCustom && (
                        <button type="button" className="flex-1 rounded-lg border border-input px-2 py-1.5 text-xs text-muted-foreground">
                          {t('itemPreview.customTip')}
                        </button>
                      )}
                    </div>
                    {selectedTip !== null && (
                      <div className="flex items-center justify-between text-sm mt-2">
                        <span>{t('itemPreview.tip')}</span>
                        <span>{formatPrice(tipAmount)}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between text-sm font-semibold pt-2 border-t border-dashed border-border/60">
                  <span>{t('itemPreview.orderTotal')}</span>
                  <span>{formatPrice(total)}</span>
                </div>
              </div>

              <hr className="border-border/60" />

              {/* Card fields mock */}
              <div className="space-y-2">
                <div className="rounded-lg border border-input bg-muted/30 px-3 py-2.5 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground/60" />
                  <span className="text-sm text-muted-foreground/60">4242 •••• •••• ••••</span>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 rounded-lg border border-input bg-muted/30 px-3 py-2.5">
                    <span className="text-sm text-muted-foreground/60">MM/YY</span>
                  </div>
                  <div className="flex-1 rounded-lg border border-input bg-muted/30 px-3 py-2.5">
                    <span className="text-sm text-muted-foreground/60">CVV</span>
                  </div>
                </div>
              </div>

              <button className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground">
                {t('itemPreview.pay')} {formatPrice(total)}
              </button>
            </>
          )}

          {/* ═══ CONFIRMATION TAB ═══ */}
          {activeTab === 'confirmation' && (
            <>
              {redirectEnabled && redirectUrl ? (
                <div className="flex flex-col items-center justify-center py-10 space-y-3">
                  <ExternalLink className="h-7 w-7 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground text-center leading-relaxed">{t('itemPreview.redirectMessage')}</p>
                </div>
              ) : (
                <>
                  <div className="flex flex-col items-center gap-2 py-2">
                    <div className="w-9 h-9 rounded-full bg-success/15 flex items-center justify-center">
                      <Check className="h-5 w-5 text-success" />
                    </div>
                    <p className="text-sm font-semibold">{t('itemPreview.paymentConfirmed')}</p>
                  </div>

                  <hr className="border-border/60" />

                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('itemPreview.summary')}</p>
                    <div className="flex items-center justify-between text-sm">
                      <span>{product?.name || t('itemPreview.articlePlaceholder')}</span>
                      <span>{formatPrice(subtotal)}</span>
                    </div>
                    {selectedTip !== null && tipAmount > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span>{t('itemPreview.tip')}</span>
                        <span>{formatPrice(tipAmount)}</span>
                      </div>
                    )}
                    <hr className="border-border/60" />
                    <div className="flex items-center justify-between text-sm">
                      <span>{t('itemPreview.subtotal')}</span>
                      <span>{formatPrice(subtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm font-semibold">
                      <span>{t('itemPreview.orderTotal')}</span>
                      <span>{formatPrice(total)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">VISA {t('itemPreview.endingIn')} 1234</p>
                  </div>

                  <hr className="border-border/60" />

                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p>John Doe</p>
                    <p>john@example.com</p>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </PhoneFrame>
    </div>
  )
}
