import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { AlertCircle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { StaffRole } from '@/types'
import { useTranslation } from 'react-i18next'

type ManagerProtectedRouteProps = {
  allowViewer?: boolean // Special case: Allow VIEWER role (for Analytics)
}

/**
 * ManagerProtectedRoute - Protects routes that require MANAGER level or higher
 *
 * Access hierarchy:
 * - MANAGER ✓
 * - ADMIN ✓
 * - OWNER ✓
 * - SUPERADMIN ✓
 * - VIEWER ✓ (only if allowViewer=true)
 *
 * Blocked: WAITER, CASHIER, KITCHEN, HOST, VIEWER (unless allowViewer=true)
 */
export const ManagerProtectedRoute = ({ allowViewer = false }: ManagerProtectedRouteProps) => {
  const { user, isAuthenticated } = useAuth()
  const location = useLocation()
  const { t } = useTranslation()

  // If not authenticated, redirect to login with returnTo to preserve the route
  if (!isAuthenticated || !user) {
    const returnTo = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />
  }

  // Check if user has MANAGER level or higher
  const isManager =
    user.role === StaffRole.MANAGER ||
    user.role === StaffRole.ADMIN ||
    user.role === StaffRole.OWNER ||
    user.role === StaffRole.SUPERADMIN

  // Special case: Allow VIEWER if explicitly enabled
  const isViewer = user.role === StaffRole.VIEWER

  const hasAccess = isManager || (allowViewer && isViewer)

  // If no access, show access denied message
  if (!hasAccess) {
    const errorMessage = allowViewer
      ? t('routeProtection.managerOrViewerOnlyMessage', {
          defaultValue: 'This section requires Manager level access or Viewer role.',
        })
      : t('routeProtection.managerOnlyMessage', {
          defaultValue: 'This section requires Manager level access or higher.',
        })

    return (
      <div className="container py-8 mx-auto">
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="w-4 h-4" />
          <AlertTitle>{t('routeProtection.accessDenied')}</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
        <div className="flex justify-center mt-4">
          <Navigate to="/" replace />
        </div>
      </div>
    )
  }

  // If everything is okay, render child components
  return <Outlet />
}
