import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { AlertCircle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { themeClasses } from '@/lib/theme-utils'

export enum AdminAccessLevel {
  ADMIN = 'ADMIN', // Para roles ADMIN y SUPERADMIN
  SUPERADMIN = 'SUPERADMIN', // Solo para SUPERADMIN
}

type AdminProtectedRouteProps = {
  requiredRole?: AdminAccessLevel
}

export const AdminProtectedRoute = ({ requiredRole = AdminAccessLevel.ADMIN }: AdminProtectedRouteProps) => {
  const { user, isAuthenticated } = useAuth()
  const location = useLocation()

  // Si no está autenticado, redireccionar al login
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // Verificar si es ADMIN o SUPERADMIN (ambos pueden acceder a rutas básicas de admin)
  const isAdmin = user.role === 'ADMIN' || user.role === 'SUPERADMIN'
  const isSuperAdmin = user.role === 'SUPERADMIN'

  // Si no es admin, mostrar mensaje de acceso denegado
  if (!isAdmin) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Acceso denegado</AlertTitle>
          <AlertDescription>No tienes permisos de administrador para acceder a esta página.</AlertDescription>
        </Alert>
        <div className="flex justify-center mt-4">
          <Navigate to="/" replace />
        </div>
      </div>
    )
  }

  // Si se requiere SUPERADMIN pero el usuario es solo ADMIN, mostrar mensaje específico
  if (requiredRole === AdminAccessLevel.SUPERADMIN && !isSuperAdmin) {
    return (
      <div className={`p-6 h-screen ${themeClasses.pageBg}`}>
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Acceso restringido</AlertTitle>
          <AlertDescription className={`${themeClasses.textMuted}`}>
            Esta sección está disponible solo para SuperAdministradores.
          </AlertDescription>
        </Alert>
        <p className={`${themeClasses.textMuted} text-sm mt-4`}>Si necesitas acceso a esta funcionalidad, contacta a un SuperAdmin.</p>
      </div>
    )
  }

  // Si todo está bien, renderizar los componentes hijos
  return <Outlet />
}
