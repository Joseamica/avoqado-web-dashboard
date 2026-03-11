import { CreditCard, Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useCurrentVenue } from '@/hooks/use-current-venue'
import { PhoneFrame } from './PhoneFrame'

interface PaymentLinkPreviewProps {
  title: string
  description?: string
  imageUrl?: string
  amountType: 'FIXED' | 'OPEN'
  amount?: number
  currency?: string
}

export function PaymentLinkPreview({
  title,
  description,
  imageUrl,
  amountType,
  amount,
  currency = 'MXN',
}: PaymentLinkPreviewProps) {
  const { t } = useTranslation('paymentLinks')
  const { venue } = useCurrentVenue()

  const formattedAmount =
    amountType === 'FIXED' && amount
      ? new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(amount)
      : null

  return (
    <div className="flex flex-col items-center">
      <PhoneFrame
        footer={
          <div className="shrink-0 bg-muted/40 px-5 py-3.5 flex items-center justify-center gap-1.5 border-t border-border/40">
            <Lock className="h-3 w-3 text-muted-foreground/60" />
            <span className="text-[11px] text-muted-foreground/60">{t('preview.securePayment')}</span>
          </div>
        }
      >
        <div className="px-5 pt-1 pb-4 space-y-4">
          {/* Venue name */}
          <p className="text-center text-sm font-semibold">{venue?.name || 'Venue'}</p>

          {/* Image */}
          {imageUrl && (
            <div className="rounded-xl overflow-hidden">
              <img src={imageUrl} alt={title} className="w-full h-36 object-cover" />
            </div>
          )}

          {/* Title & description */}
          <div>
            <h3 className="font-bold text-lg leading-snug">
              {title || t('form.titlePlaceholder')}
            </h3>

            {amountType === 'FIXED' && formattedAmount ? (
              <p className="text-base font-medium mt-1">{formattedAmount}</p>
            ) : null}

            {description && (
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">
                {description}
              </p>
            )}
          </div>

          {amountType === 'OPEN' && (
            <>
              <hr className="border-border/60" />
              <div className="rounded-lg border border-input bg-muted/30 px-3 py-2.5">
                <span className="text-sm text-muted-foreground">{t('preview.enterAmount')}</span>
              </div>
            </>
          )}

          <hr className="border-border/60" />

          {/* Card fields placeholder */}
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
            {t('preview.payButton')}
            {amountType === 'FIXED' && formattedAmount ? ` ${formattedAmount}` : ''}
          </button>
        </div>

      </PhoneFrame>
    </div>
  )
}
