import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowRight, ArrowLeft, Sparkles, Paintbrush } from 'lucide-react'
import { OnboardingStepProps } from '../OnboardingWizard'
import { cn } from '@/lib/utils'

export type OnboardingType = 'demo' | 'manual'

interface OnboardingTypeStepProps extends OnboardingStepProps {
  onSelect: (type: OnboardingType) => void
  initialValue?: OnboardingType
}

export function OnboardingTypeStep({ onNext, onPrevious, isFirstStep, onSelect, initialValue }: OnboardingTypeStepProps) {
  const { t } = useTranslation('onboarding')
  const { t: tCommon } = useTranslation('common')
  const [selectedType, setSelectedType] = useState<OnboardingType | null>(initialValue || null)

  const handleSelect = (type: OnboardingType) => {
    setSelectedType(type)
  }

  const handleContinue = () => {
    if (selectedType) {
      onSelect(selectedType)
      onNext()
    }
  }

  const options = [
    {
      type: 'demo' as OnboardingType,
      icon: Sparkles,
      iconColor: 'text-purple-500',
      bgColor: 'bg-purple-50 dark:bg-purple-950/20',
      borderColor: 'border-purple-200 dark:border-purple-800',
      title: t('onboardingType.demo.title'),
      description: t('onboardingType.demo.description'),
      features: [
        t('onboardingType.demo.features.preConfigured'),
        t('onboardingType.demo.features.sampleMenu'),
        t('onboardingType.demo.features.quickStart'),
      ],
      badge: t('onboardingType.demo.badge'),
      badgeColor: 'bg-purple-500 text-foreground',
    },
    {
      type: 'manual' as OnboardingType,
      icon: Paintbrush,
      iconColor: 'text-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-950/20',
      borderColor: 'border-blue-200 dark:border-blue-800',
      title: t('onboardingType.manual.title'),
      description: t('onboardingType.manual.description'),
      features: [
        t('onboardingType.manual.features.fullControl'),
        t('onboardingType.manual.features.customSetup'),
        t('onboardingType.manual.features.yourWay'),
      ],
      badge: null,
      badgeColor: '',
    },
  ]

  return (
    <div className="mx-auto max-w-4xl">
      {/* Intro text */}
      <div className="mb-8 text-center">
        <h2 className="mb-2 text-2xl font-bold md:text-3xl">{t('onboardingType.title')}</h2>
        <p className="text-muted-foreground text-lg">{t('onboardingType.subtitle')}</p>
      </div>

      {/* Options grid */}
      <div className="mb-8 grid gap-6 md:grid-cols-2 md:items-stretch">
        {options.map(option => {
          const Icon = option.icon
          const isSelected = selectedType === option.type

          return (
            <Card
              key={option.type}
              className={cn(
                'relative flex cursor-pointer transition-all hover:shadow-lg',
                isSelected && 'ring-2 ring-primary shadow-lg',
                !isSelected && 'hover:border-primary/50',
              )}
              onClick={() => handleSelect(option.type)}
            >
              <CardContent className="flex w-full flex-col pt-6">
                {/* Selection indicator - absolute top-left */}
                {isSelected && (
                  <div className="absolute left-4 top-4 flex items-center gap-2 text-xs font-medium text-primary">
                    <div className="bg-primary h-2 w-2 rounded-full" />
                    {t('onboardingType.selected')}
                  </div>
                )}

                {/* Badge (solo para demo) */}
                {option.badge && (
                  <div className="absolute top-4 right-4">
                    <span className={cn('rounded-full px-3 py-1 text-xs font-semibold', option.badgeColor)}>{option.badge}</span>
                  </div>
                )}

                {/* Icon */}
                <div className={cn('mb-4 flex h-16 w-16 items-center justify-center rounded-lg', option.bgColor)}>
                  <Icon className={cn('h-8 w-8', option.iconColor)} />
                </div>

                {/* Title and description */}
                <h3 className="mb-2 text-xl font-semibold">{option.title}</h3>
                <p className="text-muted-foreground mb-4 text-sm">{option.description}</p>

                {/* Features list */}
                <ul className="space-y-2">
                  {option.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <span className="text-primary shrink-0 text-lg leading-[1.2]">•</span>
                      <span className="leading-[1.4]">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Help text */}
      <div className="bg-muted mb-8 rounded-lg p-4 text-center">
        <p className="text-muted-foreground text-sm">{t('onboardingType.helpText')}</p>
      </div>

      {/* Action buttons */}
      <div className="flex justify-between gap-4">
        <Button variant="outline" onClick={onPrevious} disabled={isFirstStep}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {tCommon('previous')}
        </Button>
        <Button onClick={handleContinue} disabled={!selectedType} className="min-w-[200px]">
          {tCommon('continue')}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
