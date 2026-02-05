import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAccess } from '@/hooks/use-access'
import { AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

/**
 * PermissionProtectedRoute - Route guard based on permissions
 *
 * This component checks if the user has the required permissions to access a route.
 * The backend is the SINGLE SOURCE OF TRUTH for permission resolution:
 * - Normal venues: Checks core permissions directly
 * - White-label venues: Backend automatically filters permissions based on feature access
 *
 * Frontend just calls can() - no need to know about white-label features.
 */

interface PermissionProtectedRouteProps {
  permission?: string
  permissions?: string[]
  requireAll?: boolean
  fallbackPath?: string
}

export const PermissionProtectedRoute = ({
  permission,
  permissions,
  requireAll = false,
  fallbackPath,
}: PermissionProtectedRouteProps) => {
  const { can, canAny, canAll, isLoading, role } = useAccess()
  const location = useLocation()
  const { t } = useTranslation()

  // While loading permissions, render outlet to avoid flash of "Access Denied"
  // This is safe because backend will still enforce permissions on API calls
  if (isLoading) {
    return <Outlet />
  }

  // SUPERADMIN always has access
  if (role === 'SUPERADMIN') {
    return <Outlet />
  }

  // Check permissions - backend already handles white-label filtering
  let hasPermission = false

  if (permission) {
    hasPermission = can(permission)
  } else if (permissions) {
    hasPermission = requireAll ? canAll(permissions) : canAny(permissions)
  } else {
    // No permission specified = allow access
    hasPermission = true
  }

  // If user doesn't have permission, show access denied or redirect
  if (!hasPermission) {
    if (fallbackPath) {
      return <Navigate to={fallbackPath} replace state={{ from: location }} />
    }

    // Show access denied page
    return (
      <div className="flex flex-col justify-center items-center p-6 min-h-[60vh]">
        <div className="p-8 w-full max-w-md">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t('routeProtection.accessDenied', 'Access Denied')}</AlertTitle>
            <AlertDescription>
              {t(
                'routeProtection.insufficientPermissions',
                'You do not have permission to access this page. Contact your administrator if you believe this is an error.',
              )}
            </AlertDescription>
          </Alert>
          <div className="mt-6 flex justify-center">
            <Button variant="outline" onClick={() => window.history.back()}>
              {t('common:goBack', 'Go Back')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return <Outlet />
}
