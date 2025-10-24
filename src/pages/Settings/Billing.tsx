import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar, CreditCard, Download, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
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
  getVenueFeatures,
  removeVenueFeature,
  addVenueFeatures,
  getVenueInvoices,
  downloadInvoice,
  type VenueFeatureStatus,
  type StripeInvoice,
} from '@/services/features.service'

export default function Billing() {
  const { t, i18n } = useTranslation('billing')
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [cancelingFeatureId, setCancelingFeatureId] = useState<string | null>(null)
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null)
  const [subscribingFeatureCode, setSubscribingFeatureCode] = useState<string | null>(null)

  // Fetch venue features status
  const { data: featuresStatus, isLoading: loadingFeatures } = useQuery<VenueFeatureStatus>({
    queryKey: ['venueFeatures', venueId],
    queryFn: () => getVenueFeatures(venueId),
    enabled: !!venueId,
  })

  // Fetch invoices
  const { data: invoices, isLoading: loadingInvoices } = useQuery<StripeInvoice[]>({
    queryKey: ['venueInvoices', venueId],
    queryFn: () => getVenueInvoices(venueId),
    enabled: !!venueId,
  })

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
      toast({
        title: t('toast.activateSuccessGeneric'),
        description: isTrial ? t('toast.activateSuccessDescription') : t('confirmSubscribe.immediateCharge'),
        variant: 'default',
      })
      setSubscribingFeatureCode(null)
    },
    onError: () => {
      toast({
        title: t('toast.activateError'),
        variant: 'destructive',
      })
      setSubscribingFeatureCode(null)
    },
  })

  // Handle invoice download
  const handleDownloadInvoice = async (invoiceId: string) => {
    try {
      setDownloadingInvoiceId(invoiceId)
      await downloadInvoice(venueId, invoiceId)
    } catch (error) {
      toast({
        title: t('toast.downloadError'),
        variant: 'destructive',
      })
    } finally {
      setDownloadingInvoiceId(null)
    }
  }

  // Format currency
  const formatCurrency = (amount: number, currency: string = 'MXN') => {
    return new Intl.NumberFormat(i18n.language, {
      style: 'currency',
      currency,
    }).format(amount / 100) // Stripe amounts are in cents
  }

  // Format date
  const formatDate = (date: string | Date) => {
    return format(new Date(date), 'PPP', {
      locale: i18n.language === 'es' ? es : undefined,
    })
  }

  // Get badge variant for subscription status
  const getStatusBadge = (feature: VenueFeatureStatus['activeFeatures'][0]) => {
    const now = new Date()
    const endDate = feature.endDate ? new Date(feature.endDate) : null

    if (endDate && endDate > now) {
      // Trial active
      return <Badge variant="secondary">{t('activeSubscriptions.trial')}</Badge>
    } else if (feature.active && !endDate) {
      // Paid subscription
      return <Badge variant="default">{t('activeSubscriptions.active')}</Badge>
    } else {
      // Canceled
      return <Badge variant="destructive">{t('activeSubscriptions.canceled')}</Badge>
    }
  }

  // Get next billing date or trial end
  const getBillingInfo = (feature: VenueFeatureStatus['activeFeatures'][0]) => {
    const now = new Date()
    const endDate = feature.endDate ? new Date(feature.endDate) : null

    if (endDate && endDate > now) {
      // Trial active - show trial end date
      return (
        <p className="text-sm text-muted-foreground flex items-center gap-1">
          <Calendar className="h-4 w-4" />
          {t('activeSubscriptions.trialEnds', { date: formatDate(endDate) })}
        </p>
      )
    } else if (!endDate) {
      // Paid - show next billing
      const nextMonth = new Date()
      nextMonth.setMonth(nextMonth.getMonth() + 1)
      return (
        <p className="text-sm text-muted-foreground flex items-center gap-1">
          <Calendar className="h-4 w-4" />
          {t('activeSubscriptions.nextBilling', { date: formatDate(nextMonth) })}
        </p>
      )
    } else {
      // Canceled
      return (
        <p className="text-sm text-muted-foreground flex items-center gap-1">
          <AlertCircle className="h-4 w-4" />
          {t('activeSubscriptions.canceledOn', { date: formatDate(endDate) })}
        </p>
      )
    }
  }

  if (loadingFeatures) {
    return (
      <div className="p-8">
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">{t('pageTitle')}</h1>
        <p className="text-muted-foreground mt-2">{t('pageSubtitle')}</p>
      </div>

      {/* Active Subscriptions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {t('activeSubscriptions.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!featuresStatus?.activeFeatures.length ? (
            <Alert>
              <Sparkles className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium">{t('activeSubscriptions.noSubscriptions')}</p>
                <p className="text-sm text-muted-foreground mt-1">{t('activeSubscriptions.exploreFeatures')}</p>
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {featuresStatus.activeFeatures.map(feature => (
                <Card key={feature.id} className="relative">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{feature.feature.name}</CardTitle>
                        <CardDescription className="mt-1">{feature.feature.description}</CardDescription>
                      </div>
                      {getStatusBadge(feature)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Price */}
                    <div className="text-2xl font-bold">
                      {t('activeSubscriptions.monthlyPrice', {
                        price: formatCurrency(Number(feature.monthlyPrice) * 100, 'MXN'),
                      })}
                    </div>

                    {/* Billing info */}
                    {getBillingInfo(feature)}

                    {/* Cancel button */}
                    {feature.active && (
                      <Button
                        variant="destructive"
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
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Billing History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            {t('billingHistory.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingInvoices ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : !invoices?.length ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium">{t('billingHistory.noInvoices')}</p>
                <p className="text-sm text-muted-foreground mt-1">{t('billingHistory.description')}</p>
              </AlertDescription>
            </Alert>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('billingHistory.columns.date')}</TableHead>
                  <TableHead>{t('billingHistory.columns.description')}</TableHead>
                  <TableHead>{t('billingHistory.columns.amount')}</TableHead>
                  <TableHead>{t('billingHistory.columns.status')}</TableHead>
                  <TableHead className="text-right">{t('billingHistory.columns.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map(invoice => (
                  <TableRow key={invoice.id}>
                    <TableCell>{formatDate(new Date(invoice.created * 1000))}</TableCell>
                    <TableCell>{invoice.description || `Invoice #${invoice.number}`}</TableCell>
                    <TableCell>{formatCurrency(invoice.amount_due, invoice.currency.toUpperCase())}</TableCell>
                    <TableCell>
                      <Badge variant={invoice.status === 'paid' ? 'default' : 'secondary'}>
                        {t(`billingHistory.status.${invoice.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownloadInvoice(invoice.id)}
                        disabled={downloadingInvoiceId === invoice.id}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        {downloadingInvoiceId === invoice.id ? t('billingHistory.downloading') : t('billingHistory.downloadButton')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Available Features */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            {t('availableFeatures.title')}
          </CardTitle>
          <CardDescription>{t('availableFeatures.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          {!featuresStatus?.availableFeatures.length ? (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium">{t('availableFeatures.noFeatures')}</p>
                <p className="text-sm text-muted-foreground mt-1">{t('availableFeatures.description')}</p>
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {featuresStatus.availableFeatures.map(feature => (
                <Card key={feature.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">{feature.name}</CardTitle>
                    <CardDescription>{feature.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Price */}
                    <div className="text-2xl font-bold">
                      {formatCurrency(Number(feature.monthlyPrice) * 100, 'MXN')}
                      <span className="text-sm font-normal text-muted-foreground">{t('availableFeatures.perMonth')}</span>
                    </div>

                    {/* Subscribe button */}
                    <Button
                      className="w-full"
                      onClick={() => setSubscribingFeatureCode(feature.code)}
                      disabled={activateMutation.isPending}
                    >
                      {activateMutation.isPending
                        ? t('availableFeatures.subscribing')
                        : feature.hadPreviously
                          ? t('availableFeatures.subscribeNoTrial')
                          : t('availableFeatures.startTrial', { days: 5 })}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Subscribe Confirmation Dialog */}
      <AlertDialog open={!!subscribingFeatureCode} onOpenChange={() => setSubscribingFeatureCode(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirmSubscribe.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {subscribingFeatureCode && (() => {
                const feature = featuresStatus?.availableFeatures.find(f => f.code === subscribingFeatureCode)
                if (!feature) return null

                const hasHadBefore = feature.hadPreviously
                const price = formatCurrency(Number(feature.monthlyPrice) * 100, 'MXN')
                const days = 5

                return (
                  <div className="space-y-4 pt-2">
                    {/* Description */}
                    <p className="text-sm text-muted-foreground">
                      {hasHadBefore
                        ? t('confirmSubscribe.description', { feature: feature.name, price })
                        : t('confirmSubscribe.descriptionWithTrial', { feature: feature.name, price, days })
                      }
                    </p>

                    {/* Payment Method Section */}
                    <div className="border border-border rounded-lg p-4 bg-muted/50">
                      <p className="text-sm font-medium mb-2">{t('confirmSubscribe.paymentMethod')}</p>
                      {featuresStatus?.paymentMethod ? (
                        <div className="flex items-center gap-3">
                          {/* Card Icon */}
                          <div className="flex items-center justify-center w-12 h-8 bg-background border border-border rounded">
                            <CreditCard className="h-5 w-5 text-muted-foreground" />
                          </div>
                          {/* Card Details */}
                          <div>
                            <p className="text-sm font-medium">
                              {featuresStatus.paymentMethod.brand.charAt(0).toUpperCase() + featuresStatus.paymentMethod.brand.slice(1)} •••• {featuresStatus.paymentMethod.last4}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {t('confirmSubscribe.cardExpires', {
                                month: String(featuresStatus.paymentMethod.expMonth).padStart(2, '0'),
                                year: featuresStatus.paymentMethod.expYear
                              })}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <Alert className="mt-2">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-xs">
                            {t('confirmSubscribe.noPaymentMethod')}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>

                    {/* Warning/Info Banner */}
                    <Alert variant={hasHadBefore ? "destructive" : "default"}>
                      <AlertDescription className="text-sm font-medium">
                        {hasHadBefore
                          ? t('confirmSubscribe.immediateCharge')
                          : t('confirmSubscribe.trialInfo')
                        }
                      </AlertDescription>
                    </Alert>
                  </div>
                )
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('confirmSubscribe.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (subscribingFeatureCode) {
                  const feature = featuresStatus?.availableFeatures.find(f => f.code === subscribingFeatureCode)
                  if (feature) {
                    activateMutation.mutate({
                      featureCode: feature.code,
                      trialPeriodDays: feature.hadPreviously ? 0 : 5,
                    })
                  }
                }
              }}
              disabled={activateMutation.isPending || !featuresStatus?.paymentMethod}
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
    </div>
  )
}
