import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { OnboardingStepProps } from '../OnboardingWizard'

export interface FeaturesStepData {
  features: string[]
}

interface FeaturesStepProps extends OnboardingStepProps {
  onSave: (data: FeaturesStepData) => void
  initialValue?: FeaturesStepData
}

const AVAILABLE_FEATURES = ['CHATBOT', 'ADVANCED_ANALYTICS', 'INVENTORY_TRACKING', 'LOYALTY_PROGRAM', 'ONLINE_ORDERING', 'RESERVATIONS'] as const

export function FeaturesStep({ onNext, onPrevious, onSkip, isFirstStep, onSave, initialValue }: FeaturesStepProps) {
  const { t } = useTranslation('onboarding')
  const { t: tCommon } = useTranslation('common')

  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(initialValue?.features || [])

  const handleToggleFeature = (feature: string) => {
    setSelectedFeatures(prev => (prev.includes(feature) ? prev.filter(f => f !== feature) : [...prev, feature]))
  }

  const handleContinue = () => {
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
            {AVAILABLE_FEATURES.map(feature => (
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
                  <div className="font-medium text-foreground">{t(`features.available.${feature}.name`)}</div>
                  <div className="text-sm text-muted-foreground">{t(`features.available.${feature}.description`)}</div>
                </label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Skip Info */}
      <Card className="border-muted bg-muted/30">
        <CardContent className="pt-6">
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">{t('features.actions.skip')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t('features.actions.skipDescription')}</p>
          </div>
        </CardContent>
      </Card>

      {/* Navigation buttons */}
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
    </div>
  )
}
