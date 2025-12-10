/**
 * PaymentSetupWizardDialog Component
 *
 * Modal dialog showing the complete payment setup checklist for a venue.
 * Displays all 8 checklist items with their status and provides actions
 * to complete missing configuration steps.
 *
 * Used by:
 * - PaymentSetupAlert (floating alert)
 * - PaymentSetupBanner (inline banner)
 * - Superadmin venue details page
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  CheckCircle2,
  Circle,
  AlertCircle,
  Loader2,
  FileCheck,
  Smartphone,
  CreditCard,
  Link2,
  Settings,
  DollarSign,
  Building2,
  Wallet,
  ExternalLink,
  RefreshCw,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useTranslation } from 'react-i18next'
import type { PaymentReadinessResponse } from '@/services/paymentProvider.service'

interface PaymentSetupWizardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  venueId: string
  readiness?: PaymentReadinessResponse
}

type ChecklistKey = keyof PaymentReadinessResponse['checklist']

interface ChecklistItemConfig {
  key: ChecklistKey
  icon: React.ComponentType<{ className?: string }>
  labelKey: string
  descriptionKey: string
  actionLabelKey?: string
  // Use a function to generate the path based on venue slug
  getActionPath?: (venueSlug: string) => string
  isBlocking: boolean
}

const CHECKLIST_CONFIG: ChecklistItemConfig[] = [
  {
    key: 'kycApproved',
    icon: FileCheck,
    labelKey: 'paymentSetup.checklist.kycApproved',
    descriptionKey: 'paymentSetup.checklist.kycApprovedDesc',
    actionLabelKey: 'paymentSetup.actions.reviewKyc',
    // KYC documents are in the venue edit section
    getActionPath: (venueSlug: string) => `/venues/${venueSlug}/edit/documents`,
    isBlocking: true,
  },
  {
    key: 'terminalRegistered',
    icon: Smartphone,
    labelKey: 'paymentSetup.checklist.terminalRegistered',
    descriptionKey: 'paymentSetup.checklist.terminalRegisteredDesc',
    actionLabelKey: 'paymentSetup.actions.registerTerminal',
    // Terminals are managed at venue level (TPV page)
    getActionPath: (venueSlug: string) => `/venues/${venueSlug}/tpv`,
    isBlocking: true,
  },
  {
    key: 'merchantAccountCreated',
    icon: CreditCard,
    labelKey: 'paymentSetup.checklist.merchantAccountCreated',
    descriptionKey: 'paymentSetup.checklist.merchantAccountCreatedDesc',
    actionLabelKey: 'paymentSetup.actions.createMerchant',
    // Merchant accounts are now at venue level
    getActionPath: (venueSlug: string) => `/venues/${venueSlug}/merchant-accounts`,
    isBlocking: true,
  },
  {
    key: 'terminalMerchantLinked',
    icon: Link2,
    labelKey: 'paymentSetup.checklist.terminalMerchantLinked',
    descriptionKey: 'paymentSetup.checklist.terminalMerchantLinkedDesc',
    actionLabelKey: 'paymentSetup.actions.linkTerminal',
    // Link terminal in TPV page
    getActionPath: (venueSlug: string) => `/venues/${venueSlug}/tpv`,
    isBlocking: true,
  },
  {
    key: 'venuePaymentConfigured',
    icon: Settings,
    labelKey: 'paymentSetup.checklist.venuePaymentConfigured',
    descriptionKey: 'paymentSetup.checklist.venuePaymentConfiguredDesc',
    actionLabelKey: 'paymentSetup.actions.configurePayment',
    // Payment config is at venue level
    getActionPath: (venueSlug: string) => `/venues/${venueSlug}/payment-config`,
    isBlocking: true,
  },
  {
    key: 'pricingStructureSet',
    icon: DollarSign,
    labelKey: 'paymentSetup.checklist.pricingStructureSet',
    descriptionKey: 'paymentSetup.checklist.pricingStructureSetDesc',
    actionLabelKey: 'paymentSetup.actions.setPricing',
    // Pricing is in superadmin
    getActionPath: () => '/superadmin/venue-pricing',
    isBlocking: false,
  },
  {
    key: 'providerCostStructureSet',
    icon: Building2,
    labelKey: 'paymentSetup.checklist.providerCostStructureSet',
    descriptionKey: 'paymentSetup.checklist.providerCostStructureSetDesc',
    actionLabelKey: 'paymentSetup.actions.setCosts',
    // Cost structures are in superadmin
    getActionPath: () => '/superadmin/cost-structures',
    isBlocking: false,
  },
  {
    key: 'clabeProvided',
    icon: Wallet,
    labelKey: 'paymentSetup.checklist.clabeProvided',
    descriptionKey: 'paymentSetup.checklist.clabeProvidedDesc',
    actionLabelKey: 'paymentSetup.actions.addClabe',
    // CLABE is in venue documents/KYC
    getActionPath: (venueSlug: string) => `/venues/${venueSlug}/edit/documents`,
    isBlocking: false,
  },
]

export function PaymentSetupWizardDialog({ open, onOpenChange, venueId, readiness }: PaymentSetupWizardDialogProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { activeVenue } = useAuth()

  // Get venue slug from readiness response or active venue
  const venueSlug = readiness?.venueSlug || activeVenue?.slug || ''

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['payment-readiness', venueId] })
  }

  const handleAction = (getPath?: (slug: string) => string) => {
    if (getPath && venueSlug) {
      onOpenChange(false)
      navigate(getPath(venueSlug))
    }
  }

  // Calculate progress
  const completedCount = readiness
    ? Object.values(readiness.checklist).filter(item => item.status === 'ok' || item.status === 'default').length
    : 0
  const totalCount = CHECKLIST_CONFIG.length
  const progressPercent = Math.round((completedCount / totalCount) * 100)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-gradient-to-r from-amber-400 to-pink-500">
                <CreditCard className="h-5 w-5 text-primary-foreground" />
              </div>
              <span>{t('paymentSetup.wizard.title', 'Configuracion de Pagos')}</span>
            </DialogTitle>
            <Button variant="ghost" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <DialogDescription>
            {readiness?.venueName || activeVenue?.name || 'Venue'}
          </DialogDescription>
        </DialogHeader>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('paymentSetup.wizard.progress', 'Progreso')}</span>
            <span className="font-medium">
              {completedCount}/{totalCount} ({progressPercent}%)
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-pink-500 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Status badge */}
        <div className="flex items-center justify-center">
          {readiness?.canProcessPayments ? (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {t('paymentSetup.wizard.ready', 'Listo para procesar pagos')}
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
              <AlertCircle className="h-3 w-3 mr-1" />
              {t('paymentSetup.wizard.pending', 'Configuracion pendiente')}
            </Badge>
          )}
        </div>

        <Separator />

        {/* Checklist */}
        <div className="space-y-3">
          {CHECKLIST_CONFIG.map(config => {
            const item = readiness?.checklist[config.key]
            const status = item?.status || 'missing'
            const isBlocking = config.isBlocking && (status === 'missing' || status === 'pending')

            return (
              <ChecklistRow
                key={config.key}
                config={config}
                status={status}
                details={item?.details}
                isBlocking={isBlocking}
                onAction={() => handleAction(config.getActionPath)}
                t={t}
              />
            )
          })}
        </div>

        {/* Next action */}
        {readiness?.nextAction && !readiness.canProcessPayments && (
          <>
            <Separator />
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm font-medium text-muted-foreground mb-1">
                {t('paymentSetup.wizard.nextStep', 'Siguiente paso')}:
              </p>
              <p className="text-sm font-medium">{readiness.nextAction}</p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

interface ChecklistRowProps {
  config: ChecklistItemConfig
  status: string
  details?: string
  isBlocking: boolean
  onAction: () => void
  t: (key: string, fallback?: string) => string
}

function ChecklistRow({ config, status, details, isBlocking, onAction, t }: ChecklistRowProps) {
  const Icon = config.icon

  const getStatusIcon = () => {
    switch (status) {
      case 'ok':
        return <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
      case 'default':
        return <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
      case 'pending':
        return <Loader2 className="h-5 w-5 text-yellow-600 dark:text-yellow-400 animate-spin" />
      default:
        return <Circle className="h-5 w-5 text-muted-foreground" />
    }
  }

  const getStatusBadge = () => {
    switch (status) {
      case 'ok':
        return (
          <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
            {t('paymentSetup.status.completed', 'Completado')}
          </Badge>
        )
      case 'default':
        return (
          <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            {t('paymentSetup.status.default', 'Por defecto')}
          </Badge>
        )
      case 'pending':
        return (
          <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">
            {t('paymentSetup.status.pending', 'Pendiente')}
          </Badge>
        )
      default:
        return (
          <Badge variant="secondary" className="text-xs">
            {t('paymentSetup.status.missing', 'Faltante')}
          </Badge>
        )
    }
  }

  const isCompleted = status === 'ok' || status === 'default'

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
        isCompleted
          ? 'bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
          : isBlocking
          ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
          : 'bg-muted/30 border-border'
      }`}
    >
      {/* Status icon */}
      <div className="mt-0.5">{getStatusIcon()}</div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className={`text-sm font-medium ${isCompleted ? 'text-green-700 dark:text-green-300' : ''}`}>
            {t(config.labelKey, config.key)}
          </span>
          {getStatusBadge()}
          {isBlocking && !isCompleted && (
            <Badge variant="destructive" className="text-xs">
              {t('paymentSetup.status.blocking', 'Bloqueante')}
            </Badge>
          )}
        </div>

        {details && <p className="text-xs text-muted-foreground mb-2">{details}</p>}

        {/* Action button for missing/pending items */}
        {!isCompleted && config.getActionPath && (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onAction}>
            {t(config.actionLabelKey || 'common.configure', 'Configurar')}
            <ExternalLink className="h-3 w-3 ml-1" />
          </Button>
        )}
      </div>
    </div>
  )
}

export default PaymentSetupWizardDialog
