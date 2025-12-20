/**
 * FeatureProtectedRoute - Route guard for feature-gated functionality
 *
 * Wraps routes that require a specific feature to be active in the venue.
 * Redirects to home page with toast notification if feature is not active.
 *
 * Usage:
 * ```tsx
 * <Route element={<FeatureProtectedRoute requiredFeature="ONLINE_ORDERING" />}>
 *   <Route path="orders" element={<Orders />} />
 * </Route>
 * ```
 */

import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

interface FeatureProtectedRouteProps {
  requiredFeature: string
}

export function FeatureProtectedRoute({ requiredFeature }: FeatureProtectedRouteProps) {
  const { checkFeatureAccess, activeVenue } = useAuth()
  const location = useLocation()
  const { slug } = useParams<{ slug: string }>()
  const { toast } = useToast()
  const { t } = useTranslation()

  const hasFeatureAccess = checkFeatureAccess(requiredFeature)

  // Debug logging
  console.log('[FeatureProtectedRoute]', {
    requiredFeature,
    hasFeatureAccess,
    activeVenueFeatures: activeVenue?.features,
    path: location.pathname,
  })

  // Show toast when redirecting due to missing feature
  useEffect(() => {
    if (!hasFeatureAccess && activeVenue) {
      toast({
        title: t('common:feature_not_available'),
        description: t('common:feature_not_available_desc', {
          feature: requiredFeature,
          defaultValue: 'This feature is not available for your venue. Please contact support to activate it.'
        }),
        variant: 'destructive',
      })
    }
  }, [hasFeatureAccess, requiredFeature, activeVenue, toast, t])

  // Redirect to venue home if feature is not active
  if (!hasFeatureAccess) {
    return (
      <Navigate
        to={`/venues/${slug || activeVenue?.slug}/home`}
        replace
        state={{ from: location.pathname }}
      />
    )
  }

  // Feature is active - render nested routes
  return <Outlet />
}
