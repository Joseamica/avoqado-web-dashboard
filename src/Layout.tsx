import { useAuth } from '@/context/AuthContext'
import { Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export function Layout() {
  const { isAuthenticated, isLoading } = useAuth()
  const { t } = useTranslation()

  if (isLoading) {
    return <div>{t('loading')}</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Root navigation decisions are centralized in AuthContext to keep a single source of truth.
  return <div>{t('loading')}</div>
}
