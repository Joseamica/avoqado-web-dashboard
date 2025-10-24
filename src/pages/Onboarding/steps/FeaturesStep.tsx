import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { StripePaymentMethod } from '@/components/StripePaymentMethod'

export interface FeaturesStepData {
  features: string[]
  stripePaymentMethodId?: string
}

interface FeaturesStepProps {
  onNext: () => void
  onPrevious: () => void
  onSkip?: () => void
  isFirstStep: boolean
  isLastStep: boolean
  onSave: (data: FeaturesStepData) => void
  initialValue?: FeaturesStepData
}

const AVAILABLE_FEATURES = [
  'CHATBOT',
  'ADVANCED_ANALYTICS',
  'INVENTORY_TRACKING',
  'LOYALTY_PROGRAM',
  'ONLINE_ORDERING',
  'RESERVATIONS',
] as const

// Pricing in MXN (matches backend seed data)
const FEATURE_PRICING: Record<string, number> = {
  CHATBOT: 399,
  ADVANCED_ANALYTICS: 499,
  INVENTORY_TRACKING: 299,
  LOYALTY_PROGRAM: 599,
  ONLINE_ORDERING: 799,
  RESERVATIONS: 399,
}

export function FeaturesStep({ onNext, onPrevious, onSkip, isFirstStep, onSave, initialValue }: FeaturesStepProps) {
  const { t } = useTranslation('onboarding')
  const { t: tCommon } = useTranslation('common')

  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(initialValue?.features || [])

  // Calculate total monthly cost
  const totalMonthlyCost = selectedFeatures.reduce((sum, feature) => sum + (FEATURE_PRICING[feature] || 0), 0)

  const handleToggleFeature = (feature: string) => {
    setSelectedFeatures(prev => (prev.includes(feature) ? prev.filter(f => f !== feature) : [...prev, feature]))
  }

  const handlePaymentMethodCreated = (paymentMethodId: string) => {
    // Save features and payment method, then proceed
    onSave({
      features: selectedFeatures,
      stripePaymentMethodId: paymentMethodId,
    })
    onNext()
  }

  const handleContinue = () => {
    // If no features selected, just continue
    onSave({ features: selectedFeatures })
    onNext()
  }

  const handleSkip = () => {
    onSave({ features: [] })
    if (onSkip) {
      onSkip()
    } else {
      onNext()
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground">{t('features.title')}</h2>
        <p className="mt-2 text-muted-foreground">{t('features.subtitle')}</p>
      </div>

      {/* Features Card */}
      <Card>
        <CardContent className="pt-6">
          <p className="mb-4 text-sm text-muted-foreground">{t('features.description')}</p>

          <div className="space-y-3">
            {AVAILABLE_FEATURES.map(feature => {
              const price = FEATURE_PRICING[feature]
              return (
                <div
                  key={feature}
                  className={`flex items-start space-x-3 rounded-lg border p-4 transition-colors ${
                    selectedFeatures.includes(feature)
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-background hover:border-primary/50 hover:bg-muted/50'
                  }`}
                >
                  <Checkbox
                    id={feature}
                    checked={selectedFeatures.includes(feature)}
                    onCheckedChange={() => handleToggleFeature(feature)}
                    className="mt-0.5"
                  />
                  <label htmlFor={feature} className="flex-1 cursor-pointer space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{t(`features.available.${feature}.name`)}</span>
                        <Badge variant="secondary" className="text-xs">
                          5 días gratis
                        </Badge>
                      </div>
                      <span className="text-sm font-semibold text-foreground">${price.toLocaleString()} MXN/mes</span>
                    </div>
                    <div className="text-sm text-muted-foreground">{t(`features.available.${feature}.description`)}</div>
                  </label>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Pricing Summary */}
      {selectedFeatures.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Total mensual después del trial</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedFeatures.length} feature{selectedFeatures.length !== 1 ? 's' : ''} seleccionado
                  {selectedFeatures.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-foreground">${totalMonthlyCost.toLocaleString()} MXN</p>
                <p className="text-xs text-muted-foreground">por mes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stripe Payment Method - Show when features are selected */}
      {selectedFeatures.length > 0 && (
        <div className="space-y-4">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-foreground">Método de pago</h3>
            <p className="mt-1 text-sm text-muted-foreground">Ingresa tu tarjeta para comenzar el trial gratuito de 5 días</p>
          </div>
          <StripePaymentMethod onPaymentMethodCreated={handlePaymentMethodCreated} buttonText="Comenzar trial gratuito" />
        </div>
      )}

      {/* Skip Info - Only show when no features selected */}
      {selectedFeatures.length === 0 && (
        <Card className="border-muted bg-muted/30">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">{t('features.actions.skip')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('features.actions.skipDescription')}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation buttons - Only show when no features selected */}
      {selectedFeatures.length === 0 && (
        <div className="flex justify-between pt-4">
          {!isFirstStep && (
            <Button type="button" variant="outline" onClick={onPrevious}>
              {tCommon('previous')}
            </Button>
          )}
          <div className={`flex gap-2 ${isFirstStep ? 'ml-auto' : ''}`}>
            <Button type="button" variant="outline" onClick={handleSkip}>
              {tCommon('skip')}
            </Button>
            <Button type="button" onClick={handleContinue}>
              {tCommon('continue')}
            </Button>
          </div>
        </div>
      )}

      {/* Back button when features are selected */}
      {selectedFeatures.length > 0 && !isFirstStep && (
        <div className="flex justify-start pt-4">
          <Button type="button" variant="outline" onClick={onPrevious}>
            {tCommon('previous')}
          </Button>
        </div>
      )}
    </div>
  )
}
