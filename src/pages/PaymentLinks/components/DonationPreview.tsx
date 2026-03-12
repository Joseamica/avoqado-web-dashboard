import { Check, CreditCard, ImageIcon, Lock } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useCurrentVenue } from '@/hooks/use-current-venue'
import type { TippingConfig } from '@/services/paymentLink.service'
import { PhoneFrame } from './PhoneFrame'

type PreviewTab = 'details' | 'payment' | 'confirmation'

interface DonationPreviewProps {
  title: string
  description?: string
  imageUrl?: string
  tippingConfig?: TippingConfig | null
}

export function DonationPreview({ title, description, imageUrl, tippingConfig }: DonationPreviewProps) {
  const { t } = useTranslation('paymentLinks')
  const { venue } = useCurrentVenue()
  const [activeTab, setActiveTab] = useState<PreviewTab>('details')
  const [selectedTip, setSelectedTip] = useState<number | null>(null)

  const goalAmount = '$1,000.00'
  const raisedAmount = '$500.00'
  const progressPercent = 50

  const tabs: { key: PreviewTab; label: string }[] = [
    { key: 'details', label: t('itemPreview.details') },
    { key: 'payment', label: t('itemPreview.paymentProcess') },
    { key: 'confirmation', label: t('itemPreview.confirmation') },
  ]

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
        {/* ═══ DETAILS TAB ═══ */}
        {activeTab === 'details' && (
          <>
            {/* Venue logo */}
            <div className="flex justify-center pt-5 pb-3">
              {venue?.logo ? (
                <img src={venue.logo} alt={venue.name} className="h-12 w-12 rounded-full object-contain bg-muted" />
              ) : (
                <p className="text-xs text-muted-foreground font-medium tracking-wide uppercase">{venue?.name || 'Venue'}</p>
              )}
            </div>

            {/* Campaign image */}
            {imageUrl ? (
              <div className="border-y border-border">
                <img src={imageUrl} alt={title} className="w-full h-44 object-cover" />
              </div>
            ) : (
              <div className="border-y border-border bg-muted/30 w-full h-44 flex flex-col items-center justify-center gap-2">
                <ImageIcon className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.5} />
              </div>
            )}

            {/* Progress section */}
            <div className="px-5 pt-4 pb-2">
              <p className="text-lg font-bold">{raisedAmount}</p>
              <div className="w-full h-2 rounded-full bg-muted mt-1.5">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPercent}%` }} />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                {t('preview.raised', { amount: goalAmount })}
                {'  '}
                {t('preview.endsIn', { days: 30 })}
              </p>
            </div>

            <hr className="mx-5 border-border" />

            {/* Content */}
            <div className="px-5 pt-5 pb-4 space-y-5">
              <h3 className="text-center font-bold text-xl leading-snug">{title || t('preview.donationTitlePlaceholder')}</h3>

              {/* Enter donation amount */}
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-xs text-muted-foreground font-medium tracking-wider uppercase">
                  {t('preview.enterDonationAmount')}
                </span>
                <div className="rounded-lg bg-muted/50 px-8 py-3">
                  <span className="text-2xl font-bold text-muted-foreground">$0.00</span>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-foreground leading-relaxed">{description || t('preview.donationDefaultDescription')}</p>

              {/* Donate button */}
              <button className="w-full rounded-xl bg-primary py-3.5 text-base font-semibold text-primary-foreground">
                {t('preview.donateButton')}
              </button>
            </div>
          </>
        )}

        {/* ═══ PAYMENT TAB ═══ */}
        {activeTab === 'payment' && (
          <div className="px-5 pt-6 pb-4 space-y-5">
            <h3 className="font-bold text-base">{t('itemPreview.paymentProcess')}</h3>

            {/* Tip selector */}
            {tippingConfig && (
              <>
                <div>
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
                </div>
                <hr className="border-border" />
              </>
            )}

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

            {/* Donate button */}
            <button className="w-full rounded-xl bg-primary py-3.5 text-base font-semibold text-primary-foreground">
              {t('preview.donateButton')}
            </button>
          </div>
        )}

        {/* ═══ CONFIRMATION TAB ═══ */}
        {activeTab === 'confirmation' && (
          <div className="px-5 pt-6 pb-4 space-y-5">
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
                <span>{title || t('preview.donationTitlePlaceholder')}</span>
                <span>$0.00</span>
              </div>
              <hr className="border-border/60" />
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>{t('itemPreview.orderTotal')}</span>
                <span>$0.00</span>
              </div>
              <p className="text-xs text-muted-foreground">VISA {t('itemPreview.endingIn')} 1234</p>
            </div>

            <hr className="border-border/60" />

            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>John Doe</p>
              <p>john@example.com</p>
            </div>
          </div>
        )}
      </PhoneFrame>
    </div>
  )
}
