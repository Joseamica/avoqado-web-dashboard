import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import { StaffRole } from '@/types'
import { LogOut } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export const ProtectedRoute = () => {
  const { user, isAuthenticated, logout } = useAuth() || {}
  const location = useLocation()
  const { t } = useTranslation()

  if (user?.role !== StaffRole.OWNER && user?.role !== StaffRole.SUPERADMIN && isAuthenticated && user?.venues.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center p-6 h-screen text-center bg-background">
        <div className="p-8 w-full max-w-md bg-card rounded-lg shadow-lg">
          <h1 className="mb-4 text-2xl font-semibold text-foreground">{t('routeProtection.noVenuesAssigned')}</h1>
          <p className="mb-6 text-muted-foreground">{t('routeProtection.contactAdminForVenue')}</p>

          <p className="mt-4 mb-4 text-sm text-muted-foreground">
            {t('routeProtection.needHelp')}{' '}
            <a href="/support" className="text-primary underline hover:text-primary/80">
              {t('routeProtection.contactUs')}
            </a>
          </p>
          <Button onClick={() => logout()}>
            <LogOut />
            {t('routeProtection.logout')}
          </Button>
        </div>
      </div>
    )
  }
  if (!user && !isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
