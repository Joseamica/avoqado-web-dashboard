import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import { StaffRole } from '@/types'
import { LogOut } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export const SuperProtectedRoute = ({ allowedRoles }: { allowedRoles?: StaffRole[] }) => {
  const { user, isAuthenticated, logout } = useAuth()
  const location = useLocation()
  const { t } = useTranslation()

  if (!isAuthenticated || !user) {
    const returnTo = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />
  }

  // Si el usuario no tiene el rol requerido, mostrar un mensaje de error dentro del layout
  // Nota: para compatibilidad con código antiguo, convertimos el rol del user a StaffRole si es necesario
  if (allowedRoles && !allowedRoles.includes(user.role as StaffRole)) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center bg-muted rounded-xl">
        <div className="w-full max-w-md p-8 bg-card rounded-lg shadow-lg">
          <h1 className="mb-4 text-2xl font-semibold text-foreground">{t('routeProtection.restrictedAccess')}</h1>
          <p className="mb-6 text-muted-foreground">{t('routeProtection.noPermissionSection')}</p>
          <Button onClick={() => logout()}>
            <LogOut className="mr-2" />
            {t('routeProtection.logout')}
          </Button>
        </div>
      </div>
    )
  }

  return <Outlet />
}
