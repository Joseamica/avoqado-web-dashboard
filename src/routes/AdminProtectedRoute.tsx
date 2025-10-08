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
  const { user, isAuthenticated } = useAuth()
  const location = useLocation()
  const { t } = useTranslation()

  // Si no está autenticado, redireccionar al login
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // Verificar roles para diferentes niveles de acceso
  const isAdmin = user.role === StaffRole.ADMIN || user.role === StaffRole.OWNER || user.role === StaffRole.SUPERADMIN
  const isOwner = user.role === StaffRole.OWNER || user.role === StaffRole.SUPERADMIN
  const isSuperAdmin = user.role === StaffRole.SUPERADMIN

  // Si no es admin, mostrar mensaje de acceso denegado
  if (!isAdmin) {
    return (
      <div className="container py-8 mx-auto">
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="w-4 h-4" />
          <AlertTitle>{t('routeProtection.accessDenied')}</AlertTitle>
          <AlertDescription>{t('routeProtection.noAdminPermission')}</AlertDescription>
        </Alert>
        <div className="flex justify-center mt-4">
          <Navigate to="/" replace />
        </div>
      </div>
    )
  }

  // Si se requiere OWNER pero el usuario es solo ADMIN, mostrar mensaje específico
  if (requiredRole === AdminAccessLevel.OWNER && !isOwner) {
    return (
      <div className="p-6 h-screen bg-background">
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="w-4 h-4" />
          <AlertTitle>{t('routeProtection.restrictedAccess')}</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            {t('routeProtection.ownerOnlyMessage')}
          </AlertDescription>
        </Alert>
        <p className="text-muted-foreground text-sm mt-4">{t('routeProtection.contactOwner')}</p>
      </div>
    )
  }

  // Si se requiere SUPERADMIN pero el usuario no es SUPERADMIN, mostrar mensaje específico
  if (requiredRole === AdminAccessLevel.SUPERADMIN && !isSuperAdmin) {
    return (
      <div className="p-6 h-screen bg-background">
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="w-4 h-4" />
          <AlertTitle>{t('routeProtection.restrictedAccess')}</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            {t('routeProtection.superadminOnlyMessage')}
          </AlertDescription>
        </Alert>
        <p className="text-muted-foreground text-sm mt-4">
          {t('routeProtection.contactSuperadmin')}
        </p>
      </div>
    )
  }

  // Si todo está bien, renderizar los componentes hijos
  return <Outlet />
}
