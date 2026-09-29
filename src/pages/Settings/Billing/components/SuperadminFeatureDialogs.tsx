// The three superadmin feature dialogs (grant trial, enable feature, disable), moved unchanged out of
// SuperadminBillingSection (spec §4.6). The panel owns which dialog is open and which feature is being disabled; each
// dialog's form state and its mutation live here.
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Gift, Plus, X, Zap } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import type { VenueFeatureStatus } from '@/services/features.service'

const loadSuperadminService = () => import('@/services/superadmin.service')

export interface SuperadminFeatureDialogsProps {
  venueId: string
  venueName?: string
  featuresStatus: VenueFeatureStatus | undefined
  formatCurrency: (amount: number, currency?: string) => string
  showGrantTrialDialog: boolean
  setShowGrantTrialDialog: (open: boolean) => void
  showEnableFeatureDialog: boolean
  setShowEnableFeatureDialog: (open: boolean) => void
  disablingFeatureCode: string | null
  setDisablingFeatureCode: (code: string | null) => void
}

export function SuperadminFeatureDialogs({
  venueId,
  venueName,
  featuresStatus,
  formatCurrency,
  showGrantTrialDialog,
  setShowGrantTrialDialog,
  showEnableFeatureDialog,
  setShowEnableFeatureDialog,
  disablingFeatureCode,
  setDisablingFeatureCode,
}: SuperadminFeatureDialogsProps) {
  const { t } = useTranslation('billing')
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [grantTrialFeatureCode, setGrantTrialFeatureCode] = useState<string>('')
  const [grantTrialDays, setGrantTrialDays] = useState<number>(7)
  const [enableFeatureCode, setEnableFeatureCode] = useState<string>('')

  // Fetch payment methods (used by the superadmin trial flow to detect a saved card)
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
    enabled: !!venueId,
  })

  // Superadmin: Fetch all platform features (lazy loaded)
  const {
    data: allPlatformFeatures,
    isLoading: isLoadingPlatformFeatures,
    error: _platformFeaturesError,
  } = useQuery({
    queryKey: ['superadmin', 'features'],
    queryFn: async () => {
      const service = await loadSuperadminService()
      return service.getAllFeatures()
    },
    enabled: true,
  })

  // Memoized list of features available for superadmin to enable/grant trial
  // Shows ALL platform features that are NOT already active for this venue
  const superadminFeatureOptions = useMemo(() => {
    // If we have platform features, filter out active ones
    if (allPlatformFeatures && allPlatformFeatures.length > 0) {
      const activeCodes = new Set(featuresStatus?.activeFeatures.map(f => f.feature.code) || [])

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

  return (
    <>
      {/* Superadmin: Grant Trial Dialog */}
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
                venue: venueName || 'this venue',
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Feature Selection */}
            <div className="space-y-2">
              <Label htmlFor="trial-feature">{t('superadmin.grantTrial.selectFeature', { defaultValue: 'Select Feature' })}</Label>
              <Select value={grantTrialFeatureCode} onValueChange={setGrantTrialFeatureCode}>
                <SelectTrigger id="trial-feature">
                  <SelectValue placeholder={t('superadmin.grantTrial.selectPlaceholder', { defaultValue: 'Choose a feature...' })} />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingPlatformFeatures && (
                    <div className="py-2 px-3 text-sm text-muted-foreground">{t('superadmin.loadingFeatures')}</div>
                  )}
                  {!isLoadingPlatformFeatures &&
                    superadminFeatureOptions.map(feature => (
                      <SelectItem key={feature.code} value={feature.code}>
                        {feature.name} - {formatCurrency(Number(feature.monthlyPrice) * 100, 'MXN')}/mo
                      </SelectItem>
                    ))}
                  {!isLoadingPlatformFeatures && superadminFeatureOptions.length === 0 && (
                    <div className="py-2 px-3 text-sm text-muted-foreground">{t('superadmin.noFeaturesAvailable')}</div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Trial Duration */}
            <div className="space-y-2">
              <Label htmlFor="trial-days">{t('superadmin.grantTrial.duration', { defaultValue: 'Trial Duration (days)' })}</Label>
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
                    feature: superadminFeatureOptions.find(f => f.code === grantTrialFeatureCode)?.name || grantTrialFeatureCode,
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
              <Button variant="outline" onClick={handleSwitchToEnableFeature} className="border-amber-400/50 hover:bg-amber-400/10">
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

      {/* Superadmin: Enable Feature Dialog */}
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
                defaultValue: 'Enable a feature for {{venue}} without requiring payment. Use this for special arrangements or testing.',
                venue: venueName || 'this venue',
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Feature Selection */}
            <div className="space-y-2">
              <Label htmlFor="enable-feature">{t('superadmin.enableFeature.selectFeature', { defaultValue: 'Select Feature' })}</Label>
              <Select value={enableFeatureCode} onValueChange={setEnableFeatureCode}>
                <SelectTrigger id="enable-feature">
                  <SelectValue
                    placeholder={t('superadmin.enableFeature.selectPlaceholder', { defaultValue: 'Choose a feature to enable...' })}
                  />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingPlatformFeatures && (
                    <div className="py-2 px-3 text-sm text-muted-foreground">{t('superadmin.loadingFeatures')}</div>
                  )}
                  {!isLoadingPlatformFeatures &&
                    superadminFeatureOptions.map(feature => (
                      <SelectItem key={feature.code} value={feature.code}>
                        <div className="flex items-center gap-2">
                          <Plus className="h-3 w-3" />
                          {feature.name}
                        </div>
                      </SelectItem>
                    ))}
                  {!isLoadingPlatformFeatures && superadminFeatureOptions.length === 0 && (
                    <div className="py-2 px-3 text-sm text-muted-foreground">{t('superadmin.noFeaturesAvailable')}</div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Warning */}
            <Alert className="border-amber-400/50 bg-amber-500/10">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-sm text-amber-700 dark:text-amber-300">
                {t('superadmin.enableFeature.warning', {
                  defaultValue: 'This will enable the feature indefinitely without creating a subscription. The venue will not be charged.',
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

      {/* Superadmin: Disable Feature Confirmation Dialog */}
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
                  featuresStatus?.activeFeatures.find(f => f.feature.code === disablingFeatureCode)?.feature.name || disablingFeatureCode,
                venue: venueName || 'this venue',
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
    </>
  )
}
