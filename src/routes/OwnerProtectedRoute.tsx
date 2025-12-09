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
 * - OWNER (can only access their own organization)
 *
 * Validates that:
 * 1. User is authenticated
 * 2. User has OWNER or SUPERADMIN role
 * 3. For OWNER: the URL orgId matches user's organizationId
 */
export const OwnerProtectedRoute = () => {
  const { user, isAuthenticated } = useAuth()
  const location = useLocation()
  const params = useParams<{ orgId: string }>()
  const { t } = useTranslation('organization')

  // If not authenticated, redirect to login
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />
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

  // For OWNER: validate they're accessing their own organization
  const urlOrgId = params.orgId
  const userOrgId = user.organizationId

  if (isOwner && urlOrgId && urlOrgId !== userOrgId) {
    return (
      <div className="container py-8 mx-auto">
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="w-4 h-4" />
          <AlertTitle>{t('routeProtection.accessDenied')}</AlertTitle>
          <AlertDescription>{t('notYourOrganization')}</AlertDescription>
        </Alert>
        <div className="flex justify-center mt-4">
          <Navigate to={`/organizations/${userOrgId}`} replace />
        </div>
      </div>
    )
  }

  // If no orgId in URL but user has one, redirect to their org
  if (!urlOrgId && userOrgId) {
    return <Navigate to={`/organizations/${userOrgId}`} replace />
  }

  // All checks passed, render children
  return <Outlet />
}
