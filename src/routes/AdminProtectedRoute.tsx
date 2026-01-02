import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { AlertCircle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { StaffRole } from '@/types'
import { useTranslation } from 'react-i18next'

// eslint-disable-next-line react-refresh/only-export-components
export enum AdminAccessLevel {
  ADMIN = 'ADMIN', // Para roles ADMIN, OWNER y SUPERADMIN
  OWNER = 'OWNER', // Solo para OWNER y SUPERADMIN
  SUPERADMIN = 'SUPERADMIN', // Solo para SUPERADMIN
}

type AdminProtectedRouteProps = {
  requiredRole?: AdminAccessLevel
}

export const AdminProtectedRoute = ({ requiredRole = AdminAccessLevel.ADMIN }: AdminProtectedRouteProps) => {
  const { user, isAuthenticated, staffInfo } = useAuth()
  const location = useLocation()
  const { t } = useTranslation()

  // Si no está autenticado, redireccionar al login
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // Use staffInfo.role which is properly derived from venue-specific role
  // This ensures we check the user's role for the current venue, not just the raw user object
  const userRole = staffInfo?.role || user.role

  // Verificar roles para diferentes niveles de acceso
  const isAdmin = userRole === StaffRole.ADMIN || userRole === StaffRole.OWNER || userRole === StaffRole.SUPERADMIN
  const isOwner = userRole === StaffRole.OWNER || userRole === StaffRole.SUPERADMIN
  const isSuperAdmin = userRole === StaffRole.SUPERADMIN

  // Check access based on required role
  let hasAccess = false
  if (requiredRole === AdminAccessLevel.ADMIN) {
    hasAccess = isAdmin
  } else if (requiredRole === AdminAccessLevel.OWNER) {
    hasAccess = isOwner
  } else if (requiredRole === AdminAccessLevel.SUPERADMIN) {
    hasAccess = isSuperAdmin
  }

  // Si no tiene acceso, mostrar mensaje de acceso denegado
  if (!hasAccess) {
    let errorMessage = t('routeProtection.noAdminPermission')
    if (requiredRole === AdminAccessLevel.OWNER) {
      errorMessage = t('routeProtection.ownerOnlyMessage')
    } else if (requiredRole === AdminAccessLevel.SUPERADMIN) {
      errorMessage = t('routeProtection.superadminOnlyMessage')
    }

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

  // Si todo está bien, renderizar los componentes hijos
  return <Outlet />
}
