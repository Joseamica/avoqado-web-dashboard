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
    <div className="mx-auto max-w-3xl">
      {/* Welcome message */}
      <div className="mb-8 text-center">
        <h2 className="mb-2 text-3xl font-bold md:text-4xl">
          {t('welcome.greeting', { name: user?.firstName || tCommon('there') })}
        </h2>
        <p className="text-muted-foreground text-lg">{t('welcome.subtitle')}</p>
      </div>

      {/* What we'll setup */}
      <Card className="mb-8">
        <CardContent className="pt-6">
          <h3 className="mb-4 text-xl font-semibold">{t('welcome.whatWeWillSetup')}</h3>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <Check className="text-primary mt-0.5 h-5 w-5 flex-shrink-0" />
              <span>{t('welcome.setupItems.venueInfo')}</span>
            </li>
            <li className="flex items-start gap-3">
              <Check className="text-primary mt-0.5 h-5 w-5 flex-shrink-0" />
              <span>{t('welcome.setupItems.menu')}</span>
            </li>
            <li className="flex items-start gap-3">
              <Check className="text-primary mt-0.5 h-5 w-5 flex-shrink-0" />
              <span>{t('welcome.setupItems.payment')}</span>
            </li>
            <li className="flex items-start gap-3">
              <Check className="text-primary mt-0.5 h-5 w-5 flex-shrink-0" />
              <span>{t('welcome.setupItems.team')}</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Key features grid */}
      <div className="mb-8">
        <h3 className="mb-4 text-center text-xl font-semibold">{t('welcome.keyFeatures')}</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {features.map((feature, index) => (
            <Card key={index}>
              <CardContent className="pt-6">
                <div className="mb-2 text-3xl">{feature.icon}</div>
                <h4 className="mb-1 font-semibold">{feature.title}</h4>
                <p className="text-muted-foreground text-sm">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Time estimate */}
      <div className="bg-muted mb-8 rounded-lg p-4 text-center">
        <p className="text-muted-foreground text-sm">{t('welcome.timeEstimate')}</p>
      </div>

      {/* Action buttons */}
      <div className="flex justify-center gap-4">
        <Button size="lg" onClick={onNext} className="min-w-[200px]">
          {isLastStep ? tCommon('finish') : tCommon('getStarted')}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
