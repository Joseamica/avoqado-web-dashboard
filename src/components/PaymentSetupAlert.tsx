/**
 * PaymentSetupAlert Component
 *
 * Floating alert shown to SUPERADMIN users when a venue is not ready to process payments.
 * Uses the payment readiness checklist to determine what's missing and show the next action.
 *
 * This component is designed to be placed in venue layouts and will:
 * - Only render for SUPERADMIN users
 * - Only show when venue cannot process payments
 * - Show the next action needed to complete setup
 * - Open the PaymentSetupWizardDialog for detailed configuration
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { CreditCard, X, ChevronRight, CheckCircle2, Circle, AlertCircle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { getVenuePaymentReadiness } from '@/services/paymentProvider.service'
import { PaymentSetupWizardDialog } from './PaymentSetupWizardDialog'
import { useTranslation } from 'react-i18next'

interface PaymentSetupAlertProps {
  venueId: string
  className?: string
}

/**
 * PaymentSetupAlert - Floating alert for superadmins
 *
 * Displays a fixed-position alert when the current venue needs payment configuration.
 * Uses the amber-to-pink gradient to indicate superadmin-only functionality.
 */
export function PaymentSetupAlert({ venueId, className = '' }: PaymentSetupAlertProps) {
  const { staffInfo } = useAuth()
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)

  const isSuperadmin = staffInfo?.role === 'SUPERADMIN'

  // Only fetch for superadmins
  const { data: readiness, isLoading } = useQuery({
    queryKey: ['payment-readiness', venueId],
    queryFn: () => getVenuePaymentReadiness(venueId),
    enabled: isSuperadmin && !!venueId,
    staleTime: 30000, // Cache for 30 seconds
    refetchOnWindowFocus: false,
  })

  // Don't render for non-superadmins
  if (!isSuperadmin) return null

  // Don't render while loading
  if (isLoading) return null

  // Don't render if venue can process payments
  if (readiness?.canProcessPayments) return null

  // Don't render if dismissed
  if (dismissed) return null

  // Count completed items
  const completedCount = readiness
    ? Object.values(readiness.checklist).filter(item => item.status === 'ok' || item.status === 'default').length
    : 0
  const totalCount = 8

  return (
    <>
      <div className={`fixed right-4 z-50 w-80 animate-in slide-in-from-bottom-4 ${className || 'bottom-4'}`}>
        <div className="rounded-lg bg-gradient-to-r from-amber-400 to-pink-500 p-4 text-primary-foreground shadow-lg">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-background/20 shrink-0">
              <CreditCard className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold">{t('paymentSetup.alert.title', 'Configurar Pagos')}</span>
                <button
                  onClick={() => setDismissed(true)}
                  className="p-1 hover:bg-background/20 rounded-full transition-colors -mr-1"
                  aria-label={t('common.dismiss', 'Cerrar')}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-sm text-primary-foreground/90 mb-2">{readiness?.nextAction}</p>
              <div className="flex items-center gap-1 text-xs text-primary-foreground/80 mb-3">
                <CheckCircle2 className="h-3 w-3" />
                <span>
                  {completedCount}/{totalCount} {t('paymentSetup.alert.completed', 'completado')}
                </span>
              </div>
              <Button
                size="sm"
                className="w-full bg-background text-pink-600 hover:bg-background/90 font-medium"
                onClick={() => setWizardOpen(true)}
              >
                {t('paymentSetup.alert.action', 'Ver Checklist')}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <PaymentSetupWizardDialog
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        venueId={venueId}
        readiness={readiness}
      />
    </>
  )
}

/**
 * PaymentSetupBanner - Inline banner variant
 *
 * A non-floating version for embedding in pages like Settings.
 * Shows more detail about what's missing.
 */
export function PaymentSetupBanner({ venueId }: { venueId: string }) {
  const { staffInfo } = useAuth()
  const { t } = useTranslation()
  const [wizardOpen, setWizardOpen] = useState(false)

  const isSuperadmin = staffInfo?.role === 'SUPERADMIN'

  const { data: readiness, isLoading } = useQuery({
    queryKey: ['payment-readiness', venueId],
    queryFn: () => getVenuePaymentReadiness(venueId),
    enabled: isSuperadmin && !!venueId,
    staleTime: 30000,
  })

  if (!isSuperadmin || isLoading || readiness?.canProcessPayments) return null

  return (
    <>
      <Alert className="border-amber-500 bg-gradient-to-r from-amber-50 to-pink-50 dark:from-amber-950/30 dark:to-pink-950/30">
        <CreditCard className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <AlertTitle className="text-amber-900 dark:text-amber-100">
          {t('paymentSetup.banner.title', 'Configuracion de Pagos Pendiente')}
        </AlertTitle>
        <AlertDescription className="text-amber-800 dark:text-amber-200">
          <p className="text-sm mb-3">{readiness?.nextAction}</p>

          {/* Mini checklist preview */}
          <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
            {readiness && (
              <>
                <ChecklistMiniItem
                  label={t('paymentSetup.checklist.kycApproved', 'KYC Aprobado')}
                  status={readiness.checklist.kycApproved.status}
                />
                <ChecklistMiniItem
                  label={t('paymentSetup.checklist.terminalRegistered', 'Terminal Registrada')}
                  status={readiness.checklist.terminalRegistered.status}
                />
                <ChecklistMiniItem
                  label={t('paymentSetup.checklist.merchantAccountCreated', 'Cuenta Merchant')}
                  status={readiness.checklist.merchantAccountCreated.status}
                />
                <ChecklistMiniItem
                  label={t('paymentSetup.checklist.venuePaymentConfigured', 'Config. de Pago')}
                  status={readiness.checklist.venuePaymentConfigured.status}
                />
              </>
            )}
          </div>

          <Button
            size="sm"
            className="bg-gradient-to-r from-amber-400 to-pink-500 hover:from-amber-500 hover:to-pink-600 text-primary-foreground"
            onClick={() => setWizardOpen(true)}
          >
            {t('paymentSetup.banner.action', 'Completar Configuracion')}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </AlertDescription>
      </Alert>

      <PaymentSetupWizardDialog
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        venueId={venueId}
        readiness={readiness}
      />
    </>
  )
}

/**
 * Mini checklist item for banner preview
 */
function ChecklistMiniItem({ label, status }: { label: string; status: string }) {
  const getIcon = () => {
    switch (status) {
      case 'ok':
      case 'default':
        return <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
      case 'pending':
        return <AlertCircle className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />
      default:
        return <Circle className="h-3 w-3 text-muted-foreground" />
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      {getIcon()}
      <span className={status === 'ok' || status === 'default' ? 'text-green-700 dark:text-green-300' : ''}>
        {label}
      </span>
    </div>
  )
}

export default PaymentSetupAlert
