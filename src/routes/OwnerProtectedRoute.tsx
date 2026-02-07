import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { StaffRole } from '@/types'
import { useTranslation } from 'react-i18next'

/**
 * Protected route for organization-level pages.
 *
 * Only allows access to:
 * - SUPERADMIN (can access any organization)
 * - OWNER (can only access organizations where they have a venue with OWNER role)
 *
 * Validates that:
 * 1. User is authenticated
 * 2. User has OWNER or SUPERADMIN role
 * 3. For OWNER: user has a venue with OWNER role in the requested organization
 */
export const OwnerProtectedRoute = () => {
  const { user, isAuthenticated, allVenues, isLoading } = useAuth()
  const location = useLocation()
  const params = useParams<{ orgId?: string; orgSlug?: string }>()
  const { t } = useTranslation('organization')

  // Wait for auth to fully load before making permission decisions
  // This prevents redirects based on empty allVenues during initial load
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  // If not authenticated, redirect to login with returnTo to preserve the route
  if (!isAuthenticated || !user) {
    const returnTo = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />
  }

  const isSuperAdmin = user.role === StaffRole.SUPERADMIN
  const isOwner = user.role === StaffRole.OWNER

  // Must be OWNER or SUPERADMIN
  if (!isOwner && !isSuperAdmin) {
    return (
      <div className="container py-8 mx-auto">
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="w-4 h-4" />
          <AlertTitle>{t('routeProtection.accessDenied')}</AlertTitle>
          <AlertDescription>{t('routeProtection.ownerOnlyMessage')}</AlertDescription>
        </Alert>
        <div className="flex justify-center mt-4">
          <Navigate to="/" replace />
        </div>
      </div>
    )
  }

  // SUPERADMIN can access any organization
  if (isSuperAdmin) {
    return <Outlet />
  }

  const isWhiteLabelOrgRoute = location.pathname.startsWith('/wl/organizations/')
  const requestedOrgIdentifier = params.orgSlug || params.orgId

  const matchesRequestedOrganization = (venue: (typeof allVenues)[number], orgIdentifier: string) => {
    if (venue.organizationId === orgIdentifier) return true
    if (venue.organization?.id === orgIdentifier) return true

    const orgWithSlug = venue.organization as (typeof venue.organization & { slug?: string }) | undefined
    return orgWithSlug?.slug === orgIdentifier
  }

  const ownerVenue = allVenues.find(v => v.role === StaffRole.OWNER)
  const ownerOrgSlug = ownerVenue
    ? ((ownerVenue.organization as (typeof ownerVenue.organization & { slug?: string }) | undefined)?.slug ?? null)
    : null
  const fallbackOrgIdentifier = ownerVenue
    ? (isWhiteLabelOrgRoute ? (ownerOrgSlug || ownerVenue.organizationId) : ownerVenue.organizationId)
    : null
  const fallbackPath = fallbackOrgIdentifier
    ? (isWhiteLabelOrgRoute ? `/wl/organizations/${fallbackOrgIdentifier}` : `/organizations/${fallbackOrgIdentifier}`)
    : '/'

  // Check if user has a venue with OWNER role in the requested organization
  const isOwnerInRequestedOrg = allVenues.some(
    venue =>
      venue.role === StaffRole.OWNER &&
      !!requestedOrgIdentifier &&
      matchesRequestedOrganization(venue, requestedOrgIdentifier)
  )

  if (requestedOrgIdentifier && !isOwnerInRequestedOrg) {
    return (
      <div className="container py-8 mx-auto">
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="w-4 h-4" />
          <AlertTitle>{t('routeProtection.accessDenied')}</AlertTitle>
          <AlertDescription>{t('notYourOrganization')}</AlertDescription>
        </Alert>
        <div className="flex justify-center mt-4">
          {fallbackOrgIdentifier ? (
            <Navigate to={fallbackPath} replace />
          ) : (
            <Navigate to="/" replace />
          )}
        </div>
      </div>
    )
  }

  // If no organization identifier in URL, redirect to user's first OWNER organization
  if (!requestedOrgIdentifier) {
    if (fallbackOrgIdentifier) {
      return <Navigate to={fallbackPath} replace />
    }
  }

  // All checks passed, render children
  return <Outlet />
}
