import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { StripePaymentMethod } from '@/components/StripePaymentMethod'
import { Check } from 'lucide-react'

interface PaymentRequiredDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedFeatures: string[]
  featurePricing: Record<string, number>
  onPaymentComplete: (paymentMethodId: string) => void
  onContinueWithout: () => void
}

export function PaymentRequiredDialog({
  open,
  onOpenChange,
  selectedFeatures,
  featurePricing,
  onPaymentComplete,
  onContinueWithout,
}: PaymentRequiredDialogProps) {
  const { t } = useTranslation('onboarding')

  const totalMonthlyCost = selectedFeatures.reduce(
    (sum, feature) => sum + (featurePricing[feature] || 0),
    0
  )

  const handleContinueWithout = () => {
    onOpenChange(false)
    onContinueWithout()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('features.paymentDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('features.paymentDialog.subtitle')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Selected features list */}
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
            {selectedFeatures.map(feature => (
              <div key={feature} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span>{t(`features.available.${feature}.name`)}</span>
                </div>
                <span className="font-medium">
                  ${(featurePricing[feature] || 0).toLocaleString()}/{t('shared.perMonth')}
                </span>
              </div>
            ))}

            {/* Total */}
            <div className="border-t border-border pt-2 mt-2 flex items-center justify-between">
              <span className="text-sm font-medium">{t('features.paymentDialog.totalAfterTrial')}</span>
              <span className="text-lg font-bold">${totalMonthlyCost.toLocaleString()} {t('currency.mxn', { ns: 'common' })}</span>
            </div>
          </div>

          {/* Stripe form with real card validation */}
          <StripePaymentMethod
            useOnboardingIntent={true}
            onPaymentMethodCreated={onPaymentComplete}
            buttonText={t('shared.startFreeTrial2Days')}
          />

          {/* Continue without features */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-background px-2 text-muted-foreground">{t('features.paymentDialog.or')}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleContinueWithout}
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            <span className="underline underline-offset-2">{t('features.paymentDialog.continueWithout')}</span>
            <p className="text-xs mt-1 no-underline">{t('features.paymentDialog.continueWithoutHint')}</p>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
