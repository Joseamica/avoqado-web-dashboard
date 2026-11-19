import { Link, Navigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { LoadingScreen } from '@/components/spinner'
import { SupportWhatsappCard } from './components/SupportWhatsappCard'

export default function SupportWhatsappPage() {
  const { user, isAuthenticated, isLoading, logout } = useAuth()
  const { t } = useTranslation('account')
  const location = useLocation()
  if (isLoading) return <LoadingScreen message={t('supportWhatsapp.loading')} />
  if (!isAuthenticated || !user) return <Navigate to="/login?returnTo=%2Fsupport%2Fwhatsapp" replace />
  if (!user.emailVerified) return <Navigate to={`/auth/verify-email?email=${encodeURIComponent(user.email)}`} replace />
  const back =
    typeof location.state?.returnPath === 'string' && /^\/(wl\/)?venues\/[a-z0-9-]+\/settings\/profile$/.test(location.state.returnPath)
      ? location.state.returnPath
      : null
  return (
    <main className="min-h-screen bg-background text-foreground px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-5">
        <h1 className="sr-only">{t('supportWhatsapp.title')}</h1>
        {back && (
          <Link to={back} className="text-sm underline underline-offset-4">
            {t('supportWhatsapp.back')}
          </Link>
        )}
        <SupportWhatsappCard key={user.id} staffId={user.id} onReauthenticate={() => logout('/support/whatsapp')} />
      </div>
    </main>
  )
}
