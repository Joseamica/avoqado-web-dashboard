import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { usePermissions } from '@/hooks/usePermissions'
import { AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

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
  const { can, canAny, canAll } = usePermissions()
  const location = useLocation()
  const { t } = useTranslation()

  // Determine if user has required permissions
  let hasPermission = false

  if (permission) {
    hasPermission = can(permission)
  } else if (permissions) {
    hasPermission = requireAll ? canAll(permissions) : canAny(permissions)
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
              {t('common.goBack', 'Go Back')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return <Outlet />
}
