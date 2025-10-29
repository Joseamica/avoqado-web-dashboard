import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Check, ArrowRight } from 'lucide-react'
import { OnboardingStepProps } from '../OnboardingWizard'
import { useAuth } from '@/context/AuthContext'

export function WelcomeStep({ onNext, isLastStep }: OnboardingStepProps) {
  const { t } = useTranslation('onboarding')
  const { t: tCommon } = useTranslation('common')
  const { user } = useAuth()

  const features = [
    {
      icon: '💳',
      title: t('welcome.features.smartPOS.title'),
      description: t('welcome.features.smartPOS.description'),
    },
    {
      icon: '🔄',
      title: t('welcome.features.reconciliation.title'),
      description: t('welcome.features.reconciliation.description'),
    },
    {
      icon: '🧠',
      title: t('welcome.features.smartRouting.title'),
      description: t('welcome.features.smartRouting.description'),
    },
    {
      icon: '💵',
      title: t('welcome.features.competitivePricing.title'),
      description: t('welcome.features.competitivePricing.description'),
    },
    {
      icon: '📦',
      title: t('welcome.features.inventory.title'),
      description: t('welcome.features.inventory.description'),
    },
    {
      icon: '🤖',
      title: t('welcome.features.chatbot.title'),
      description: t('welcome.features.chatbot.description'),
    },
    {
      icon: '🔌',
      title: t('welcome.features.posIntegrations.title'),
      description: t('welcome.features.posIntegrations.description'),
    },
    {
      icon: '💰',
      title: t('welcome.features.automaticTips.title'),
      description: t('welcome.features.automaticTips.description'),
    },
  ]

  return (
    <div className="mx-auto max-w-3xl space-y-6 sm:space-y-8">
      {/* Welcome message - responsive text sizes */}
      <div className="text-center px-4 sm:px-0">
        <h2 className="mb-2 text-2xl font-bold sm:text-3xl md:text-4xl lg:text-5xl">
          {t('welcome.greeting', { name: user?.firstName || tCommon('there') })}
        </h2>
        <p className="text-muted-foreground text-base sm:text-lg md:text-xl">{t('welcome.subtitle')}</p>
      </div>

      {/* What we'll setup - better mobile padding */}
      <Card>
        <CardContent className="pt-4 sm:pt-6">
          <h3 className="mb-3 sm:mb-4 text-lg sm:text-xl font-semibold">{t('welcome.whatWeWillSetup')}</h3>
          <ul className="space-y-2 sm:space-y-3">
            <li className="flex items-start gap-2 sm:gap-3">
              <Check className="text-primary mt-0.5 h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
              <span className="text-sm sm:text-base">{t('welcome.setupItems.venueInfo')}</span>
            </li>
            <li className="flex items-start gap-2 sm:gap-3">
              <Check className="text-primary mt-0.5 h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
              <span className="text-sm sm:text-base">{t('welcome.setupItems.menu')}</span>
            </li>
            <li className="flex items-start gap-2 sm:gap-3">
              <Check className="text-primary mt-0.5 h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
              <span className="text-sm sm:text-base">{t('welcome.setupItems.payment')}</span>
            </li>
            <li className="flex items-start gap-2 sm:gap-3">
              <Check className="text-primary mt-0.5 h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
              <span className="text-sm sm:text-base">{t('welcome.setupItems.team')}</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Key features grid - progressive responsive columns */}
      <div>
        <h3 className="mb-3 sm:mb-4 text-center text-lg sm:text-xl font-semibold">{t('welcome.keyFeatures')}</h3>
        <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
          {features.map((feature, index) => (
            <Card key={index} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-4 sm:pt-6">
                <div className="mb-2 text-2xl sm:text-3xl">{feature.icon}</div>
                <h4 className="mb-1 font-semibold text-sm sm:text-base">{feature.title}</h4>
                <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Time estimate - better mobile padding */}
      <div className="bg-muted rounded-lg p-3 sm:p-4 text-center">
        <p className="text-muted-foreground text-xs sm:text-sm">{t('welcome.timeEstimate')}</p>
      </div>

      {/* Action buttons - responsive width */}
      <div className="flex justify-center gap-4">
        <Button size="lg" onClick={onNext} className="w-full sm:w-auto sm:min-w-[200px]">
          {isLastStep ? tCommon('finish') : tCommon('getStarted')}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
