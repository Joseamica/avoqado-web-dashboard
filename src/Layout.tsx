import { useAuth } from '@/context/AuthContext'
import { LoadingScreen } from '@/components/spinner'
import { Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export function Layout() {
  const { isAuthenticated, isLoading } = useAuth()
  const { t } = useTranslation()

  if (isLoading) {
    return <LoadingScreen message={t('loading')} />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Root navigation decisions are centralized in AuthContext to keep a single source of truth.
  // AuthContext useEffect handles redirect from "/" to the appropriate venue/dashboard.
  return <LoadingScreen message={t('loading')} />
}
