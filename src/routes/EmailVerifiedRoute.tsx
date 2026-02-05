import { useAuth } from '@/context/AuthContext'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useToast } from '@/hooks/use-toast'
import { useEffect, useState } from 'react'

export const EmailVerifiedRoute = () => {
  const { user, isAuthenticated } = useAuth() || {}
  const location = useLocation()
  const { t } = useTranslation('auth')
  const { toast } = useToast()
  const [hasShownToast, setHasShownToast] = useState(false)

  useEffect(() => {
    if (isAuthenticated && user && !user.emailVerified && !hasShownToast) {
      toast({
        title: t('verification.errorTitle'),
        description: t('verification.pleaseVerify'),
        variant: 'destructive',
      })
      setHasShownToast(true)
    }
  }, [isAuthenticated, user, hasShownToast, toast, t])

  // If not authenticated, redirect to login with returnTo to preserve the route
  if (!isAuthenticated || !user) {
    const returnTo = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />
  }

  // If authenticated but email not verified, redirect to signup
  if (!user.emailVerified) {
    return <Navigate to="/signup" replace />
  }

  // Email is verified, allow access
  return <Outlet />
}
