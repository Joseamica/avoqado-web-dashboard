import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Sparkles, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConversionWizard } from './ConversionWizard'
import { useCurrentVenue } from '@/hooks/use-current-venue'

export function DemoBanner() {
  const { t } = useTranslation() // Uses default namespace (translation = common.json)
  const [isDismissed, setIsDismissed] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)
  const { venue } = useCurrentVenue()

  const handleConvert = () => {
    setWizardOpen(true)
  }

  if (isDismissed) {
    return null
  }

  return (
    <>
      <ConversionWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        venueId={venue?.id || ''}
        venueSlug={venue?.slug || ''}
        venueName={venue?.name || ''}
        venue={venue}
      />

      <div className="relative w-full animate-in slide-in-from-top duration-500">
        {/* Main banner container */}
        <div className="mx-4 mt-4 mb-2 rounded-xl shadow-lg overflow-hidden">
          {/* Gradient background - theme-aware */}
          <div className="bg-linear-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-700 dark:via-purple-700 dark:to-pink-700 p-0.5">
            <div className="bg-background rounded-[10px] px-6 py-4">
              <div className="flex items-center justify-between gap-4">
                {/* Left side: Icon + Message */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  {/* Sparkles icon with gradient */}
                  <div className="shrink-0">
                    <div className="relative">
                      <div className="absolute inset-0 bg-linear-to-r from-blue-500 to-purple-500 rounded-full blur-lg opacity-50"></div>
                      <div className="relative bg-linear-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-500 dark:via-purple-500 dark:to-pink-500 p-3 rounded-full">
                        <Sparkles className="h-6 w-6 text-foreground animate-pulse" />
                      </div>
                    </div>
                  </div>

                  {/* Text content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-foreground mb-1">{t('demoBanner.title')}</h3>
                    <p className="text-sm text-muted-foreground">{t('demoBanner.description')}</p>
                  </div>
                </div>

                {/* Right side: CTA Button + Close Button */}
                <div className="flex items-center gap-3 shrink-0">
                  {/* Convert button with gradient */}
                  <Button
                    onClick={handleConvert}
                    className="bg-linear-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-primary-foreground font-semibold shadow-md hover:shadow-xl transition-all duration-300 group"
                  >
                    {t('demoBanner.convertButton')}
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
                  </Button>

                  {/* Dismiss button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsDismissed(true)}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    aria-label={t('demoBanner.dismissButton')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
