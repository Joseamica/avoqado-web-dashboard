import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Sparkles, ArrowRight, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConversionWizard } from './ConversionWizard'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useAuth } from '@/context/AuthContext'
import { StaffRole, VenueStatus } from '@/types'
import { salesWhatsAppLink } from '@/config/plan-catalog'

/** Production signup — the public live demo drives anonymous visitors here. */
const SIGNUP_URL = 'https://dashboard.avoqado.io/signup'

/** Fire a conversion signal to GTM/GA (no-op if dataLayer absent). */
function trackDemoConversion(action: 'signup' | 'sales') {
  try {
    const w = window as unknown as { dataLayer?: Record<string, unknown>[] }
    w.dataLayer = w.dataLayer || []
    w.dataLayer.push({ event: 'demo_convert_click', demo_convert_action: action, location: 'demo_dashboard_banner' })
  } catch {
    /* analytics must never break the banner */
  }
}

export function DemoBanner() {
  const { t } = useTranslation() // Uses default namespace (translation = common.json)
  const [isDismissed, setIsDismissed] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)
  const { venue } = useCurrentVenue()
  const { allVenues } = useAuth()

  // Public live demo (anonymous visitor, ephemeral LIVE_DEMO venue): "convert"
  // means CREATE A REAL ACCOUNT, not convert this throwaway venue. The
  // ConversionWizard / convert-from-demo flow assumes a real authenticated
  // owner — only valid for TRIAL onboarding venues.
  const isPublicLiveDemo = venue?.status === VenueStatus.LIVE_DEMO

  // Get the ACTUAL role for this venue from allVenues (reliable source)
  // This avoids race condition where staffInfo.role might be a fallback value
  const actualVenueRole = venue?.id
    ? allVenues.find(v => v.id === venue.id)?.role
    : null

  // Only show banner to users who can convert (ADMIN and above)
  // IMPORTANT: Use actualVenueRole from allVenues, not staffInfo.role which may be stale
  const canConvert = actualVenueRole && [
    StaffRole.SUPERADMIN,
    StaffRole.OWNER,
    StaffRole.ADMIN,
  ].includes(actualVenueRole as StaffRole)

  const handleConvert = () => {
    setWizardOpen(true)
  }

  // Don't show to users without convert permission or if dismissed
  if (!canConvert || isDismissed) {
    return null
  }

  const title = isPublicLiveDemo ? t('demoBanner.liveDemo.title') : t('demoBanner.title')
  const description = isPublicLiveDemo ? t('demoBanner.liveDemo.description') : t('demoBanner.description')

  return (
    <>
      {/* The convert-from-demo wizard only applies to TRIAL onboarding venues. */}
      {!isPublicLiveDemo && (
        <ConversionWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          venueId={venue?.id || ''}
          venueSlug={venue?.slug || ''}
          venueName={venue?.name || ''}
          venue={venue}
        />
      )}

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
                    <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
                    <p className="text-sm text-muted-foreground">{description}</p>
                  </div>
                </div>

                {/* Right side: CTA Button(s) + Close Button */}
                <div className="flex items-center gap-3 shrink-0">
                  {isPublicLiveDemo ? (
                    <>
                      {/* Public demo: drive to real signup + sales WhatsApp */}
                      <Button
                        variant="ghost"
                        onClick={() => {
                          trackDemoConversion('sales')
                          window.open(
                            salesWhatsAppLink('Hola, probé el demo de Avoqado y quiero saber más / crear mi cuenta.'),
                            '_blank',
                            'noopener,noreferrer',
                          )
                        }}
                        className="hidden sm:inline-flex gap-2 text-muted-foreground hover:text-foreground"
                      >
                        <MessageCircle className="h-4 w-4" />
                        {t('demoBanner.liveDemo.salesButton')}
                      </Button>
                      <Button
                        onClick={() => {
                          trackDemoConversion('signup')
                          window.open(SIGNUP_URL, '_blank', 'noopener,noreferrer')
                        }}
                        className="bg-linear-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-primary-foreground font-semibold shadow-md hover:shadow-xl transition-all duration-300 group"
                      >
                        {t('demoBanner.liveDemo.signupButton')}
                        <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
                      </Button>
                    </>
                  ) : (
                    // Onboarding TRIAL venue: convert this venue to a real one
                    <Button
                      onClick={handleConvert}
                      className="bg-linear-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-primary-foreground font-semibold shadow-md hover:shadow-xl transition-all duration-300 group"
                    >
                      {t('demoBanner.convertButton')}
                      <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
                    </Button>
                  )}

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
