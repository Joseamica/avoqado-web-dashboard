/**
 * KYCSetupRequired Page
 *
 * Displayed when a user tries to access operational features (Orders, Payments, TPV, etc.)
 * but their venue's KYC verification is not VERIFIED.
 *
 * Shows different messages based on KYC status:
 * - Missing: Prompt to start KYC verification
 * - Pending/In Review: Show waiting message
 * - Rejected: Show rejection reason and resubmit option
 */

import { useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Clock, XCircle, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export function KYCSetupRequired() {
  const { activeVenue } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation('kyc')

  const status = activeVenue?.kycStatus

  // Redirect verified users to home (e.g., if they reload this page after KYC approval)
  useEffect(() => {
    if (activeVenue && status === 'VERIFIED') {
      navigate(`/venues/${activeVenue.slug}/home`, { replace: true })
    }
  }, [status, activeVenue, navigate])

  // Don't render anything if no venue or if already verified (redirect in progress)
  if (!activeVenue || status === 'VERIFIED') return null

  return (
    <div className="flex items-center justify-center min-h-screen p-6 bg-muted/30">
      <div className="max-w-2xl w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <ShieldAlert className="h-16 w-16 mx-auto text-muted-foreground" />
          <h1 className="text-3xl font-bold text-foreground">{t('setupRequired.title')}</h1>
          <p className="text-muted-foreground">{t('setupRequired.subtitle')}</p>
        </div>

        {/* MISSING: No KYC submitted yet */}
        {(!status || status === null) && (
          <Alert className="bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800">
            <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertTitle className="text-blue-900 dark:text-blue-100">{t('setupRequired.missing.title')}</AlertTitle>
            <AlertDescription className="text-blue-800 dark:text-blue-200">
              <p>{t('setupRequired.missing.description')}</p>
              <Button className="mt-4" onClick={() => navigate(`/venues/${activeVenue.slug}/onboarding`)}>
                {t('setupRequired.missing.action')}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* PENDING: Submitted, awaiting review */}
        {(status === 'PENDING_REVIEW' || status === 'IN_REVIEW') && (
          <Alert className="bg-yellow-50 dark:bg-yellow-950/50 border-yellow-200 dark:border-yellow-800">
            <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <AlertTitle className="text-yellow-900 dark:text-yellow-100">{t('setupRequired.pending.title')}</AlertTitle>
            <AlertDescription className="text-yellow-800 dark:text-yellow-200">
              <p>{t('setupRequired.pending.description')}</p>
              <div className="mt-4 p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-md border border-yellow-200 dark:border-yellow-800">
                <p className="text-sm text-yellow-900 dark:text-yellow-100">
                  <strong>{t('setupRequired.pending.note')}</strong> {t('setupRequired.pending.noteText')}
                </p>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* REJECTED: Need to resubmit */}
        {status === 'REJECTED' && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>{t('setupRequired.rejected.title')}</AlertTitle>
            <AlertDescription>
              <p>{activeVenue.kycRejectionReason || t('setupRequired.rejected.defaultReason')}</p>
              <Button className="mt-4" variant="destructive" onClick={() => navigate(`/venues/${activeVenue.slug}/edit/documents`)}>
                {t('setupRequired.rejected.action')}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Help Text */}
        <div className="text-center text-sm text-muted-foreground space-y-2">
          <p>{t('setupRequired.helpText')}</p>
          <p>
            {t('setupRequired.contactSupport')}{' '}
            <a href="mailto:hola@avoqado.io" className="text-primary hover:underline">
              {t('setupRequired.contactEmail')}
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
