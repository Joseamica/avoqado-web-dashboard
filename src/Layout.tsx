import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import { LogOut } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export function Layout() {
  const { isAuthenticated, logout, user, isLoading } = useAuth()
  const { t } = useTranslation()

  if (isLoading) {
    return <div>{t('loading')}</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />
  }

  // This component is only used for the root "/" path now
  // Always redirect authenticated users to their first venue (unless SUPERADMIN)
  if (isAuthenticated && user.venues.length >= 1 && user.role !== 'SUPERADMIN') {
    return <Navigate to={`/venues/${user.venues[0].slug}/home`} />
  }

  // SUPERADMIN users should go to superadmin dashboard by default
  if (isAuthenticated && user.role === 'SUPERADMIN') {
    return <Navigate to="/superadmin" />
  }

  // World-Class Pattern (Stripe/Shopify): OWNER without venues should complete onboarding
  // This prevents the flash of "No venues assigned" message during signup flow
  if (isAuthenticated && user.role === 'OWNER' && user.venues.length === 0) {
    return <Navigate to="/onboarding" replace />
  }

  // Other users without venues show error message (not OWNER, not SUPERADMIN)
  if (user.role !== 'SUPERADMIN' && isAuthenticated && user.venues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-6 text-center bg-background">
        <div className="w-full max-w-md p-8 bg-card rounded-lg shadow-lg text-card-foreground">
          <div className="absolute top-4 right-4">
            <ThemeToggle />
          </div>
          <h1 className="mb-4 text-2xl font-semibold text-foreground">{t('layout.noVenuesAssigned')}</h1>
          <p className="mb-6 text-muted-foreground">{t('layout.noVenuesAssignedDesc')}</p>

          <p className="mt-4 mb-4 text-sm text-muted-foreground">
            {t('layout.needHelp')}{' '}
            <a href="/support" className="text-primary underline hover:text-primary/80">
              {t('layout.contactUs')}
            </a>
          </p>
          <Button aria-label={t('logout')} onClick={() => logout()}>
            <LogOut />
            {t('logout')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 bg-background text-foreground">
      <div className="flex justify-between items-center mb-4">
        <h1>{t('layout.testPageTitle')}</h1>
        <ThemeToggle />
      </div>
      {isAuthenticated ? <h2>{t('layout.authenticated')}</h2> : <h2>{t('layout.notAuthenticated')}</h2>}

      <Link to="/login" className="mr-4">
        {t('login')}
      </Link>
      <Button variant="outline" aria-label={t('logout')} onClick={() => logout()}>
        {t('logout')}
      </Button>
    </div>
  )
}
