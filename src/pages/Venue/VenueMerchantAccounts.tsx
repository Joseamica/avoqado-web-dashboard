/**
 * VenueMerchantAccounts - Read-only view of merchant accounts for this venue
 *
 * MerchantAccount is a global platform resource (no venueId).
 * Full management is in /superadmin/merchant-accounts (Control Plane).
 * This page shows a summary of accounts associated with THIS venue + link to superadmin.
 */
import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Info,
  Loader2,
  Settings,
  Shield,
  Smartphone,
  Zap,
} from 'lucide-react'
import { paymentProviderAPI, type MerchantAccount } from '@/services/paymentProvider.service'
import { terminalAPI, type Terminal } from '@/services/superadmin-terminals.service'
import { useAuth } from '@/context/AuthContext'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { StaffRole } from '@/types'

// ============================================================================
// SHARED COMPONENTS (simplified version)
// ============================================================================

const GlassCard: React.FC<{
  children: React.ReactNode
  className?: string
}> = ({ children, className }) => (
  <div
    className={cn(
      'relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm',
      'shadow-sm transition-all duration-300',
      className,
    )}
  >
    {children}
  </div>
)

// ============================================================================
// READ-ONLY ACCOUNT CARD
// ============================================================================

const ReadOnlyAccountCard: React.FC<{ account: MerchantAccount }> = ({ account }) => {
  const costStructuresCount = account._count?.costStructures || 0

  return (
    <GlassCard className="p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className={cn('shrink-0 p-2.5 rounded-xl', account.active ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/10' : 'bg-muted')}
        >
          {account.provider?.code === 'BLUMON' ? (
            <Zap className={cn('w-5 h-5', account.active ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground')} />
          ) : (
            <CreditCard className={cn('w-5 h-5', account.active ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground')} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm truncate">{account.displayName || account.alias || 'Sin nombre'}</h3>
            <Badge
              variant={account.active ? 'default' : 'secondary'}
              className={cn('text-[10px] px-1.5 py-0', account.active && 'bg-green-600 hover:bg-green-600')}
            >
              {account.active ? 'Activa' : 'Inactiva'}
            </Badge>
          </div>

          <div className="flex items-center gap-1.5 mt-1">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
              {account.provider?.name}
            </Badge>
            {account.blumonEnvironment && (
              <Badge
                variant={account.blumonEnvironment === 'PRODUCTION' ? 'default' : 'secondary'}
                className={cn(
                  'text-[10px] px-1.5 py-0',
                  account.blumonEnvironment === 'PRODUCTION'
                    ? 'bg-green-600 hover:bg-green-600'
                    : 'bg-amber-500/80 text-amber-950 hover:bg-amber-500/80',
                )}
              >
                {account.blumonEnvironment === 'PRODUCTION' ? 'PROD' : 'SANDBOX'}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-border/50">
        <div className="flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3 text-muted-foreground font-mono">
            <span className="truncate max-w-[150px]" title={account.externalMerchantId}>
              {account.externalMerchantId}
            </span>
            {account.blumonSerialNumber && (
              <>
                <span className="text-border">•</span>
                <span className="flex items-center gap-1">
                  <Smartphone className="w-3 h-3" />
                  {account.blumonSerialNumber}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {account.hasCredentials && <Shield className="w-3 h-3 text-green-500" />}
            {costStructuresCount > 0 ? (
              <div className="flex items-center gap-1 text-muted-foreground">
                <CheckCircle2 className="w-3 h-3 text-green-500" />
                <span>Costos</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-3 h-3" />
                <span>Sin costos</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </GlassCard>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const VenueMerchantAccounts: React.FC = () => {
  const { t } = useTranslation(['payment', 'common'])
  const { slug } = useParams<{ slug: string }>()
  const { getVenueBySlug, user, staffInfo } = useAuth()

  const venue = getVenueBySlug(slug!)

  // Check if user is superadmin
  const isSuperadmin = user?.role === 'SUPERADMIN' || staffInfo?.role === StaffRole.SUPERADMIN

  // Fetch VenuePaymentConfig to know which accounts are associated with this venue
  const { data: venuePaymentConfig, isLoading: loadingConfig } = useQuery({
    queryKey: ['venue-payment-config', venue?.id],
    queryFn: () => paymentProviderAPI.getVenuePaymentConfig(venue!.id),
    enabled: !!venue?.id,
  })

  // Fetch terminals for this venue to get their assigned merchant accounts
  const { data: terminals = [], isLoading: loadingTerminals } = useQuery({
    queryKey: ['venue-terminals', venue?.id],
    queryFn: () => terminalAPI.getAllTerminals({ venueId: venue!.id }),
    enabled: !!venue?.id,
  })

  // Collect all unique account IDs associated with this venue
  const associatedAccountIds = useMemo(() => {
    const ids = new Set<string>()

    // From VenuePaymentConfig
    if (venuePaymentConfig) {
      if (venuePaymentConfig.primaryAccountId) ids.add(venuePaymentConfig.primaryAccountId)
      if (venuePaymentConfig.secondaryAccountId) ids.add(venuePaymentConfig.secondaryAccountId)
      if (venuePaymentConfig.tertiaryAccountId) ids.add(venuePaymentConfig.tertiaryAccountId)
    }

    // From terminal assignments
    terminals.forEach((terminal: Terminal) => {
      terminal.assignedMerchantIds?.forEach((id: string) => ids.add(id))
    })

    return Array.from(ids)
  }, [venuePaymentConfig, terminals])

  // Fetch the actual account details
  const { data: accounts = [], isLoading: loadingAccounts } = useQuery({
    queryKey: ['venue-merchant-accounts-details', associatedAccountIds],
    queryFn: async () => {
      if (associatedAccountIds.length === 0) return []
      // Fetch all accounts and filter by IDs
      const allAccounts = await paymentProviderAPI.getAllMerchantAccounts()
      return allAccounts.filter(a => associatedAccountIds.includes(a.id))
    },
    enabled: associatedAccountIds.length > 0,
  })

  const isLoading = loadingConfig || loadingTerminals || loadingAccounts

  // Categorize accounts
  const activeAccounts = accounts.filter(a => a.active)
  const inactiveAccounts = accounts.filter(a => !a.active)

  return (
    <div className="space-y-6 px-4 md:px-6 lg:px-8 py-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('merchantAccounts.title')}</h1>
          <p className="text-muted-foreground">Cuentas de pago asociadas a {venue?.name}</p>
        </div>

        {isSuperadmin && (
          <Button
            asChild
            className="bg-gradient-to-r from-amber-400 to-pink-500 hover:from-amber-500 hover:to-pink-600 text-primary-foreground"
          >
            <Link to="/superadmin/merchant-accounts">
              <Settings className="w-4 h-4 mr-2" />
              Gestionar en Superadmin
              <ExternalLink className="w-3 h-3 ml-2" />
            </Link>
          </Button>
        )}
      </div>

      {/* Info Alert */}
      <Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertDescription className="text-blue-700 dark:text-blue-300">
          Las cuentas de comercio son recursos globales de la plataforma.{' '}
          {isSuperadmin ? (
            <>
              La gestión completa (crear, editar, eliminar) se realiza desde el{' '}
              <Link to="/superadmin/merchant-accounts" className="underline font-medium hover:text-blue-800 dark:hover:text-blue-200">
                panel de Superadmin
              </Link>
              .
            </>
          ) : (
            'Contacta al administrador de la plataforma para modificar la configuración.'
          )}
        </AlertDescription>
      </Alert>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
              <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{accounts.length}</p>
              <p className="text-xs text-muted-foreground">Cuentas asociadas</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeAccounts.length}</p>
              <p className="text-xs text-muted-foreground">Activas</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5">
              <Smartphone className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{terminals.length}</p>
              <p className="text-xs text-muted-foreground">Terminales</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/5">
              <Building2 className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{venuePaymentConfig ? 1 : 0}</p>
              <p className="text-xs text-muted-foreground">Config de pago</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Accounts List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <span className="ml-3 text-muted-foreground">Cargando cuentas...</span>
        </div>
      ) : accounts.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <div className="p-4 rounded-full bg-muted/50 w-fit mx-auto mb-4">
            <CreditCard className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">No hay cuentas asociadas</h3>
          <p className="text-sm text-muted-foreground mb-6">Este venue aún no tiene cuentas de comercio configuradas.</p>
          {isSuperadmin && (
            <Button
              asChild
              className="bg-gradient-to-r from-amber-400 to-pink-500 hover:from-amber-500 hover:to-pink-600 text-primary-foreground"
            >
              <Link to="/superadmin/merchant-accounts">
                <Zap className="w-4 h-4 mr-2" />
                Ir a Superadmin para crear
              </Link>
            </Button>
          )}
        </GlassCard>
      ) : (
        <div className="space-y-6">
          {/* Active Accounts */}
          {activeAccounts.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Cuentas Activas ({activeAccounts.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeAccounts.map(account => (
                  <ReadOnlyAccountCard key={account.id} account={account} />
                ))}
              </div>
            </div>
          )}

          {/* Inactive Accounts */}
          {inactiveAccounts.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Cuentas Inactivas ({inactiveAccounts.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {inactiveAccounts.map(account => (
                  <ReadOnlyAccountCard key={account.id} account={account} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default VenueMerchantAccounts
