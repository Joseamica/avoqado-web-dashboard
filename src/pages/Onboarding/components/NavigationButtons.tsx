import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

interface NavigationButtonsProps {
  onPrevious?: () => void
  onSkip?: () => void
  onContinue?: () => void
  isFirstStep?: boolean
  showSkip?: boolean
  isLoading?: boolean
  continueDisabled?: boolean
  continueLabel?: string
  formId?: string // For form submission
}

export function NavigationButtons({
  onPrevious,
  onSkip,
  onContinue,
  isFirstStep = false,
  showSkip = false,
  isLoading = false,
  continueDisabled = false,
  continueLabel,
  formId,
}: NavigationButtonsProps) {
  const { t } = useTranslation('common')

  return (
    <>
      {/* Spacer to prevent content from being hidden behind fixed nav */}
      <div className="h-20 sm:h-24" />

      {/* Fixed navigation bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="container mx-auto max-w-5xl px-3 py-3 sm:px-4 sm:py-4">
          <div className="flex items-center justify-between">
            {/* Previous button */}
            <div>
              {!isFirstStep && onPrevious && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onPrevious}
                  disabled={isLoading}
                  className="h-9 px-3 sm:h-10 sm:px-4"
                >
                  {t('previous')}
                </Button>
              )}
            </div>

            {/* Right side buttons */}
            <div className="flex items-center gap-2">
              {showSkip && onSkip && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onSkip}
                  disabled={isLoading}
                  className="h-9 px-3 sm:h-10 sm:px-4"
                >
                  {t('skip')}
                </Button>
              )}
              <Button
                type={formId ? 'submit' : 'button'}
                form={formId}
                onClick={formId ? undefined : onContinue}
                disabled={isLoading || continueDisabled}
                className="h-9 px-4 sm:h-10 sm:px-6"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('loading')}
                  </>
                ) : (
                  continueLabel || t('continue')
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
