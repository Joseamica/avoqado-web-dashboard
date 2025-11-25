import { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ThemeToggle } from '@/components/theme-toggle'
import LanguageSwitcher from '@/components/language-switcher'
import { StepIndicator } from './StepIndicator'
import { useTheme } from '@/context/ThemeContext'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'
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
  const { logout } = useAuth()
  const logoSrc = isDark ? logoDark : logoLight

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header with logo and controls - responsive padding */}
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-3 py-3 sm:px-4 sm:py-4">
          <div className="flex items-center gap-2">
            <img src={logoSrc} alt={t('shared.logoAlt')} className="h-6 w-auto sm:h-8" />
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Logout button - Stripe/Shopify pattern: discrete but accessible */}
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('common:logout')}</span>
            </Button>
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main content area - responsive spacing and max-width */}
      <main className="flex flex-1 flex-col overflow-x-hidden">
        <div className="container mx-auto w-full max-w-5xl px-3 py-4 sm:px-4 sm:py-6 md:py-8">
          {/* Progress indicator - responsive spacing */}
          <div className="mb-4 sm:mb-6 md:mb-8">
            <StepIndicator currentStep={currentStep} totalSteps={totalSteps} />
            <div className="mt-3 sm:mt-4 text-center px-2">
              <p className="text-muted-foreground text-xs sm:text-sm">
                {t('stepProgress', { current: currentStep, total: totalSteps })}
              </p>
              <h1 className="mt-1 sm:mt-2 text-xl font-bold sm:text-2xl md:text-3xl lg:text-4xl">{stepTitle}</h1>
            </div>
          </div>

          {/* Step content - ensure it doesn't overflow */}
          <div className="flex-1 w-full">{children}</div>
        </div>
      </main>

      {/* Footer - responsive padding */}
      <footer className="border-t py-4 sm:py-6">
        <div className="container mx-auto px-3 sm:px-4 text-center">
          <p className="text-muted-foreground text-xs sm:text-sm">
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
