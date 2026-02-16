import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { ProviderCostStructure, VenuePricingStructure } from '@/services/paymentProvider.service'
import { paymentProviderAPI } from '@/services/paymentProvider.service'
import { Currency } from '@/utils/currency'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Calculator,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  DollarSign,
  Plus,
  Settings,
  Shield,
  Sparkles,
  Trash2,
  TrendingUp,
  Wallet,
  Zap,
} from 'lucide-react'
import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { PaymentSetupWizard } from '../Superadmin/components/merchant-accounts/PaymentSetupWizard'
import { VenuePaymentConfigDialog } from './components/VenuePaymentConfigDialog'
import { VenuePricingDialog } from './components/VenuePricingDialog'

/**
 * VenuePaymentConfig - Modern 2025/2026 Design
 *
 * Design System:
 * - Bento Grid Layout for visual hierarchy
 * - Glassmorphism for depth and modern feel
 * - Micro-interactions for feedback
 * - Progressive disclosure for complexity management
 * - Status-first design for quick understanding
 *
 * Inspired by: Stripe Dashboard, Linear, Vercel
 */

// ============================================================================
// COMPONENTS
// ============================================================================

/** Glassmorphism card wrapper */
const GlassCard: React.FC<{
  children: React.ReactNode
  className?: string
  hover?: boolean
  onClick?: () => void
}> = ({ children, className, hover = false, onClick }) => (
  <div
    onClick={onClick}
    className={cn(
      'relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm',
      'shadow-sm transition-all duration-300',
      hover && 'cursor-pointer hover:shadow-md hover:border-border hover:bg-card/90 hover:-translate-y-0.5',
      onClick && 'cursor-pointer',
      className,
    )}
  >
    {children}
  </div>
)

/** Status indicator with pulse animation */
const StatusPulse: React.FC<{ status: 'success' | 'warning' | 'error' | 'neutral' }> = ({ status }) => {
  const colors = {
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500',
    neutral: 'bg-muted-foreground',
  }

  return (
    <span className="relative flex h-3 w-3">
      <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', colors[status])} />
      <span className={cn('relative inline-flex rounded-full h-3 w-3', colors[status])} />
    </span>
  )
}

/** Metric card for bento grid */
const MetricCard: React.FC<{
  label: string
  value: string
  subValue?: string
  icon: React.ReactNode
  trend?: 'up' | 'down' | 'neutral'
  accent?: 'green' | 'blue' | 'purple' | 'orange'
  tooltip?: string
}> = ({ label, value, subValue, icon, trend, accent = 'blue', tooltip }) => {
  const accentColors = {
    green: 'from-green-500/20 to-green-500/5 text-green-600 dark:text-green-400',
    blue: 'from-blue-500/20 to-blue-500/5 text-blue-600 dark:text-blue-400',
    purple: 'from-purple-500/20 to-purple-500/5 text-purple-600 dark:text-purple-400',
    orange: 'from-orange-500/20 to-orange-500/5 text-orange-600 dark:text-orange-400',
  }

  const content = (
    <GlassCard className="p-4 h-full" hover>
      <div className="flex items-start justify-between">
        <div className={cn('p-2 rounded-xl bg-gradient-to-br', accentColors[accent])}>{icon}</div>
        {trend && (
          <div
            className={cn(
              'flex items-center gap-0.5 text-xs font-medium',
              trend === 'up' && 'text-green-600',
              trend === 'down' && 'text-red-600',
            )}
          >
            <ArrowUpRight className={cn('w-3 h-3', trend === 'down' && 'rotate-90')} />
          </div>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        {subValue && <p className="text-xs text-muted-foreground mt-0.5">{subValue}</p>}
        <p className="text-sm text-muted-foreground mt-1">{label}</p>
      </div>
    </GlassCard>
  )

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs text-sm">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  return content
}

/** Rate comparison row with visual bar */
const RateRow: React.FC<{
  label: string
  icon: React.ReactNode
  youCharge: number
  providerCharges: number
  margin: number
}> = ({ label, icon, youCharge, providerCharges, margin }) => {
  const marginPercent = Math.min(Math.max((margin / youCharge) * 100, 0), 100)
  const isPositive = margin >= 0

  return (
    <div className="group py-3 px-4 rounded-xl hover:bg-muted/50 transition-colors">
      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 mb-2">
        {/* Column 1: Card type */}
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-muted">{icon}</div>
          <span className="font-medium text-sm">{label}</span>
        </div>
        {/* Column 2: Rate comparison */}
        <span className="text-sm text-muted-foreground text-right min-w-[120px]">
          <span className="text-foreground font-semibold">{(youCharge * 100).toFixed(2)}%</span>
          {' → '}
          {(providerCharges * 100).toFixed(2)}%
        </span>
        {/* Column 3: Margin */}
        <span
          className={cn(
            'text-sm font-bold min-w-[70px] text-right',
            isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
          )}
        >
          {isPositive ? '+' : ''}
          {(margin * 100).toFixed(2)}%
        </span>
      </div>
      {/* Visual margin bar */}
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            isPositive ? 'bg-gradient-to-r from-green-500 to-emerald-400' : 'bg-gradient-to-r from-red-500 to-orange-400',
          )}
          style={{ width: `${Math.abs(marginPercent)}%` }}
        />
      </div>
    </div>
  )
}

/** Profit Calculator with modern design - Collapsible */
const ProfitSimulator: React.FC<{
  pricing: VenuePricingStructure | null | undefined
  cost: (ProviderCostStructure & { accountType: string }) | null | undefined
}> = ({ pricing, cost }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [amount, setAmount] = useState('500')
  const [cardType, setCardType] = useState<'debit' | 'credit' | 'amex' | 'international'>('credit')

  const toNumber = (value: number | string | null | undefined) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  const transactionAmount = toNumber(amount)

  // Get rates based on card type
  const providerRate = cost
    ? cardType === 'debit'
      ? toNumber(cost.debitRate)
      : cardType === 'credit'
      ? toNumber(cost.creditRate)
      : cardType === 'amex'
      ? toNumber(cost.amexRate)
      : toNumber(cost.internationalRate)
    : 0

  const venueRate = pricing
    ? cardType === 'debit'
      ? toNumber(pricing.debitRate)
      : cardType === 'credit'
      ? toNumber(pricing.creditRate)
      : cardType === 'amex'
      ? toNumber(pricing.amexRate)
      : toNumber(pricing.internationalRate)
    : 0

  // Calculate fees
  const providerPercentageFee = transactionAmount * providerRate
  const providerFixedFee = toNumber(cost?.fixedCostPerTransaction)
  const totalProviderCost = providerPercentageFee + providerFixedFee

  const venuePercentageFee = transactionAmount * venueRate
  const venueFixedFee = toNumber(pricing?.fixedFeePerTransaction)
  const totalVenueCharge = venuePercentageFee + venueFixedFee

  const profit = totalVenueCharge - totalProviderCost
  const profitMargin = totalVenueCharge > 0 ? (profit / totalVenueCharge) * 100 : 0
  const isPositive = profit >= 0

  const cardTypes = [
    { value: 'debit', label: 'Débito', icon: <CreditCard className="w-4 h-4" />, color: 'green' },
    { value: 'credit', label: 'Crédito', icon: <CreditCard className="w-4 h-4" />, color: 'blue' },
    { value: 'amex', label: 'AMEX', icon: <CreditCard className="w-4 h-4" />, color: 'purple' },
    { value: 'international', label: 'Internacional', icon: <CreditCard className="w-4 h-4" />, color: 'orange' },
  ] as const

  const presetAmounts = [100, 500, 1000, 5000]

  if (!pricing || !cost) {
    return null
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <GlassCard>
        <CollapsibleTrigger asChild>
          <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5">
                <Calculator className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-medium text-sm">Simulador de Ganancia</h3>
                <p className="text-xs text-muted-foreground">Calcula tu ganancia por transacción</p>
              </div>
            </div>
            <ChevronRight className={cn('w-4 h-4 text-muted-foreground transition-transform', isOpen && 'rotate-90')} />
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-4">
            <div className="h-px bg-border/50" />

            <div className="grid grid-cols-12 gap-6">
              {/* Left side - Inputs */}
              <div className="col-span-12 lg:col-span-5 space-y-5">
                {/* Amount input */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-muted-foreground">Monto de la transacción</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="number"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      className="pl-9 h-12 text-lg font-semibold bg-muted/30 border-border/50"
                      placeholder="0.00"
                    />
                  </div>
                  {/* Preset amounts */}
                  <div className="flex gap-2">
                    {presetAmounts.map(preset => (
                      <button
                        key={preset}
                        onClick={() => setAmount(preset.toString())}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                          amount === preset.toString()
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground',
                        )}
                      >
                        ${preset.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Card type selector */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-muted-foreground">Tipo de tarjeta</label>
                  <div className="grid grid-cols-2 gap-2">
                    {cardTypes.map(card => (
                      <button
                        key={card.value}
                        onClick={() => setCardType(card.value)}
                        className={cn(
                          'flex items-center gap-2 p-3 rounded-xl border transition-all text-left',
                          cardType === card.value
                            ? 'border-primary bg-primary/5 text-foreground'
                            : 'border-border/50 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                        )}
                      >
                        <div className={cn('p-1.5 rounded-lg', cardType === card.value ? `bg-${card.color}-500/20` : 'bg-muted')}>
                          {card.icon}
                        </div>
                        <span className="text-sm font-medium">{card.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="hidden lg:flex col-span-1 items-center justify-center">
                <div className="h-full w-px bg-border/50" />
              </div>

              {/* Right side - Results */}
              <div className="col-span-12 lg:col-span-6 space-y-4">
                {/* Flow visualization */}
                <div className="flex items-center justify-between gap-2 p-4 rounded-xl bg-muted/30">
                  <div className="text-center flex-1">
                    <p className="text-xs text-muted-foreground mb-1">Cobras</p>
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{Currency(totalVenueCharge)}</p>
                    <p className="text-xs text-muted-foreground">
                      {(venueRate * 100).toFixed(2)}%{venueFixedFee > 0 ? ` + ${Currency(venueFixedFee)}` : ''}
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <div className="text-center flex-1">
                    <p className="text-xs text-muted-foreground mb-1">Te cobran</p>
                    <p className="text-lg font-bold text-red-600 dark:text-red-400">-{Currency(totalProviderCost)}</p>
                    <p className="text-xs text-muted-foreground">
                      {(providerRate * 100).toFixed(2)}%{providerFixedFee > 0 ? ` + ${Currency(providerFixedFee)}` : ''}
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <div className="text-center flex-1">
                    <p className="text-xs text-muted-foreground mb-1">Ganancia</p>
                    <p
                      className={cn(
                        'text-lg font-bold',
                        isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
                      )}
                    >
                      {isPositive ? '+' : ''}
                      {Currency(profit)}
                    </p>
                    <p className="text-xs text-muted-foreground">{profitMargin.toFixed(1)}% margen</p>
                  </div>
                </div>

                {/* Detailed breakdown */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/30 transition-colors">
                    <span className="text-sm text-muted-foreground">Comisión al venue ({(venueRate * 100).toFixed(2)}%)</span>
                    <span className="text-sm font-medium">{Currency(venuePercentageFee)}</span>
                  </div>
                  {venueFixedFee > 0 && (
                    <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/30 transition-colors">
                      <span className="text-sm text-muted-foreground">Tarifa fija al venue</span>
                      <span className="text-sm font-medium">{Currency(venueFixedFee)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/30 transition-colors">
                    <span className="text-sm text-muted-foreground">Costo del procesador ({(providerRate * 100).toFixed(2)}%)</span>
                    <span className="text-sm font-medium text-red-600 dark:text-red-400">-{Currency(providerPercentageFee)}</span>
                  </div>
                  {providerFixedFee > 0 && (
                    <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/30 transition-colors">
                      <span className="text-sm text-muted-foreground">Tarifa fija del procesador</span>
                      <span className="text-sm font-medium text-red-600 dark:text-red-400">-{Currency(providerFixedFee)}</span>
                    </div>
                  )}
                  <div className="h-px bg-border/50 my-2" />
                  <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/5">
                    <span className="text-sm font-medium">Tu ganancia neta</span>
                    <span
                      className={cn(
                        'text-lg font-bold',
                        isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
                      )}
                    >
                      {isPositive ? '+' : ''}
                      {Currency(profit)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </GlassCard>
    </Collapsible>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const VenuePaymentConfig: React.FC = () => {
  const { t } = useTranslation(['payment', 'common'])
  const { toast } = useToast()
  const { slug } = useParams<{ slug: string }>()
  const { getVenueBySlug, user } = useAuth()
  const queryClient = useQueryClient()
  const isSuperadmin = user?.role === 'SUPERADMIN'

  // Dialog states
  const [configDialogOpen, setConfigDialogOpen] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [pricingDialogOpen, setPricingDialogOpen] = useState(false)
  const [selectedPricing, setSelectedPricing] = useState<VenuePricingStructure | null>(null)
  const [selectedAccountType, setSelectedAccountType] = useState<'PRIMARY' | 'SECONDARY' | 'TERTIARY'>('PRIMARY')
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const venue = getVenueBySlug(slug!)

  // === DATA FETCHING ===

  const { data: paymentConfig, isLoading: configLoading } = useQuery({
    queryKey: ['venue-payment-config', venue?.id],
    queryFn: () => paymentProviderAPI.getVenuePaymentConfigByVenueId(venue!.id),
    enabled: !!venue?.id,
  })

  const { data: costStructures = [] } = useQuery({
    queryKey: ['venue-cost-structures', venue?.id],
    queryFn: () => paymentProviderAPI.getVenueCostStructuresByVenueId(venue!.id),
    enabled: !!venue?.id && !!paymentConfig,
  })

  const { data: pricingStructures = [] } = useQuery({
    queryKey: ['venue-pricing-structures', venue?.id],
    queryFn: () => paymentProviderAPI.getVenuePricingStructuresByVenueId(venue!.id),
    enabled: !!venue?.id && !!paymentConfig,
  })

  // === COMPUTED VALUES ===

  const primaryCost = useMemo(() => costStructures.find(c => c.accountType === 'PRIMARY'), [costStructures])
  const primaryPricing = useMemo(() => pricingStructures.find(p => p.accountType === 'PRIMARY' && p.active), [pricingStructures])

  const margins = useMemo(() => {
    if (!primaryCost || !primaryPricing) return null
    return {
      debit: Number(primaryPricing.debitRate) - Number(primaryCost.debitRate),
      credit: Number(primaryPricing.creditRate) - Number(primaryCost.creditRate),
      amex: Number(primaryPricing.amexRate) - Number(primaryCost.amexRate),
      international: Number(primaryPricing.internationalRate) - Number(primaryCost.internationalRate),
    }
  }, [primaryCost, primaryPricing])

  const averageMargin = margins ? ((margins.debit + margins.credit + margins.amex + margins.international) / 4) * 100 : 0

  const marginsHealthy = margins && margins.debit >= 0 && margins.credit >= 0

  // === MUTATIONS ===

  const createConfigMutation = useMutation({
    mutationFn: (data: any) => paymentProviderAPI.createVenuePaymentConfigByVenueId(venue!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venue-payment-config', venue?.id] })
      queryClient.invalidateQueries({ queryKey: ['payment-readiness', venue?.id] })
      toast({ title: t('common:success'), description: t('venuePaymentConfig.createSuccess') })
      setConfigDialogOpen(false)
    },
    onError: () => {
      toast({ title: t('common:error'), description: t('venuePaymentConfig.createError'), variant: 'destructive' })
    },
  })

  const updateConfigMutation = useMutation({
    mutationFn: (data: any) => paymentProviderAPI.updateVenuePaymentConfigByVenueId(venue!.id, paymentConfig!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venue-payment-config', venue?.id] })
      queryClient.invalidateQueries({ queryKey: ['payment-readiness', venue?.id] })
      toast({ title: t('common:success'), description: t('venuePaymentConfig.updateSuccess') })
      setConfigDialogOpen(false)
    },
    onError: () => {
      toast({ title: t('common:error'), description: t('venuePaymentConfig.updateError'), variant: 'destructive' })
    },
  })

  const deleteConfigMutation = useMutation({
    mutationFn: () => paymentProviderAPI.deleteVenuePaymentConfigByVenueId(venue!.id, paymentConfig!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venue-payment-config', venue?.id] })
      queryClient.invalidateQueries({ queryKey: ['venue-cost-structures', venue?.id] })
      queryClient.invalidateQueries({ queryKey: ['venue-pricing-structures', venue?.id] })
      queryClient.invalidateQueries({ queryKey: ['payment-readiness', venue?.id] })
      toast({ title: t('common:success'), description: t('venuePaymentConfig.deleteSuccess') })
    },
    onError: () => {
      toast({ title: t('common:error'), description: t('venuePaymentConfig.deleteError'), variant: 'destructive' })
    },
  })

  const createPricingMutation = useMutation({
    mutationFn: (data: any) => paymentProviderAPI.createVenuePricingStructure(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venue-pricing-structures', venue?.id] })
      queryClient.invalidateQueries({ queryKey: ['payment-readiness', venue?.id] })
      toast({ title: t('common:success'), description: t('venuePaymentConfig.createSuccess') })
      setPricingDialogOpen(false)
    },
    onError: () => {
      toast({ title: t('common:error'), description: t('venuePaymentConfig.createError'), variant: 'destructive' })
    },
  })

  // === HANDLERS ===

  const handleSaveConfig = async (data: any) => {
    if (paymentConfig) {
      await updateConfigMutation.mutateAsync(data)
    } else {
      await createConfigMutation.mutateAsync(data)
    }
  }

  const handleDeleteConfig = async () => {
    if (confirm(t('venuePaymentConfig.confirmDelete'))) {
      await deleteConfigMutation.mutateAsync()
    }
  }

  const handleEditPricing = (pricing: VenuePricingStructure) => {
    setSelectedPricing(pricing)
    setSelectedAccountType(pricing.accountType)
    setPricingDialogOpen(true)
  }

  const handleCreatePricing = (accountType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY') => {
    setSelectedPricing(null)
    setSelectedAccountType(accountType)
    setPricingDialogOpen(true)
  }

  const handleSavePricing = async (data: any) => {
    await createPricingMutation.mutateAsync(data)
  }

  // === LOADING STATE ===

  if (configLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-muted" />
            <div className="absolute top-0 left-0 w-16 h-16 rounded-full border-4 border-t-primary animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">Cargando configuración...</p>
        </div>
      </div>
    )
  }

  // === EMPTY STATE ===

  if (!paymentConfig) {
    return (
      <TooltipProvider>
        <div className="p-6 max-w-4xl mx-auto">
          <GlassCard className="p-12">
            <div className="flex flex-col items-center text-center space-y-6">
              {/* Animated icon */}
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl animate-pulse" />
                <div className="relative p-6 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
                  <Wallet className="w-12 h-12 text-primary" />
                </div>
              </div>

              <div className="space-y-2 max-w-md">
                <h2 className="text-2xl font-bold">Conecta los Pagos</h2>
                <p className="text-muted-foreground">
                  Vincula una cuenta de procesamiento para que este venue pueda aceptar pagos con tarjeta.
                </p>
              </div>

              {/* Features list */}
              <div className="grid grid-cols-3 gap-4 w-full max-w-lg pt-4">
                <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-muted/50">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  <span className="text-xs text-center">Activación instantánea</span>
                </div>
                <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-muted/50">
                  <Shield className="w-5 h-5 text-green-500" />
                  <span className="text-xs text-center">Pagos seguros PCI</span>
                </div>
                <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-muted/50">
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                  <span className="text-xs text-center">Reportes en tiempo real</span>
                </div>
              </div>

              <div className="flex flex-col items-center gap-3 mt-4">
                {isSuperadmin && (
                  <Button size="lg" onClick={() => setWizardOpen(true)} className="gap-2">
                    <Settings className="w-4 h-4" />
                    Wizard de Pagos
                  </Button>
                )}
                <Button size="lg" variant={isSuperadmin ? 'outline' : 'default'} onClick={() => setConfigDialogOpen(true)} className="gap-2">
                  <Sparkles className="w-4 h-4" />
                  Conectar Cuenta de Pagos
                </Button>
              </div>
            </div>
          </GlassCard>

          {/* Superadmin Payment Setup Wizard (empty state) */}
          {isSuperadmin && venue && (
            <PaymentSetupWizard
              open={wizardOpen}
              onClose={() => {
                setWizardOpen(false)
                queryClient.invalidateQueries({ queryKey: ['venue-payment-config', venue.id] })
              }}
              target={{
                type: 'venue',
                venueId: venue.id,
                venueName: venue.name,
                venueSlug: slug!,
              }}
            />
          )}

          <VenuePaymentConfigDialog
            open={configDialogOpen}
            onOpenChange={setConfigDialogOpen}
            config={null}
            venueId={venue!.id}
            onSave={handleSaveConfig}
          />
        </div>
      </TooltipProvider>
    )
  }

  // === MAIN CONTENT ===

  const primaryAccount = paymentConfig.primaryAccount
  const hasBackupAccounts = paymentConfig.secondaryAccount || paymentConfig.tertiaryAccount

  return (
    <TooltipProvider>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* === HEADER === */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Configuración de Pagos</h1>
            <p className="text-muted-foreground text-sm mt-1">Gestiona el procesamiento de pagos para este venue</p>
          </div>
          <div className="flex items-center gap-3">
            {isSuperadmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWizardOpen(true)}
                className="gap-2"
              >
                <Settings className="w-4 h-4" />
                Wizard de Pagos
              </Button>
            )}
            <div className="flex items-center gap-2">
              <StatusPulse status={marginsHealthy ? 'success' : marginsHealthy === false ? 'error' : 'neutral'} />
              <span className="text-sm font-medium">
                {marginsHealthy ? 'Operativo' : marginsHealthy === false ? 'Revisar márgenes' : 'Configurando'}
              </span>
            </div>
          </div>
        </div>

        {/* Superadmin Payment Setup Wizard */}
        {isSuperadmin && venue && (
          <PaymentSetupWizard
            open={wizardOpen}
            onClose={() => {
              setWizardOpen(false)
              queryClient.invalidateQueries({ queryKey: ['venue-payment-config', venue.id] })
              queryClient.invalidateQueries({ queryKey: ['venue-cost-structures', venue.id] })
              queryClient.invalidateQueries({ queryKey: ['venue-pricing-structures', venue.id] })
            }}
            target={{
              type: 'venue',
              venueId: venue.id,
              venueName: venue.name,
              venueSlug: slug!,
            }}
          />
        )}

        {/* === BENTO GRID === */}
        <div className="grid grid-cols-12 gap-4">
          {/* Main Account Card - Spans 8 columns */}
          <GlassCard className="col-span-12 lg:col-span-8 p-6" hover onClick={() => setConfigDialogOpen(true)}>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/10">
                  <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">{primaryAccount?.displayName || primaryAccount?.alias}</h3>
                    <Badge variant="outline" className="text-xs">
                      {primaryAccount?.provider?.name}
                    </Badge>
                    {primaryAccount?.blumonEnvironment && (
                      <Badge variant={primaryAccount.blumonEnvironment === 'PRODUCTION' ? 'default' : 'secondary'} className="text-xs">
                        {primaryAccount.blumonEnvironment}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">Cuenta principal de procesamiento</p>
                  <p className="text-xs text-muted-foreground font-mono mt-2">ID: {primaryAccount?.externalMerchantId}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {/* Quick stats row */}
            {hasBackupAccounts && (
              <div className="mt-4 pt-4 border-t border-border/50 flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-muted-foreground">{paymentConfig.secondaryAccount ? '1 cuenta de respaldo' : 'Sin respaldo'}</span>
                </div>
                {paymentConfig.tertiaryAccount && (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                    <span className="text-muted-foreground">+1 terciaria</span>
                  </div>
                )}
              </div>
            )}
          </GlassCard>

          {/* Metric Cards - Span 4 columns total */}
          <div className="col-span-12 lg:col-span-4 grid grid-cols-2 gap-4">
            <MetricCard
              label="Margen Promedio"
              value={`${averageMargin.toFixed(2)}%`}
              icon={<TrendingUp className="w-4 h-4" />}
              accent={averageMargin >= 0 ? 'green' : 'orange'}
              trend={averageMargin >= 0 ? 'up' : 'down'}
              tooltip="Promedio de tu margen en todos los tipos de tarjeta"
            />
            <MetricCard
              label="Tarifa Fija"
              value={`$${Number(primaryPricing?.fixedFeePerTransaction || 0).toFixed(2)}`}
              subValue="por transacción"
              icon={<CircleDollarSign className="w-4 h-4" />}
              accent="blue"
              tooltip="Monto fijo que cobras por cada transacción"
            />
          </div>
        </div>

        {/* === RATE COMPARISON CARD === */}
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
                <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold">Comparación de Tarifas</h3>
                <p className="text-sm text-muted-foreground">Lo que cobras vs lo que te cobran</p>
              </div>
            </div>
            {primaryPricing && (
              <Button variant="outline" size="sm" onClick={() => handleEditPricing(primaryPricing)}>
                Editar Tarifas
              </Button>
            )}
          </div>

          {!primaryPricing || !primaryCost ? (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="p-4 rounded-full bg-yellow-500/10 mb-4">
                <AlertCircle className="w-8 h-8 text-yellow-500" />
              </div>
              <h4 className="font-medium">Tarifas no configuradas</h4>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Define las tarifas que cobrarás a este venue para calcular tus márgenes
              </p>
              <Button onClick={() => handleCreatePricing('PRIMARY')} className="mt-4" size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Configurar Tarifas
              </Button>
            </div>
          ) : (
            <div className="space-y-1">
              {/* Column headers - matches RateRow grid */}
              <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-4 py-2 text-xs font-medium text-muted-foreground">
                <div>Tipo de Tarjeta</div>
                <div className="text-right min-w-[120px]">Tu tarifa → Costo</div>
                <div className="text-right min-w-[70px]">Tu Margen</div>
              </div>

              <RateRow
                label="Débito"
                icon={<CreditCard className="w-4 h-4 text-green-500" />}
                youCharge={Number(primaryPricing.debitRate)}
                providerCharges={Number(primaryCost.debitRate)}
                margin={margins!.debit}
              />
              <RateRow
                label="Crédito"
                icon={<CreditCard className="w-4 h-4 text-blue-500" />}
                youCharge={Number(primaryPricing.creditRate)}
                providerCharges={Number(primaryCost.creditRate)}
                margin={margins!.credit}
              />
              <RateRow
                label="AMEX"
                icon={<CreditCard className="w-4 h-4 text-purple-500" />}
                youCharge={Number(primaryPricing.amexRate)}
                providerCharges={Number(primaryCost.amexRate)}
                margin={margins!.amex}
              />
              <RateRow
                label="Internacional"
                icon={<CreditCard className="w-4 h-4 text-orange-500" />}
                youCharge={Number(primaryPricing.internationalRate)}
                providerCharges={Number(primaryCost.internationalRate)}
                margin={margins!.international}
              />
            </div>
          )}
        </GlassCard>

        {/* === PROFIT SIMULATOR === */}
        <ProfitSimulator pricing={primaryPricing} cost={primaryCost} />

        {/* === ADVANCED SETTINGS === */}
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <GlassCard>
            <CollapsibleTrigger asChild>
              <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-muted">
                    <Settings className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm">Configuración Avanzada</h3>
                    <p className="text-xs text-muted-foreground">Cuentas de respaldo y opciones adicionales</p>
                  </div>
                </div>
                <ChevronRight className={cn('w-4 h-4 text-muted-foreground transition-transform', advancedOpen && 'rotate-90')} />
              </div>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div className="px-4 pb-4 space-y-4">
                <div className="h-px bg-border/50" />

                {/* Backup accounts */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Cuenta Secundaria</span>
                      <Badge variant="secondary" className="text-xs">
                        Fallback #1
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{paymentConfig.secondaryAccount?.displayName || 'No configurada'}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Cuenta Terciaria</span>
                      <Badge variant="outline" className="text-xs">
                        Fallback #2
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{paymentConfig.tertiaryAccount?.displayName || 'No configurada'}</p>
                  </div>
                </div>

                <Button variant="outline" size="sm" onClick={() => setConfigDialogOpen(true)}>
                  <Settings className="w-4 h-4 mr-1" />
                  Modificar Cuentas
                </Button>

                {/* Danger zone */}
                <div className="pt-4">
                  <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-red-600 dark:text-red-400">Eliminar Configuración</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">Esta acción no se puede deshacer</p>
                      </div>
                      <Button variant="destructive" size="sm" onClick={handleDeleteConfig} disabled={deleteConfigMutation.isPending}>
                        <Trash2 className="w-4 h-4 mr-1" />
                        {deleteConfigMutation.isPending ? 'Eliminando...' : 'Eliminar'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </GlassCard>
        </Collapsible>

        {/* === DIALOGS === */}
        <VenuePaymentConfigDialog
          open={configDialogOpen}
          onOpenChange={setConfigDialogOpen}
          config={paymentConfig}
          venueId={venue!.id}
          onSave={handleSaveConfig}
        />

        <VenuePricingDialog
          open={pricingDialogOpen}
          onOpenChange={setPricingDialogOpen}
          pricing={selectedPricing}
          accountType={selectedAccountType}
          venueId={venue!.id}
          onSave={handleSavePricing}
        />
      </div>
    </TooltipProvider>
  )
}

export default VenuePaymentConfig
