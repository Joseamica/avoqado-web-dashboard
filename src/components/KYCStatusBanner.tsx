/**
 * KYCStatusBanner Component
 *
 * Displays a banner at the top of the Home page when a venue's KYC status
 * is not VERIFIED. Shows different variants based on status:
 *
 * - Missing: Prompt to start KYC verification (blue)
 * - Pending: Awaiting review notification (yellow)
 * - Rejected: Prompt to resubmit documents (red/destructive)
 *
 * Uses kyc-utils to determine which variant to show.
 */

import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Clock, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { getKYCBannerVariant, shouldShowKYCBanner } from '@/lib/kyc-utils'
import { useTranslation } from 'react-i18next'

/**
 * Main KYCStatusBanner component
 *
 * Automatically determines which banner variant to show based on venue KYC status.
 * Returns null if no banner should be shown (demo venues or verified venues).
 */
export function KYCStatusBanner() {
  const { activeVenue } = useAuth()

  if (!shouldShowKYCBanner(activeVenue)) return null

  const variant = getKYCBannerVariant(activeVenue)
  if (!variant) return null

  switch (variant) {
    case 'missing':
      return <KYCMissingBanner />
    case 'pending':
      return <KYCPendingBanner />
    case 'rejected':
      return <KYCRejectedBanner />
    default:
      return null
  }
}

/**
 * KYCMissingBanner - Shown when no KYC has been submitted
 *
 * Blue/info variant prompting user to start KYC verification.
 */
function KYCMissingBanner() {
  const { activeVenue } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation('kyc')

  if (!activeVenue) return null

  return (
    <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950/50 dark:border-blue-800">
      <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
      <AlertDescription className="flex items-center justify-between gap-4 text-blue-900 dark:text-blue-100">
        <p className="text-sm font-medium">{t('banner.missing.message')}</p>
        <Button size="sm" className="shrink-0" onClick={() => navigate(`/venues/${activeVenue.slug}/onboarding`)}>
          {t('banner.missing.action')}
        </Button>
      </AlertDescription>
    </Alert>
  )
}

/**
 * KYCPendingBanner - Shown when KYC is under review
 *
 * Yellow/warning variant indicating documents are being reviewed.
 */
function KYCPendingBanner() {
  const { t } = useTranslation('kyc')

  return (
    <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/50 dark:border-yellow-800">
      <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
      <AlertDescription className="text-yellow-900 dark:text-yellow-100">
        <p className="text-sm font-medium">{t('banner.pending.message')}</p>
      </AlertDescription>
    </Alert>
  )
}

/**
 * KYCRejectedBanner - Shown when KYC was rejected
 *
 * Red/destructive variant prompting user to resubmit documents.
 * Completely hidden if user is already on the documents page (to avoid redundancy).
 */
function KYCRejectedBanner() {
  const { activeVenue } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation('kyc')

  if (!activeVenue) return null

  // Hide completely if user is already on the documents page
  // (that page has its own rejection message)
  const isOnDocumentsPage = location.pathname.includes('/edit/documents')
  if (isOnDocumentsPage) return null

  return (
    <Alert variant="destructive">
      <XCircle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium">{t('banner.rejected.message')}</p>
        <Button size="sm" variant="destructive" className="shrink-0" onClick={() => navigate(`/venues/${activeVenue.slug}/edit/documents`)}>
          {t('banner.rejected.action')}
        </Button>
      </AlertDescription>
    </Alert>
  )
}
