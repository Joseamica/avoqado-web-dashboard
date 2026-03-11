import { Check, CreditCard, ExternalLink, Lock, Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import type { Product } from '@/types'
import { PhoneFrame } from './PhoneFrame'

type PreviewTab = 'details' | 'payment' | 'confirmation'

interface ItemPreviewProps {
  product: Product | null
  redirectEnabled: boolean
  redirectUrl: string
  customFieldsEnabled?: boolean
}

export function ItemPreview({ product, redirectEnabled, redirectUrl, customFieldsEnabled }: ItemPreviewProps) {
  const { t } = useTranslation('paymentLinks')
  const { venue } = useCurrentVenue()
  const [activeTab, setActiveTab] = useState<PreviewTab>('details')
  const [quantity, setQuantity] = useState(1)

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(price)

  const tabs: { key: PreviewTab; label: string }[] = [
    { key: 'details', label: t('itemPreview.details') },
    { key: 'payment', label: t('itemPreview.paymentProcess') },
    { key: 'confirmation', label: t('itemPreview.confirmation') },
  ]

  const subtotal = product ? product.price * quantity : 0

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
                activeTab === tab.key
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Phone mockup */}
      <PhoneFrame
        footer={
          <div className="shrink-0 bg-muted/40 px-5 py-3.5 flex items-center justify-center gap-1.5 border-t border-border/40">
            <Lock className="h-3 w-3 text-muted-foreground/60" />
            <span className="text-[11px] text-muted-foreground/60">{t('preview.securePayment')}</span>
          </div>
        }
      >
        <div className="px-5 pt-1 pb-4">
          {/* Venue name */}
          <p className="text-center text-sm font-semibold mb-3">{venue?.name || 'Venue'}</p>

          {/* Color/image band */}
          {product?.imageUrl ? (
            <div className="rounded-xl overflow-hidden mb-4">
              <img src={product.imageUrl} alt="" className="w-full h-40 object-cover" />
            </div>
          ) : (
            <div className="h-2.5 bg-muted rounded-full mb-4" />
          )}

          {activeTab === 'details' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-lg leading-snug">
                  {product?.name || t('itemPreview.articlePlaceholder')}
                </h3>
                <p className="text-base font-medium mt-1">
                  {product ? formatPrice(product.price) : '$0.00'}
                </p>
                {product?.description && (
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">
                    {product.description}
                  </p>
                )}
              </div>

              <hr className="border-border/60" />

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
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{t('itemPreview.subtotal')}</span>
                <span className="text-sm font-semibold">{formatPrice(subtotal)}</span>
              </div>
              <p className="text-[11px] text-muted-foreground -mt-2">
                {t('itemPreview.totalCalculated')}
              </p>

              {/* CTA button */}
              <button className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground">
                {t('itemPreview.processPayment')}
              </button>
            </div>
          )}

          {activeTab === 'payment' && (
            <div className="space-y-4">
              <h3 className="font-bold text-base">{t('itemPreview.paymentProcess')}</h3>

              {/* Custom fields — shown when enabled */}
              {customFieldsEnabled && (
                <>
                  <div className="rounded-lg border border-input bg-muted/30 px-3 py-2.5">
                    <span className="text-sm text-muted-foreground/60">{t('itemForm.customFieldPlaceholder')}</span>
                  </div>
                  <hr className="border-border/60" />
                </>
              )}

              {/* Order summary */}
              <div className="flex items-center justify-between text-sm">
                <span>{t('itemPreview.orderSummary', { count: quantity })}</span>
                <ChevronDownIcon />
              </div>

              <hr className="border-border/60" />

              {/* Price breakdown */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>{t('itemPreview.subtotal')}</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-sm font-semibold pt-2 border-t border-dashed border-border/60">
                  <span>{t('itemPreview.orderTotal')}</span>
                  <span>{formatPrice(subtotal)}</span>
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
                {t('itemPreview.pay')} {formatPrice(subtotal)}
              </button>
            </div>
          )}

          {activeTab === 'confirmation' && (
            <div className="space-y-4">
              {redirectEnabled && redirectUrl ? (
                <div className="flex flex-col items-center justify-center py-10 space-y-3">
                  <ExternalLink className="h-7 w-7 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground text-center leading-relaxed">
                    {t('itemPreview.redirectMessage')}
                  </p>
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
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t('itemPreview.summary')}
                    </p>
                    <div className="flex items-center justify-between text-sm">
                      <span>{product?.name || t('itemPreview.articlePlaceholder')}</span>
                      <span>{formatPrice(subtotal)}</span>
                    </div>
                    <hr className="border-border/60" />
                    <div className="flex items-center justify-between text-sm">
                      <span>{t('itemPreview.subtotal')}</span>
                      <span>{formatPrice(subtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm font-semibold">
                      <span>{t('itemPreview.orderTotal')}</span>
                      <span>{formatPrice(subtotal)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      VISA {t('itemPreview.endingIn')} 1234
                    </p>
                  </div>

                  <hr className="border-border/60" />

                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p>John Doe</p>
                    <p>john@example.com</p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

      </PhoneFrame>
    </div>
  )
}

function ChevronDownIcon() {
  return (
    <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}
