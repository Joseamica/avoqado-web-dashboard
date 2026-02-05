import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Clock, AlertTriangle, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useAuth } from '@/context/AuthContext'
import { getVenueFeatures, getBillingPortalUrl } from '@/services/features.service'
import { VenueFeature, StaffRole } from '@/types'

interface TrialStatus {
  feature: VenueFeature
  daysRemaining: number
  isUrgent: boolean
  isWarning: boolean
}

export function TrialStatusBanner() {
  const { t } = useTranslation()
  const { venueId, venue } = useCurrentVenue()
  const { staffInfo, allVenues } = useAuth()
  const [isDismissed, setIsDismissed] = useState(false)
  const [features, setFeatures] = useState<VenueFeature[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRedirecting, setIsRedirecting] = useState(false)

  // Get the ACTUAL role for this venue from allVenues (reliable source)
  // This avoids race condition where staffInfo.role might be a fallback value
  const actualVenueRole = venueId
    ? allVenues.find(v => v.id === venueId)?.role
    : null

  // Only fetch features for users with billing access (ADMIN and above)
  // CASHIER, WAITER, KITCHEN, HOST, VIEWER don't need to see trial status
  // IMPORTANT: Use actualVenueRole from allVenues, not staffInfo.role which may be stale
  const canViewBilling = actualVenueRole && [
    StaffRole.SUPERADMIN,
    StaffRole.OWNER,
    StaffRole.ADMIN,
    StaffRole.MANAGER,
  ].includes(actualVenueRole as StaffRole)

  // Fetch venue features on mount
  useEffect(() => {
    if (!venueId || !canViewBilling) {
      setIsLoading(false)
      return
    }

    const fetchFeatures = async () => {
      try {
        const data = await getVenueFeatures(venueId)

        // Ensure data is an array
        if (Array.isArray(data)) {
          setFeatures(data)
        } else {
          setFeatures([])
        }
      } catch (error) {
        console.error('Failed to fetch venue features:', error)
        setFeatures([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchFeatures()
  }, [venueId, canViewBilling])

  // Calculate trial status for each feature with an active trial
  const trialStatuses = useMemo(() => {
    const now = new Date()
    const statuses: TrialStatus[] = []

    // Defensive check: ensure features is an array
    if (!Array.isArray(features)) {
      return []
    }

    for (const feature of features) {
      // Skip if no trial or feature is not active
      if (!feature.endDate || !feature.active) continue

      const trialEnd = new Date(feature.endDate)

      // Skip if trial already ended
      if (trialEnd < now) continue

      // Calculate days remaining
      const msRemaining = trialEnd.getTime() - now.getTime()
      const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24))

      statuses.push({
        feature,
        daysRemaining,
        isUrgent: daysRemaining <= 3,
        isWarning: daysRemaining > 3 && daysRemaining <= 7,
      })
    }

    // Sort by urgency (most urgent first)
    return statuses.sort((a, b) => a.daysRemaining - b.daysRemaining)
  }, [features])

  // Get the most urgent trial
  const mostUrgentTrial = trialStatuses[0]

  // Handle billing portal redirect
  const handleManageBilling = async () => {
    if (!venueId) return

    try {
      setIsRedirecting(true)
      const { url } = await getBillingPortalUrl(venueId)
      window.location.href = url
    } catch (error) {
      console.error('Failed to get billing portal URL:', error)
      setIsRedirecting(false)
    }
  }

  // Don't show banner if:
  // - Still loading
  // - No active trials
  // - Banner was dismissed (and trial is not urgent)
  if (isLoading || !mostUrgentTrial || (isDismissed && !mostUrgentTrial.isUrgent)) {
    return null
  }

  const { feature, daysRemaining, isUrgent, isWarning } = mostUrgentTrial

  // Determine banner color scheme
  const colorScheme = isUrgent
    ? {
        gradient: 'from-red-600 via-orange-600 to-yellow-600 dark:from-red-700 dark:via-orange-700 dark:to-yellow-700',
        icon: <AlertTriangle className="h-6 w-6 text-foreground" />,
        iconBg: 'from-red-600 via-orange-600 to-yellow-600 dark:from-red-500 dark:via-orange-500 dark:to-yellow-500',
      }
    : isWarning
    ? {
        gradient: 'from-orange-600 via-yellow-600 to-amber-600 dark:from-orange-700 dark:via-yellow-700 dark:to-amber-700',
        icon: <Clock className="h-6 w-6 text-foreground" />,
        iconBg: 'from-orange-600 via-yellow-600 to-amber-600 dark:from-orange-500 dark:via-yellow-500 dark:to-amber-500',
      }
    : {
        gradient: 'from-blue-600 via-purple-600 to-indigo-600 dark:from-blue-700 dark:via-purple-700 dark:to-indigo-700',
        icon: <Clock className="h-6 w-6 text-foreground" />,
        iconBg: 'from-blue-600 via-purple-600 to-indigo-600 dark:from-blue-500 dark:via-purple-500 dark:to-indigo-500',
      }

  return (
    <div className="relative w-full animate-in slide-in-from-top duration-500">
      {/* Main banner container */}
      <div className="mx-4 mt-4 mb-2 rounded-xl shadow-lg overflow-hidden">
        {/* Gradient background - theme-aware */}
        <div className={`bg-linear-to-r ${colorScheme.gradient} p-0.5`}>
          <div className="bg-background rounded-[10px] px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              {/* Left side: Icon + Message */}
              <div className="flex items-center gap-4 flex-1 min-w-0">
                {/* Icon with gradient */}
                <div className="shrink-0">
                  <div className="relative">
                    <div className={`absolute inset-0 bg-linear-to-r ${colorScheme.iconBg} rounded-full blur-lg opacity-50`}></div>
                    <div className={`relative bg-linear-to-r ${colorScheme.iconBg} p-3 rounded-full`}>{colorScheme.icon}</div>
                  </div>
                </div>

                {/* Text content */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-foreground mb-1">
                    {isUrgent
                      ? t('trialBanner.urgentTitle', { days: daysRemaining })
                      : isWarning
                      ? t('trialBanner.warningTitle', { days: daysRemaining })
                      : t('trialBanner.normalTitle', { days: daysRemaining })}
                  </h3>
                  <p className="text-sm text-muted-foreground">{t('trialBanner.description', { feature: feature.feature.name })}</p>
                </div>
              </div>

              {/* Right side: CTA Button + Close Button */}
              <div className="flex items-center gap-3 shrink-0">
                {/* Manage billing button */}
                <Button
                  onClick={handleManageBilling}
                  disabled={isRedirecting}
                  className={`bg-linear-to-r ${colorScheme.gradient} hover:opacity-90 text-primary-foreground font-semibold shadow-md hover:shadow-xl transition-all duration-300 group`}
                >
                  {isRedirecting ? (
                    t('trialBanner.redirecting')
                  ) : (
                    <>
                      <CreditCard className="mr-2 h-4 w-4" />
                      {t('trialBanner.manageButton')}
                    </>
                  )}
                </Button>

                {/* Dismiss button - only show for non-urgent trials */}
                {!isUrgent && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsDismissed(true)}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    aria-label={t('trialBanner.dismissButton')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
