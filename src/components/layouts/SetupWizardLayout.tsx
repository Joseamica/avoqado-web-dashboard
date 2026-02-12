import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import LanguageSwitcher from '@/components/language-switcher'

interface SetupWizardLayoutProps {
  children: React.ReactNode
  /** Show back arrow + handle navigation */
  onBack?: () => void
  /** "Terminar mas tarde" handler — hidden on step 1 (signup) */
  onFinishLater?: () => void
  /** Show the "Next" / primary action button in the header */
  primaryAction?: {
    label: string
    onClick: () => void
    disabled?: boolean
    loading?: boolean
  }
  /** Hide finish later (e.g., on signup step) */
  hideFinishLater?: boolean
}

export function SetupWizardLayout({
  children,
  onBack,
  onFinishLater,
  primaryAction,
  hideFinishLater = false,
}: SetupWizardLayoutProps) {
  const { t } = useTranslation('setup')

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={t('wizard.back')}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <img
            src="/avoqado-logo.svg"
            alt="Avoqado"
            className="h-7 dark:invert"
            onError={(e) => {
              // Fallback if logo doesn't exist
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
          {!hideFinishLater && onFinishLater && (
            <Button variant="ghost" size="sm" onClick={onFinishLater} className="hidden sm:flex">
              {t('wizard.finishLater')}
            </Button>
          )}
          {primaryAction && (
            <Button
              size="sm"
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled || primaryAction.loading}
            >
              {primaryAction.loading && (
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              )}
              {primaryAction.label}
            </Button>
          )}
        </div>
      </header>

      {/* Mobile "finish later" button */}
      {!hideFinishLater && onFinishLater && (
        <div className="flex justify-center border-b border-border px-4 py-2 sm:hidden">
          <Button variant="ghost" size="sm" onClick={onFinishLater} className="text-xs">
            {t('wizard.finishLater')}
          </Button>
        </div>
      )}

      {/* Content — centered with generous whitespace */}
      <main className="flex flex-1 justify-center px-4 pt-8 pb-16 sm:pt-16 md:pt-20">
        <div className="w-full max-w-[640px]">{children}</div>
      </main>
    </div>
  )
}
