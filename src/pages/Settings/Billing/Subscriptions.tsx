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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useSocket } from '@/context/SocketContext'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import {
  addVenueFeatures,
  getVenueFeatures,
  removeVenueFeature,
  type VenueFeatureStatus,
} from '@/services/features.service'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { AlertCircle, Calendar, CheckCircle2, CreditCard } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PaymentMethodsSection } from '../components/PaymentMethodsSection'

export default function Subscriptions() {
  const { t, i18n } = useTranslation('billing')
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { socket } = useSocket()

  const [cancelingFeatureId, setCancelingFeatureId] = useState<string | null>(null)
  const [subscribingFeatureCode, setSubscribingFeatureCode] = useState<string | null>(null)
  const [pendingSubscriptionFeatureCode, setPendingSubscriptionFeatureCode] = useState<string | null>(null)
  const [showAddPaymentDialog, setShowAddPaymentDialog] = useState(false)

  // Fetch venue features status
  const { data: featuresStatus, isLoading: loadingFeatures } = useQuery<VenueFeatureStatus>({
    queryKey: ['venueFeatures', venueId],
    queryFn: () => getVenueFeatures(venueId),
    enabled: !!venueId,
  })

  // Fetch payment methods (for subscription dialog validation)
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['venueFeatures', venueId] })
      const isTrial = variables.trialPeriodDays > 0

      if (isTrial) {
        toast({
          title: t('toast.activateSuccessGeneric'),
          description: t('toast.activateSuccessDescription'),
          variant: 'default',
        })
      } else {
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

  const formatDate = (date: string | Date) => {
    return format(new Date(date), 'PPP', {
      locale: i18n.language === 'es' ? es : undefined,
    })
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
      <div className="px-8 pt-6 space-y-6">
        {/* Subscriptions Grid - Active features first, then available */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Active subscriptions */}
          {featuresStatus?.activeFeatures.map(feature => (
            <div key={feature.id} className="premium-border">
              <Card className="relative overflow-hidden transition-shadow hover:shadow-md border-0">
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
                <CardContent className="pt-0 space-y-3">
                  {/* Price */}
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold">{formatCurrency(Number(feature.monthlyPrice) * 100, 'MXN')}</span>
                    <span className="text-xs text-muted-foreground">{t('activeSubscriptions.perMonth')}</span>
                  </div>
                  {/* Billing info compact */}
                  <div className="text-xs text-muted-foreground">
                    {getBillingInfoCompact(feature)}
                  </div>
                  {/* Cancel button */}
                  {feature.active && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
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
            <Card key={feature.id} className="relative overflow-hidden transition-shadow hover:shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{feature.name}</CardTitle>
                <CardDescription className="text-xs line-clamp-2">{feature.description}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                {/* Price */}
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold">{formatCurrency(Number(feature.monthlyPrice) * 100, 'MXN')}</span>
                  <span className="text-xs text-muted-foreground">{t('availableFeatures.perMonth')}</span>
                </div>
                {/* Subscribe button */}
                <Button
                  size="sm"
                  className="w-full"
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
    </>
  )
}
