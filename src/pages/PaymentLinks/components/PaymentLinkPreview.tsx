import { Check, ChevronDown, CreditCard, ExternalLink, Lock } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useCurrentVenue } from '@/hooks/use-current-venue'
import type { CustomFieldDefinition, TippingConfig } from '@/services/paymentLink.service'
import { PhoneFrame } from './PhoneFrame'

type PreviewTab = 'details' | 'payment' | 'confirmation'

interface PaymentLinkPreviewProps {
  title: string
  description?: string
  imageUrl?: string
  amountType: 'FIXED' | 'OPEN'
  amount?: number
  currency?: string
  tippingConfig?: TippingConfig | null
  customFields?: CustomFieldDefinition[]
  redirectEnabled?: boolean
  redirectUrl?: string
}

export function PaymentLinkPreview({
  title,
  description,
  imageUrl,
  amountType,
  amount,
  currency = 'MXN',
  tippingConfig,
  customFields,
  redirectEnabled,
  redirectUrl,
}: PaymentLinkPreviewProps) {
  const { t } = useTranslation('paymentLinks')
  const { venue } = useCurrentVenue()
  const [activeTab, setActiveTab] = useState<PreviewTab>('details')
  const [selectedTip, setSelectedTip] = useState<number | null>(null)

  const formatPrice = (price: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(price)

  const tabs: { key: PreviewTab; label: string }[] = [
    { key: 'details', label: t('itemPreview.details') },
    { key: 'payment', label: t('itemPreview.paymentProcess') },
    { key: 'confirmation', label: t('itemPreview.confirmation') },
  ]

  const baseAmount = amountType === 'FIXED' && amount ? amount : 0
  const tipAmount = selectedTip !== null ? baseAmount * (selectedTip / 100) : 0
  const total = baseAmount + tipAmount

  const formattedAmount = baseAmount > 0 ? formatPrice(baseAmount) : '$0.00'

  return (
    <div className="flex flex-col items-center">
      {/* Tabs — pill-style */}
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
        <div className="px-6 pt-6 pb-4 space-y-6">
          {/* Venue logo + name — always visible */}
          <div className="flex flex-col items-center gap-2">
            {venue?.logo && <img src={venue.logo} alt={venue.name} className="h-12 w-12 rounded-full object-contain bg-muted" />}
            <p className="text-center text-xs text-muted-foreground font-medium tracking-wide uppercase">{venue?.name || 'Venue'}</p>
          </div>

          {/* ═══ DETAILS TAB ═══ */}
          {activeTab === 'details' && (
            <>
              {/* Title */}
              <h3 className="text-center font-bold text-xl leading-snug">{title || t('form.titlePlaceholder')}</h3>

              {/* Image */}
              {imageUrl && (
                <div className="rounded-xl overflow-hidden">
                  <img src={imageUrl} alt={title} className="w-full h-36 object-cover" />
                </div>
              )}

              {/* Amount section */}
              <div className="flex flex-col items-center gap-1.5">
                {amountType === 'OPEN' && (
                  <span className="text-xs text-muted-foreground font-medium tracking-wider uppercase">{t('preview.enterAmount')}</span>
                )}
                <div className="rounded-lg bg-muted/50 px-8 py-3">
                  <span className="text-2xl font-bold text-muted-foreground">{formattedAmount}</span>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-foreground leading-relaxed">{description || t('preview.defaultDescription')}</p>

              {/* Custom fields preview */}
              {customFields && customFields.length > 0 && (
                <>
                  <hr className="border-border" />
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

              {/* Price breakdown */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>{t('itemPreview.subtotal')}</span>
                  <span>{formattedAmount}</span>
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
                    {selectedTip !== null && baseAmount > 0 && (
                      <div className="flex items-center justify-between text-sm mt-2">
                        <span>{t('itemPreview.tip')}</span>
                        <span>{formatPrice(tipAmount)}</span>
                      </div>
                    )}
                  </div>
                )}

                {selectedTip !== null && baseAmount > 0 && (
                  <div className="flex items-center justify-between text-sm font-semibold pt-2 border-t border-dashed border-border/60">
                    <span>{t('itemPreview.orderTotal')}</span>
                    <span>{formatPrice(total)}</span>
                  </div>
                )}
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

              {/* Pay button */}
              <button className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground">
                {t('preview.payButton')}{' '}
                {selectedTip !== null && baseAmount > 0 ? formatPrice(total) : formattedAmount !== '$0.00' ? formattedAmount : ''}
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
                      <span>{title || t('form.titlePlaceholder')}</span>
                      <span>{formattedAmount}</span>
                    </div>
                    {selectedTip !== null && tipAmount > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span>{t('itemPreview.tip')}</span>
                        <span>{formatPrice(tipAmount)}</span>
                      </div>
                    )}
                    <hr className="border-border/60" />
                    <div className="flex items-center justify-between text-sm font-semibold">
                      <span>{t('itemPreview.orderTotal')}</span>
                      <span>{formatPrice(total > 0 ? total : baseAmount)}</span>
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
