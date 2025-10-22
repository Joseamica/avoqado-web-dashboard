import { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ThemeToggle } from '@/components/theme-toggle'
import LanguageSwitcher from '@/components/language-switcher'
import { StepIndicator } from './StepIndicator'
import { useTheme } from '@/context/ThemeContext'
import logoLight from '@/assets/logo/avoqado-logo-light.png'
import logoDark from '@/assets/logo/avoqado-logo-dark.png'

interface OnboardingLayoutProps {
  children: ReactNode
  currentStep: number
  totalSteps: number
  stepTitle: string
}

export function OnboardingLayout({ children, currentStep, totalSteps, stepTitle }: OnboardingLayoutProps) {
  const { t } = useTranslation('onboarding')
  const { isDark } = useTheme()
  const logoSrc = isDark ? logoDark : logoLight

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header with logo and controls */}
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <img src={logoSrc} alt="Avoqado" className="h-8 w-auto" />
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main content area */}
      <main className="flex flex-1 flex-col">
        <div className="container mx-auto max-w-4xl px-4 py-8">
          {/* Progress indicator */}
          <div className="mb-8">
            <StepIndicator currentStep={currentStep} totalSteps={totalSteps} />
            <div className="mt-4 text-center">
              <p className="text-muted-foreground text-sm">{t('stepProgress', { current: currentStep, total: totalSteps })}</p>
              <h1 className="mt-2 text-2xl font-bold md:text-3xl">{stepTitle}</h1>
            </div>
          </div>

          {/* Step content */}
          <div className="flex-1">{children}</div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground text-sm">
            {t('footer.needHelp')}{' '}
            <a href="mailto:hola@avoqado.com" className="text-primary hover:underline">
              {t('footer.contactSupport')}
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}
