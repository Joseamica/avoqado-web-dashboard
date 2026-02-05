import api from '@/api'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/context/AuthContext'
import { useSocket } from '@/context/SocketContext'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import {
  addVenueFeatures,
  getVenueFeatures,
  removeVenueFeature,
  type VenueFeatureStatus,
} from '@/services/features.service'
import { StaffRole } from '@/types'

// Lazy load superadmin service - only imported when needed
const loadSuperadminService = () => import('@/services/superadmin.service')
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  CreditCard,
  Gift,
  Plus,
  Power,
  Shield,
  Sparkles,
  X,
  Zap,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useVenueDateTime } from '@/utils/datetime'
import { PaymentMethodsSection } from '../components/PaymentMethodsSection'

export default function Subscriptions() {
  const { t, i18n } = useTranslation('billing')
  const { venueId, venue } = useCurrentVenue()
  const { staffInfo } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { socket } = useSocket()
  const { formatDate } = useVenueDateTime()

  // Check if user is superadmin
  // IMPORTANT: Use staffInfo.role (venue-specific) not user.role (highest across all venues)
  const isSuperadmin = staffInfo?.role === StaffRole.SUPERADMIN

  // Only users with billing access (ADMIN and above) can view subscriptions
  const canViewBilling = staffInfo?.role && [
    StaffRole.SUPERADMIN,
    StaffRole.OWNER,
    StaffRole.ADMIN,
    StaffRole.MANAGER,
  ].includes(staffInfo.role as StaffRole)

  const [cancelingFeatureId, setCancelingFeatureId] = useState<string | null>(null)
  const [subscribingFeatureCode, setSubscribingFeatureCode] = useState<string | null>(null)
  const [pendingSubscriptionFeatureCode, setPendingSubscriptionFeatureCode] = useState<string | null>(null)
  const [showAddPaymentDialog, setShowAddPaymentDialog] = useState(false)

  // Superadmin state
  const [showGrantTrialDialog, setShowGrantTrialDialog] = useState(false)
  const [grantTrialFeatureCode, setGrantTrialFeatureCode] = useState<string>('')
  const [grantTrialDays, setGrantTrialDays] = useState<number>(7)
  const [showEnableFeatureDialog, setShowEnableFeatureDialog] = useState(false)
  const [enableFeatureCode, setEnableFeatureCode] = useState<string>('')
  const [disablingFeatureCode, setDisablingFeatureCode] = useState<string | null>(null)

  // Fetch venue features status (only for users with billing access)
  const { data: featuresStatus, isLoading: loadingFeatures } = useQuery<VenueFeatureStatus>({
    queryKey: ['venueFeatures', venueId],
    queryFn: () => getVenueFeatures(venueId),
    enabled: !!venueId && canViewBilling,
  })

  // Fetch payment methods (for subscription dialog validation, only for users with billing access)
  const { data: paymentMethods } = useQuery<
    Array<{
      id: string
      card: {
        brand: string
        last4: string
        exp_month: number
        exp_year: number
      }
    }>
  >({
    queryKey: ['paymentMethods', venueId],
    queryFn: async () => {
      const response = await api.get(`/api/v1/dashboard/venues/${venueId}/payment-methods`)
      return response.data.data
    },
    enabled: !!venueId && canViewBilling,
  })

  // Superadmin: Fetch all platform features (lazy loaded)
  const { data: allPlatformFeatures, isLoading: isLoadingPlatformFeatures, error: _platformFeaturesError } = useQuery({
    queryKey: ['superadmin', 'features'],
    queryFn: async () => {
      const service = await loadSuperadminService()
      return service.getAllFeatures()
    },
    enabled: isSuperadmin,
  })

  // Memoized list of features available for superadmin to enable/grant trial
  // Shows ALL platform features that are NOT already active for this venue
  const superadminFeatureOptions = useMemo(() => {
    // If we have platform features, filter out active ones
    if (allPlatformFeatures && allPlatformFeatures.length > 0) {
      const activeCodes = new Set(
        featuresStatus?.activeFeatures.map(f => f.feature.code) || []
      )

      // Note: Backend already filters by active=true, so we only need to filter out
      // features that are already active for this venue
      return allPlatformFeatures
        .filter(f => !activeCodes.has(f.code))
        .map(f => ({
          id: f.id,
          code: f.code,
          name: f.name,
          description: f.description,
          monthlyPrice: f.monthlyPrice || f.basePrice || 0,
          stripeProductId: '',
          stripePriceId: '',
          hadPreviously: false,
        }))
    }

    // Fallback to venue's available features if platform features not loaded
    if (featuresStatus?.availableFeatures) {
      return [...featuresStatus.availableFeatures]
    }

    return []
  }, [allPlatformFeatures, featuresStatus])

  // Socket.IO listener for real-time subscription updates
  useEffect(() => {
    if (!socket || !venueId) return

    const handleSubscriptionActivated = (data: any) => {
      toast({
        title: t('toast.paymentSuccess'),
        description: t('toast.paymentSuccessDescription', { feature: data.featureCode }),
        variant: 'default',
      })
      queryClient.invalidateQueries({ queryKey: ['venueFeatures', venueId] })
      queryClient.invalidateQueries({ queryKey: ['venueInvoices', venueId] })
    }

    const handleSubscriptionDeactivated = (data: any) => {
      toast({
        title: t('toast.subscriptionDeactivated'),
        description: t('toast.subscriptionDeactivatedDescription', { feature: data.featureCode }),
        variant: 'destructive',
      })
      queryClient.invalidateQueries({ queryKey: ['venueFeatures', venueId] })
      queryClient.invalidateQueries({ queryKey: ['venueInvoices', venueId] })
    }

    socket.on('subscription.activated', handleSubscriptionActivated)
    socket.on('subscription.deactivated', handleSubscriptionDeactivated)

    return () => {
      socket.off('subscription.activated', handleSubscriptionActivated)
      socket.off('subscription.deactivated', handleSubscriptionDeactivated)
    }
  }, [socket, venueId, queryClient, toast, t])

  // Reopen subscription dialog after adding payment method
  useEffect(() => {
    if (pendingSubscriptionFeatureCode && paymentMethods && paymentMethods.length > 0) {
      setShowAddPaymentDialog(false)
      setSubscribingFeatureCode(pendingSubscriptionFeatureCode)
      setPendingSubscriptionFeatureCode(null)
    }
  }, [paymentMethods, pendingSubscriptionFeatureCode])

  // Cancel subscription mutation
  const cancelMutation = useMutation({
    mutationFn: (featureId: string) => removeVenueFeature(venueId, featureId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venueFeatures', venueId] })
      toast({
        title: t('toast.cancelSuccess'),
        variant: 'default',
      })
      setCancelingFeatureId(null)
    },
    onError: () => {
      toast({
        title: t('toast.cancelError'),
        variant: 'destructive',
      })
    },
  })

  // Activate feature mutation
  const activateMutation = useMutation({
    mutationFn: ({ featureCode, trialPeriodDays }: { featureCode: string; trialPeriodDays: number }) =>
      addVenueFeatures(venueId, {
        featureCodes: [featureCode],
        trialPeriodDays,
      }),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: ['venueFeatures', venueId] })
      const isTrial = variables.trialPeriodDays > 0

      // Check if the feature was immediately activated (payment succeeded)
      // Response format: { success, data: VenueFeature[], summary: { active, pending } }
      const featuresArray = Array.isArray(response) ? response : (response as any)?.data
      const isImmediatelyActive = Array.isArray(featuresArray) && featuresArray.some(vf => vf.active === true)

      if (isTrial) {
        // Trial activation - always shows success
        toast({
          title: t('toast.activateSuccessGeneric'),
          description: t('toast.activateSuccessDescription'),
          variant: 'default',
        })
      } else if (isImmediatelyActive) {
        // Payment succeeded and feature is already active
        toast({
          title: t('toast.subscriptionActivated'),
          description: t('toast.subscriptionActivatedDescription'),
          variant: 'default',
        })
      } else {
        // Payment still processing (rare case, webhook will handle)
        toast({
          title: t('toast.activateProcessing'),
          description: t('toast.activateProcessingDescription'),
          variant: 'default',
        })
      }

      setSubscribingFeatureCode(null)
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.error || error.message || t('toast.activateError')
      toast({
        title: t('toast.activateError'),
        description: errorMessage,
        variant: 'destructive',
      })
      setSubscribingFeatureCode(null)
    },
  })

  // Superadmin: Enable feature for venue (without payment) - lazy loaded
  const superadminEnableMutation = useMutation({
    mutationFn: async (featureCode: string) => {
      const service = await loadSuperadminService()
      return service.enableFeatureForVenue(venueId, featureCode)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venueFeatures', venueId] })
      toast({
        title: t('superadmin.toast.enableSuccess', { defaultValue: 'Feature enabled' }),
        description: t('superadmin.toast.enableSuccessDesc', { defaultValue: 'Feature has been enabled for this venue' }),
        variant: 'default',
      })
      setShowEnableFeatureDialog(false)
      setEnableFeatureCode('')
    },
    onError: (error: any) => {
      toast({
        title: t('superadmin.toast.enableError', { defaultValue: 'Failed to enable feature' }),
        description: error.response?.data?.error || error.message,
        variant: 'destructive',
      })
    },
  })

  // Superadmin: Disable feature for venue - lazy loaded
  const superadminDisableMutation = useMutation({
    mutationFn: async (featureCode: string) => {
      const service = await loadSuperadminService()
      return service.disableFeatureForVenue(venueId, featureCode)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venueFeatures', venueId] })
      toast({
        title: t('superadmin.toast.disableSuccess', { defaultValue: 'Feature disabled' }),
        description: t('superadmin.toast.disableSuccessDesc', { defaultValue: 'Feature has been disabled for this venue' }),
        variant: 'default',
      })
      setDisablingFeatureCode(null)
    },
    onError: (error: any) => {
      toast({
        title: t('superadmin.toast.disableError', { defaultValue: 'Failed to disable feature' }),
        description: error.response?.data?.error || error.message,
        variant: 'destructive',
      })
      setDisablingFeatureCode(null)
    },
  })

  /// Superadmin: Grant DB-only trial to venue (always bypasses Stripe)
  /// This allows superadmin to give trials even to "returning" users who already had the feature
  /// When trial expires, user can subscribe normally via Stripe (with payment, no trial)
  const superadminGrantTrialMutation = useMutation({
    mutationFn: async ({ featureCode, days }: { featureCode: string; days: number }) => {
      // Always use DB-only trial for superadmin grants
      // This bypasses Stripe's "returning feature" logic that prevents re-trials
      const superadminService = await loadSuperadminService()
      return superadminService.grantTrialForVenue(venueId, featureCode, days)
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['venueFeatures', venueId] })
      toast({
        title: t('superadmin.toast.trialGranted', { defaultValue: 'Trial granted' }),
        description: t('superadmin.toast.trialGrantedDesc', {
          defaultValue: '{{days}}-day trial has been granted',
          days: variables.days,
        }),
        variant: 'default',
      })
      setShowGrantTrialDialog(false)
      setGrantTrialFeatureCode('')
      setGrantTrialDays(7)
    },
    onError: (error: any) => {
      toast({
        title: t('superadmin.toast.trialError', { defaultValue: 'Failed to grant trial' }),
        description: error.response?.data?.error || error.message,
        variant: 'destructive',
      })
    },
  })

  // Check if venue has payment method (required for Stripe trial)
  const venueHasPaymentMethod = useMemo(() => {
    return (paymentMethods && paymentMethods.length > 0) || !!featuresStatus?.paymentMethod?.last4
  }, [paymentMethods, featuresStatus?.paymentMethod])

  // Helper function to switch from grant trial to enable feature (when no PM)
  const handleSwitchToEnableFeature = () => {
    const selectedFeature = grantTrialFeatureCode
    setShowGrantTrialDialog(false)
    setGrantTrialFeatureCode('')
    setEnableFeatureCode(selectedFeature)
    setShowEnableFeatureDialog(true)
  }

  // Helper functions
  const getCardBrand = (brand: string) => {
    const brandLower = brand.toLowerCase()
    const brandKey = `paymentMethods.cardBrand.${brandLower}` as const
    return t(brandKey) || t('paymentMethods.cardBrand.unknown')
  }

  const formatCurrency = (amount: number, currency: string = 'MXN') => {
    return new Intl.NumberFormat(i18n.language, {
      style: 'currency',
      currency,
    }).format(amount / 100)
  }

  const getStatusBadge = (feature: VenueFeatureStatus['activeFeatures'][0]) => {
    const now = new Date()
    const endDate = feature.endDate ? new Date(feature.endDate) : null

    if (endDate && endDate > now) {
      return <Badge variant="secondary">{t('activeSubscriptions.trial')}</Badge>
    } else if (feature.active && !endDate) {
      return <Badge variant="default">{t('activeSubscriptions.active')}</Badge>
    } else {
      return <Badge variant="destructive">{t('activeSubscriptions.canceled')}</Badge>
    }
  }

  const getBillingInfoCompact = (feature: VenueFeatureStatus['activeFeatures'][0]) => {
    const now = new Date()
    const endDate = feature.endDate ? new Date(feature.endDate) : null

    if (endDate && endDate > now) {
      return (
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {t('activeSubscriptions.trialEnds', { date: formatDate(endDate) })}
        </span>
      )
    } else if (!endDate) {
      const nextMonth = new Date()
      nextMonth.setMonth(nextMonth.getMonth() + 1)
      return (
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {t('activeSubscriptions.nextBilling', { date: formatDate(nextMonth) })}
        </span>
      )
    } else {
      return (
        <span className="flex items-center gap-1 text-destructive">
          <AlertCircle className="h-3 w-3" />
          {t('activeSubscriptions.canceledOn', { date: formatDate(endDate) })}
        </span>
      )
    }
  }

  if (loadingFeatures) {
    return (
      <div className="p-8">
        <p>{t('loading')}</p>
      </div>
    )
  }

  return (
    <>
      <div className="p-8 space-y-6">
        {/* Superadmin Feature Management Panel */}
        {isSuperadmin && (
          <Card className="border-2 border-amber-400/50 bg-gradient-to-r from-amber-500/10 to-pink-500/10 dark:from-amber-500/20 dark:to-pink-500/20">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-r from-amber-400 to-pink-500 shadow-lg">
                    <Shield className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-lg bg-gradient-to-r from-amber-500 to-pink-500 bg-clip-text text-transparent font-bold">
                      {t('superadmin.panel.title', { defaultValue: 'Superadmin Feature Control' })}
                    </CardTitle>
                    <CardDescription className="text-sm">
                      {t('superadmin.panel.description', {
                        defaultValue: 'Manage features for {{venue}} directly',
                        venue: venue?.name || 'this venue',
                      })}
                    </CardDescription>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="border-amber-400/50 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  {t('superadmin.panel.badge', { defaultValue: 'Admin Mode' })}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {/* Quick Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {/* Grant Trial */}
                <button
                  onClick={() => setShowGrantTrialDialog(true)}
                  className="group flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-amber-400/30 hover:border-amber-400/60 bg-gradient-to-br from-amber-500/5 to-pink-500/5 hover:from-amber-500/10 hover:to-pink-500/10 transition-all duration-200 cursor-pointer"
                >
                  <div className="p-2 rounded-lg bg-gradient-to-r from-amber-400 to-pink-500 group-hover:shadow-md transition-shadow">
                    <Gift className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-foreground">
                      {t('superadmin.actions.grantTrial', { defaultValue: 'Grant Trial' })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('superadmin.actions.grantTrialDesc', { defaultValue: 'Give free trial period' })}
                    </p>
                  </div>
                </button>

                {/* Enable Feature */}
                <button
                  onClick={() => setShowEnableFeatureDialog(true)}
                  className="group flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-amber-400/30 hover:border-amber-400/60 bg-gradient-to-br from-amber-500/5 to-pink-500/5 hover:from-amber-500/10 hover:to-pink-500/10 transition-all duration-200 cursor-pointer"
                >
                  <div className="p-2 rounded-lg bg-gradient-to-r from-amber-400 to-pink-500 group-hover:shadow-md transition-shadow">
                    <Zap className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-foreground">
                      {t('superadmin.actions.enableFeature', { defaultValue: 'Enable Feature' })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('superadmin.actions.enableFeatureDesc', { defaultValue: 'Activate without payment' })}
                    </p>
                  </div>
                </button>

                {/* Quick Stats */}
                <div className="flex items-center gap-3 p-4 rounded-xl border border-border/50 bg-muted/30">
                  <div className="p-2 rounded-lg bg-muted">
                    <Power className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-foreground">
                      {featuresStatus?.activeFeatures.length || 0}{' '}
                      {t('superadmin.stats.activeFeatures', { defaultValue: 'Active' })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {featuresStatus?.availableFeatures.length || 0}{' '}
                      {t('superadmin.stats.available', { defaultValue: 'available to add' })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Active Features with Superadmin Controls */}
              {featuresStatus?.activeFeatures && featuresStatus.activeFeatures.length > 0 && (
                <>
                  <Separator className="my-4 bg-amber-400/20" />
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      {t('superadmin.activeFeatures.title', { defaultValue: 'Active Features Control' })}
                    </h4>
                    <div className="grid gap-2">
                      {featuresStatus.activeFeatures.map(feature => (
                        <div
                          key={feature.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/50 hover:border-amber-400/30 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={feature.active}
                                onCheckedChange={checked => {
                                  if (!checked) {
                                    setDisablingFeatureCode(feature.feature.code)
                                  }
                                }}
                                className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-amber-400 data-[state=checked]:to-pink-500"
                              />
                            </div>
                            <div>
                              <p className="text-sm font-medium">{feature.feature.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {feature.endDate
                                  ? t('superadmin.activeFeatures.trialUntil', {
                                      defaultValue: 'Trial until {{date}}',
                                      date: formatDate(feature.endDate),
                                    })
                                  : t('superadmin.activeFeatures.fullyActive', { defaultValue: 'Fully active' })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {formatCurrency(Number(feature.monthlyPrice) * 100, 'MXN')}/mo
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Disclaimer */}
              <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-400/30">
                <p className="text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  {t('superadmin.disclaimer', {
                    defaultValue:
                      'Changes made here only affect this venue. For platform-wide feature management, use the Superadmin dashboard.',
                  })}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Subscriptions Grid - Active features first, then available */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Active subscriptions */}
          {featuresStatus?.activeFeatures.map(feature => (
            <div key={feature.id} className="premium-border h-full">
              <Card className="relative overflow-hidden transition-shadow hover:shadow-md border-0 h-full flex flex-col">
                {/* Status badge */}
                {getStatusBadge(feature) && (
                  <div className="absolute top-3 right-3">
                    {getStatusBadge(feature)}
                  </div>
                )}
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{feature.feature.name}</CardTitle>
                  <CardDescription className="text-xs line-clamp-2">{feature.feature.description}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0 space-y-3 flex-1 flex flex-col">
                  {/* Price */}
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold">{formatCurrency(Number(feature.monthlyPrice) * 100, 'MXN')}</span>
                    <span className="text-xs text-muted-foreground">{t('activeSubscriptions.perMonth')}</span>
                  </div>
                  {/* Billing info compact */}
                  <div className="text-xs text-muted-foreground">
                    {getBillingInfoCompact(feature)}
                  </div>
                  {/* Spacer to push button to bottom */}
                  <div className="flex-1" />
                  {/* Cancel button */}
                  {feature.active && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-auto"
                      onClick={() => setCancelingFeatureId(feature.featureId)}
                      disabled={cancelMutation.isPending}
                    >
                      {cancelMutation.isPending ? t('activeSubscriptions.managingButton') : t('activeSubscriptions.cancelButton')}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          ))}

          {/* Available features */}
          {featuresStatus?.availableFeatures.map(feature => (
            <Card key={feature.id} className="relative overflow-hidden transition-shadow hover:shadow-md h-full flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{feature.name}</CardTitle>
                <CardDescription className="text-xs line-clamp-2">{feature.description}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 space-y-3 flex-1 flex flex-col">
                {/* Price */}
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold">{formatCurrency(Number(feature.monthlyPrice) * 100, 'MXN')}</span>
                  <span className="text-xs text-muted-foreground">{t('availableFeatures.perMonth')}</span>
                </div>
                {/* Spacer to push button to bottom */}
                <div className="flex-1" />
                {/* Subscribe button */}
                <Button
                  size="sm"
                  className="w-full mt-auto"
                  onClick={() => setSubscribingFeatureCode(feature.code)}
                  disabled={activateMutation.isPending}
                >
                  {activateMutation.isPending
                    ? t('availableFeatures.subscribing')
                    : feature.hadPreviously
                      ? t('availableFeatures.subscribeNoTrial')
                      : t('availableFeatures.startTrial', { days: 2 })}
                </Button>
              </CardContent>
            </Card>
          ))}

          {/* Empty state */}
          {(!featuresStatus?.activeFeatures.length && !featuresStatus?.availableFeatures.length) && (
            <div className="col-span-full">
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium">{t('availableFeatures.noFeatures')}</p>
                  <p className="text-sm text-muted-foreground mt-1">{t('availableFeatures.description')}</p>
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>
      </div>

      {/* Subscribe Confirmation Dialog */}
      <AlertDialog open={!!subscribingFeatureCode} onOpenChange={() => setSubscribingFeatureCode(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirmSubscribe.title')}</AlertDialogTitle>
            {subscribingFeatureCode &&
              (() => {
                const feature = featuresStatus?.availableFeatures.find(f => f.code === subscribingFeatureCode)
                if (!feature) return null
                const hasHadBefore = feature.hadPreviously
                const price = formatCurrency(Number(feature.monthlyPrice) * 100, 'MXN')
                const days = 2
                return (
                  <AlertDialogDescription>
                    {hasHadBefore
                      ? t('confirmSubscribe.description', { feature: feature.name, price })
                      : t('confirmSubscribe.descriptionWithTrial', { feature: feature.name, price, days })}
                  </AlertDialogDescription>
                )
              })()}
          </AlertDialogHeader>
          {subscribingFeatureCode &&
            (() => {
              const feature = featuresStatus?.availableFeatures.find(f => f.code === subscribingFeatureCode)
              if (!feature) return null

              const hasHadBefore = feature.hadPreviously

              return (
                <div className="space-y-4 px-6 pb-2">
                  {/* Payment Method Section */}
                  <div className="border border-border rounded-lg p-4 bg-muted/50">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">{t('confirmSubscribe.paymentMethod')}</p>
                      {!paymentMethods?.length && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setPendingSubscriptionFeatureCode(subscribingFeatureCode)
                            setSubscribingFeatureCode(null)
                            setShowAddPaymentDialog(true)
                          }}
                        >
                          {t('confirmSubscribe.addPaymentMethod')}
                        </Button>
                      )}
                    </div>
                    {paymentMethods && paymentMethods.length > 0 ? (
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-12 h-8 bg-background border border-border rounded">
                          <CreditCard className="h-5 w-5 text-muted-foreground" />
                        </div>
                        {(() => {
                          const defaultMethod =
                            paymentMethods.find(pm => featuresStatus?.paymentMethod?.last4 === pm.card.last4) || paymentMethods[0]
                          return (
                            <div>
                              <p className="text-sm font-medium">
                                {getCardBrand(defaultMethod.card.brand)} •••• {defaultMethod.card.last4}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {t('confirmSubscribe.cardExpires', {
                                  month: String(defaultMethod.card.exp_month).padStart(2, '0'),
                                  year: defaultMethod.card.exp_year,
                                })}
                              </p>
                            </div>
                          )
                        })()}
                      </div>
                    ) : (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">{t('confirmSubscribe.noPaymentMethod')}</AlertDescription>
                      </Alert>
                    )}
                  </div>

                  {/* Warning/Info Banner */}
                  <Alert variant={hasHadBefore ? 'destructive' : 'default'}>
                    <AlertDescription className="text-sm font-medium">
                      {hasHadBefore ? t('confirmSubscribe.immediateCharge') : t('confirmSubscribe.trialInfo')}
                    </AlertDescription>
                  </Alert>
                </div>
              )
            })()}
          <AlertDialogFooter>
            <AlertDialogCancel>{t('confirmSubscribe.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (subscribingFeatureCode) {
                  const feature = featuresStatus?.availableFeatures.find(f => f.code === subscribingFeatureCode)
                  if (feature) {
                    activateMutation.mutate({
                      featureCode: feature.code,
                      trialPeriodDays: feature.hadPreviously ? 0 : 2,
                    })
                  }
                }
              }}
              disabled={activateMutation.isPending || !paymentMethods?.length}
            >
              {activateMutation.isPending ? t('availableFeatures.subscribing') : t('confirmSubscribe.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={!!cancelingFeatureId} onOpenChange={() => setCancelingFeatureId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirmCancel.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelingFeatureId &&
                t('confirmCancel.description', {
                  feature: featuresStatus?.activeFeatures.find(f => f.featureId === cancelingFeatureId)?.feature.name,
                  date: formatDate(
                    featuresStatus?.activeFeatures.find(f => f.featureId === cancelingFeatureId)?.endDate ||
                      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                  ),
                })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('confirmCancel.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (cancelingFeatureId) {
                  cancelMutation.mutate(cancelingFeatureId)
                }
              }}
            >
              {t('confirmCancel.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Payment Method Dialog - rendered through PaymentMethodsSection */}
      {showAddPaymentDialog && (
        <PaymentMethodsSection
          venueId={venueId}
          defaultPaymentMethodLast4={featuresStatus?.paymentMethod?.last4}
          openAddDialog={showAddPaymentDialog}
          onOpenAddDialogChange={setShowAddPaymentDialog}
        />
      )}

      {/* Superadmin: Grant Trial Dialog */}
      {isSuperadmin && (
        <Dialog open={showGrantTrialDialog} onOpenChange={setShowGrantTrialDialog}>
          <DialogContent className="border-2 border-amber-400/50">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-gradient-to-r from-amber-400 to-pink-500">
                  <Gift className="h-5 w-5 text-primary-foreground" />
                </div>
                <DialogTitle className="bg-gradient-to-r from-amber-500 to-pink-500 bg-clip-text text-transparent">
                  {t('superadmin.grantTrial.title', { defaultValue: 'Grant Free Trial' })}
                </DialogTitle>
              </div>
              <DialogDescription>
                {t('superadmin.grantTrial.description', {
                  defaultValue: 'Grant a free trial period for a feature to {{venue}}. This bypasses normal payment requirements.',
                  venue: venue?.name || 'this venue',
                })}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Feature Selection */}
              <div className="space-y-2">
                <Label htmlFor="trial-feature">
                  {t('superadmin.grantTrial.selectFeature', { defaultValue: 'Select Feature' })}
                </Label>
                <Select value={grantTrialFeatureCode} onValueChange={setGrantTrialFeatureCode}>
                  <SelectTrigger id="trial-feature">
                    <SelectValue
                      placeholder={t('superadmin.grantTrial.selectPlaceholder', { defaultValue: 'Choose a feature...' })}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingPlatformFeatures && (
                      <div className="py-2 px-3 text-sm text-muted-foreground">
                        {t('superadmin.loadingFeatures')}
                      </div>
                    )}
                    {!isLoadingPlatformFeatures && superadminFeatureOptions.map(feature => (
                      <SelectItem key={feature.code} value={feature.code}>
                        {feature.name} - {formatCurrency(Number(feature.monthlyPrice) * 100, 'MXN')}/mo
                      </SelectItem>
                    ))}
                    {!isLoadingPlatformFeatures && superadminFeatureOptions.length === 0 && (
                      <div className="py-2 px-3 text-sm text-muted-foreground">
                        {t('superadmin.noFeaturesAvailable')}
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Trial Duration */}
              <div className="space-y-2">
                <Label htmlFor="trial-days">
                  {t('superadmin.grantTrial.duration', { defaultValue: 'Trial Duration (days)' })}
                </Label>
                <div className="flex gap-2">
                  {[7, 14, 30, 60, 90].map(days => (
                    <Button
                      key={days}
                      type="button"
                      variant={grantTrialDays === days ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setGrantTrialDays(days)}
                      className={
                        grantTrialDays === days
                          ? 'bg-gradient-to-r from-amber-400 to-pink-500 hover:from-amber-500 hover:to-pink-600 text-primary-foreground border-0'
                          : ''
                      }
                    >
                      {days}
                    </Button>
                  ))}
                  <Input
                    id="trial-days"
                    type="number"
                    min={1}
                    max={365}
                    value={grantTrialDays}
                    onChange={e => setGrantTrialDays(Math.max(1, parseInt(e.target.value) || 7))}
                    className="w-20"
                  />
                </div>
              </div>

              {/* Info: DB-only trial (always shown - superadmin trials bypass Stripe) */}
              <Alert className="border-amber-500/50 bg-amber-500/10">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <AlertDescription className="text-amber-700 dark:text-amber-300">
                  <p className="font-medium mb-1">
                    {t('superadmin.grantTrial.dbOnlyTrialInfo', {
                      defaultValue: 'DB-only trial (bypasses Stripe)',
                    })}
                  </p>
                  <p className="text-sm">
                    {t('superadmin.grantTrial.dbOnlyTrialInfoDesc', {
                      defaultValue:
                        'This trial is managed directly in the database and will automatically expire after the trial period. When the trial ends, the venue will need to subscribe through Stripe to continue.',
                    })}
                  </p>
                </AlertDescription>
              </Alert>

              {/* Preview - show for both Stripe and DB-only trials */}
              {grantTrialFeatureCode && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-400/30">
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    {t('superadmin.grantTrial.preview', {
                      defaultValue:
                        '✨ {{feature}} will be active for {{days}} days for free. After the trial, the venue will need to subscribe to continue.',
                      feature:
                        superadminFeatureOptions.find(f => f.code === grantTrialFeatureCode)?.name ||
                        grantTrialFeatureCode,
                      days: grantTrialDays,
                    })}
                  </p>
                </div>
              )}
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setShowGrantTrialDialog(false)}>
                {t('common:cancel')}
              </Button>
              {/* Show "Enable Free Instead" as secondary option when no payment method */}
              {!venueHasPaymentMethod && grantTrialFeatureCode && (
                <Button
                  variant="outline"
                  onClick={handleSwitchToEnableFeature}
                  className="border-amber-400/50 hover:bg-amber-400/10"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  {t('superadmin.grantTrial.enableFreeInstead', { defaultValue: 'Enable Free Instead' })}
                </Button>
              )}
              {/* Primary action: Grant Trial (DB-only, bypasses Stripe) */}
              <Button
                onClick={() => {
                  if (grantTrialFeatureCode) {
                    superadminGrantTrialMutation.mutate({
                      featureCode: grantTrialFeatureCode,
                      days: grantTrialDays,
                    })
                  }
                }}
                disabled={!grantTrialFeatureCode || superadminGrantTrialMutation.isPending}
                className="bg-gradient-to-r from-amber-400 to-pink-500 hover:from-amber-500 hover:to-pink-600 text-primary-foreground"
              >
                {superadminGrantTrialMutation.isPending
                  ? t('common:loading')
                  : t('superadmin.grantTrial.confirm', { defaultValue: 'Grant Trial' })}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Superadmin: Enable Feature Dialog */}
      {isSuperadmin && (
        <Dialog open={showEnableFeatureDialog} onOpenChange={setShowEnableFeatureDialog}>
          <DialogContent className="border-2 border-amber-400/50">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-gradient-to-r from-amber-400 to-pink-500">
                  <Zap className="h-5 w-5 text-primary-foreground" />
                </div>
                <DialogTitle className="bg-gradient-to-r from-amber-500 to-pink-500 bg-clip-text text-transparent">
                  {t('superadmin.enableFeature.title', { defaultValue: 'Enable Feature' })}
                </DialogTitle>
              </div>
              <DialogDescription>
                {t('superadmin.enableFeature.description', {
                  defaultValue:
                    'Enable a feature for {{venue}} without requiring payment. Use this for special arrangements or testing.',
                  venue: venue?.name || 'this venue',
                })}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Feature Selection */}
              <div className="space-y-2">
                <Label htmlFor="enable-feature">
                  {t('superadmin.enableFeature.selectFeature', { defaultValue: 'Select Feature' })}
                </Label>
                <Select value={enableFeatureCode} onValueChange={setEnableFeatureCode}>
                  <SelectTrigger id="enable-feature">
                    <SelectValue
                      placeholder={t('superadmin.enableFeature.selectPlaceholder', { defaultValue: 'Choose a feature to enable...' })}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingPlatformFeatures && (
                      <div className="py-2 px-3 text-sm text-muted-foreground">
                        {t('superadmin.loadingFeatures')}
                      </div>
                    )}
                    {!isLoadingPlatformFeatures && superadminFeatureOptions.map(feature => (
                      <SelectItem key={feature.code} value={feature.code}>
                        <div className="flex items-center gap-2">
                          <Plus className="h-3 w-3" />
                          {feature.name}
                        </div>
                      </SelectItem>
                    ))}
                    {!isLoadingPlatformFeatures && superadminFeatureOptions.length === 0 && (
                      <div className="py-2 px-3 text-sm text-muted-foreground">
                        {t('superadmin.noFeaturesAvailable')}
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Warning */}
              <Alert className="border-amber-400/50 bg-amber-500/10">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-sm text-amber-700 dark:text-amber-300">
                  {t('superadmin.enableFeature.warning', {
                    defaultValue:
                      'This will enable the feature indefinitely without creating a subscription. The venue will not be charged.',
                  })}
                </AlertDescription>
              </Alert>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEnableFeatureDialog(false)}>
                {t('common:cancel')}
              </Button>
              <Button
                onClick={() => {
                  if (enableFeatureCode) {
                    superadminEnableMutation.mutate(enableFeatureCode)
                  }
                }}
                disabled={!enableFeatureCode || superadminEnableMutation.isPending}
                className="bg-gradient-to-r from-amber-400 to-pink-500 hover:from-amber-500 hover:to-pink-600 text-primary-foreground"
              >
                {superadminEnableMutation.isPending
                  ? t('common:loading')
                  : t('superadmin.enableFeature.confirm', { defaultValue: 'Enable Feature' })}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Superadmin: Disable Feature Confirmation Dialog */}
      {isSuperadmin && (
        <AlertDialog open={!!disablingFeatureCode} onOpenChange={() => setDisablingFeatureCode(null)}>
          <AlertDialogContent className="border-2 border-amber-400/50">
            <AlertDialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-gradient-to-r from-amber-400 to-pink-500">
                  <X className="h-5 w-5 text-primary-foreground" />
                </div>
                <AlertDialogTitle className="bg-gradient-to-r from-amber-500 to-pink-500 bg-clip-text text-transparent">
                  {t('superadmin.disableFeature.title', { defaultValue: 'Disable Feature' })}
                </AlertDialogTitle>
              </div>
              <AlertDialogDescription>
                {t('superadmin.disableFeature.description', {
                  defaultValue:
                    'Are you sure you want to disable {{feature}} for {{venue}}? This action will immediately revoke access to this feature.',
                  feature:
                    featuresStatus?.activeFeatures.find(f => f.feature.code === disablingFeatureCode)?.feature.name ||
                    disablingFeatureCode,
                  venue: venue?.name || 'this venue',
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Alert variant="destructive" className="my-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {t('superadmin.disableFeature.warning', {
                  defaultValue: 'This action cannot be undone. The venue will lose access immediately.',
                })}
              </AlertDescription>
            </Alert>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (disablingFeatureCode) {
                    superadminDisableMutation.mutate(disablingFeatureCode)
                  }
                }}
                disabled={superadminDisableMutation.isPending}
                className="bg-gradient-to-r from-amber-400 to-pink-500 hover:from-amber-500 hover:to-pink-600 text-primary-foreground"
              >
                {superadminDisableMutation.isPending
                  ? t('common:loading')
                  : t('superadmin.disableFeature.confirm', { defaultValue: 'Disable Feature' })}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  )
}
