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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useSocket } from '@/context/SocketContext'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import {
  addVenueFeatures,
  downloadInvoice,
  getVenueFeatures,
  getVenueInvoices,
  removeVenueFeature,
  type StripeInvoice,
  type VenueFeatureStatus,
} from '@/services/features.service'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { AlertCircle, Calendar, CheckCircle2, CreditCard, Download, Filter, Search, Sparkles, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PaymentMethodsSection } from './components/PaymentMethodsSection'

export default function Billing() {
  const { t, i18n } = useTranslation('billing')
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { socket } = useSocket()
  const [cancelingFeatureId, setCancelingFeatureId] = useState<string | null>(null)
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null)
  const [subscribingFeatureCode, setSubscribingFeatureCode] = useState<string | null>(null)
  const [retryingInvoiceId, setRetryingInvoiceId] = useState<string | null>(null)
  const [pendingSubscriptionFeatureCode, setPendingSubscriptionFeatureCode] = useState<string | null>(null)
  const [showAddPaymentDialog, setShowAddPaymentDialog] = useState(false)

  // Invoice filters
  const [invoiceSearch, setInvoiceSearch] = useState('')
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<string>('all')
  const [invoiceStartDate, setInvoiceStartDate] = useState('')
  const [invoiceEndDate, setInvoiceEndDate] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Invoice sorting
  const [invoiceSort, setInvoiceSort] = useState<string>('date-desc') // date-desc, date-asc, amount-desc, amount-asc

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
      // Show success notification
      toast({
        title: t('toast.paymentSuccess'),
        description: t('toast.paymentSuccessDescription', { feature: data.featureCode }),
        variant: 'default',
      })

      // Invalidate queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['venueFeatures', venueId] })
      queryClient.invalidateQueries({ queryKey: ['venueInvoices', venueId] })
    }

    const handleSubscriptionDeactivated = (data: any) => {
      // Show deactivation notification
      toast({
        title: t('toast.subscriptionDeactivated'),
        description: t('toast.subscriptionDeactivatedDescription', { feature: data.featureCode }),
        variant: 'destructive',
      })

      // Invalidate queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['venueFeatures', venueId] })
      queryClient.invalidateQueries({ queryKey: ['venueInvoices', venueId] })
    }

    // Listen for subscription events from webhook processing
    socket.on('subscription.activated', handleSubscriptionActivated)
    socket.on('subscription.deactivated', handleSubscriptionDeactivated)

    // Cleanup listeners on unmount
    return () => {
      socket.off('subscription.activated', handleSubscriptionActivated)
      socket.off('subscription.deactivated', handleSubscriptionDeactivated)
    }
  }, [socket, venueId, queryClient, toast, t])

  // Reopen subscription dialog after adding payment method
  useEffect(() => {
    if (pendingSubscriptionFeatureCode && paymentMethods && paymentMethods.length > 0) {
      // Payment method was added, close add payment dialog and reopen subscription dialog
      setShowAddPaymentDialog(false)
      setSubscribingFeatureCode(pendingSubscriptionFeatureCode)
      setPendingSubscriptionFeatureCode(null)
    }
  }, [paymentMethods, pendingSubscriptionFeatureCode])

  // Filter and sort invoices
  const filteredInvoices = useMemo(() => {
    if (!invoices) return []

    // Step 1: Filter
    const filtered = invoices.filter(invoice => {
      // Search filter (invoice number or description)
      if (invoiceSearch) {
        const searchLower = invoiceSearch.toLowerCase()
        const matchesNumber = invoice.number?.toLowerCase().includes(searchLower)
        const matchesDescription = invoice.description?.toLowerCase().includes(searchLower)
        if (!matchesNumber && !matchesDescription) return false
      }

      // Status filter
      if (invoiceStatusFilter !== 'all' && invoice.status !== invoiceStatusFilter) {
        return false
      }

      // Date range filter
      const invoiceDate = new Date(invoice.created * 1000)
      if (invoiceStartDate) {
        const startDate = new Date(invoiceStartDate)
        if (invoiceDate < startDate) return false
      }
      if (invoiceEndDate) {
        const endDate = new Date(invoiceEndDate)
        endDate.setHours(23, 59, 59, 999) // Include entire end date
        if (invoiceDate > endDate) return false
      }

      return true
    })

    // Step 2: Sort
    const sorted = [...filtered].sort((a, b) => {
      switch (invoiceSort) {
        case 'date-desc':
          return b.created - a.created // Newest first
        case 'date-asc':
          return a.created - b.created // Oldest first
        case 'amount-desc':
          return b.amount_due - a.amount_due // Highest first
        case 'amount-asc':
          return a.amount_due - b.amount_due // Lowest first
        default:
          return b.created - a.created // Default: newest first
      }
    })

    return sorted
  }, [invoices, invoiceSearch, invoiceStatusFilter, invoiceStartDate, invoiceEndDate, invoiceSort])

  // Clear all filters
  const clearFilters = () => {
    setInvoiceSearch('')
    setInvoiceStatusFilter('all')
    setInvoiceStartDate('')
    setInvoiceEndDate('')
  }

  // Check if any filters are active
  const hasActiveFilters = invoiceSearch || invoiceStatusFilter !== 'all' || invoiceStartDate || invoiceEndDate

  // Retry invoice payment mutation
  const retryInvoicePaymentMutation = useMutation({
    mutationFn: (invoiceId: string) => api.post(`/api/v1/dashboard/venues/${venueId}/invoices/${invoiceId}/retry`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venueInvoices', venueId] })
      queryClient.invalidateQueries({ queryKey: ['venueFeatures', venueId] })
      toast({
        title: t('billingHistory.retrySuccess'),
        variant: 'default',
      })
      setRetryingInvoiceId(null)
    },
    onError: (error: any) => {
      toast({
        title: t('billingHistory.retryError'),
        description: error.response?.data?.error || error.message,
        variant: 'destructive',
      })
      setRetryingInvoiceId(null)
    },
  })

  // Handle retry invoice
  const handleRetryInvoice = (invoiceId: string) => {
    setRetryingInvoiceId(invoiceId)
    retryInvoicePaymentMutation.mutate(invoiceId)
  }

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
        // Trial subscription - feature is immediately active
        toast({
          title: t('toast.activateSuccessGeneric'),
          description: t('toast.activateSuccessDescription'),
          variant: 'default',
        })
      } else {
        // Paid subscription - feature requires payment confirmation
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

  // Handle invoice download
  const handleDownloadInvoice = async (invoiceId: string) => {
    try {
      setDownloadingInvoiceId(invoiceId)
      await downloadInvoice(venueId, invoiceId)
    } catch {
      toast({
        title: t('toast.downloadError'),
        variant: 'destructive',
      })
    } finally {
      setDownloadingInvoiceId(null)
    }
  }

  // Get card brand display name
  const getCardBrand = (brand: string) => {
    const brandLower = brand.toLowerCase()
    const brandKey = `paymentMethods.cardBrand.${brandLower}` as const
    return t(brandKey) || t('paymentMethods.cardBrand.unknown')
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
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex items-start gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{t('activeSubscriptions.trialEnds', { date: '' }).replace(/:\s*$/, '')}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{formatDate(endDate)}</p>
            </div>
          </div>
        </div>
      )
    } else if (!endDate) {
      // Paid - show next billing
      const nextMonth = new Date()
      nextMonth.setMonth(nextMonth.getMonth() + 1)
      return (
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex items-start gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                {t('activeSubscriptions.nextBilling', { date: '' }).replace(/:\s*$/, '')}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">{formatDate(nextMonth)}</p>
            </div>
          </div>
        </div>
      )
    } else {
      // Canceled
      return (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-destructive">
                {t('activeSubscriptions.canceledOn', { date: '' }).replace(/:\s*$/, '')}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">{formatDate(endDate)}</p>
            </div>
          </div>
        </div>
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
                <Card key={feature.id} className="relative flex flex-col h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg">{feature.feature.name}</CardTitle>
                        <CardDescription className="mt-1 line-clamp-2 min-h-[2.5rem]">{feature.feature.description}</CardDescription>
                      </div>
                      {getStatusBadge(feature)}
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col flex-1 space-y-3 pt-0">
                    {/* Price */}
                    <div>
                      <div className="text-3xl font-bold text-foreground">{formatCurrency(Number(feature.monthlyPrice) * 100, 'MXN')}</div>
                      <p className="text-sm text-muted-foreground mt-0.5">{t('activeSubscriptions.perMonth')}</p>
                    </div>

                    {/* Billing info */}
                    <div className="pt-1">{getBillingInfo(feature)}</div>

                    {/* Spacer to push button to bottom */}
                    <div className="grow" />

                    {/* Cancel button */}
                    {feature.active && (
                      <Button
                        variant="destructive"
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
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Methods */}
      <PaymentMethodsSection
        venueId={venueId}
        defaultPaymentMethodLast4={featuresStatus?.paymentMethod?.last4}
        openAddDialog={showAddPaymentDialog}
        onOpenAddDialogChange={setShowAddPaymentDialog}
      />

      {/* Billing History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              {t('billingHistory.title')}
            </CardTitle>
            {invoices && invoices.length > 0 && (
              <div className="flex items-center gap-2">
                {/* Sort dropdown */}
                <Select value={invoiceSort} onValueChange={setInvoiceSort}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date-desc">{t('billingHistory.sort.dateDesc')}</SelectItem>
                    <SelectItem value="date-asc">{t('billingHistory.sort.dateAsc')}</SelectItem>
                    <SelectItem value="amount-desc">{t('billingHistory.sort.amountDesc')}</SelectItem>
                    <SelectItem value="amount-asc">{t('billingHistory.sort.amountAsc')}</SelectItem>
                  </SelectContent>
                </Select>

                {/* Filter toggle */}
                <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="gap-2">
                  <Filter className="h-4 w-4" />
                  {showFilters ? t('billingHistory.filters.hide') : t('billingHistory.filters.show')}
                  {hasActiveFilters && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">
                      {filteredInvoices.length}
                    </span>
                  )}
                </Button>
              </div>
            )}
          </div>
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
            <>
              {/* Filters */}
              {showFilters && (
                <div className="mb-6 p-4 border rounded-lg bg-muted/30 space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {/* Search */}
                    <div className="space-y-2">
                      <Label htmlFor="invoice-search" className="text-sm font-medium">
                        {t('billingHistory.filters.search')}
                      </Label>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="invoice-search"
                          type="text"
                          placeholder={t('billingHistory.filters.searchPlaceholder')}
                          value={invoiceSearch}
                          onChange={e => setInvoiceSearch(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </div>

                    {/* Status Filter */}
                    <div className="space-y-2">
                      <Label htmlFor="invoice-status" className="text-sm font-medium">
                        {t('billingHistory.filters.status')}
                      </Label>
                      <Select value={invoiceStatusFilter} onValueChange={setInvoiceStatusFilter}>
                        <SelectTrigger id="invoice-status">
                          <SelectValue placeholder={t('billingHistory.filters.statusPlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t('billingHistory.filters.allStatuses')}</SelectItem>
                          <SelectItem value="paid">{t('billingHistory.status.paid')}</SelectItem>
                          <SelectItem value="open">{t('billingHistory.status.open')}</SelectItem>
                          <SelectItem value="draft">{t('billingHistory.status.draft')}</SelectItem>
                          <SelectItem value="uncollectible">{t('billingHistory.status.uncollectible')}</SelectItem>
                          <SelectItem value="void">{t('billingHistory.status.void')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Start Date */}
                    <div className="space-y-2">
                      <Label htmlFor="invoice-start-date" className="text-sm font-medium">
                        {t('billingHistory.filters.fromDate')}
                      </Label>
                      <Input
                        id="invoice-start-date"
                        type="date"
                        value={invoiceStartDate}
                        onChange={e => setInvoiceStartDate(e.target.value)}
                      />
                    </div>

                    {/* End Date */}
                    <div className="space-y-2">
                      <Label htmlFor="invoice-end-date" className="text-sm font-medium">
                        {t('billingHistory.filters.toDate')}
                      </Label>
                      <Input id="invoice-end-date" type="date" value={invoiceEndDate} onChange={e => setInvoiceEndDate(e.target.value)} />
                    </div>
                  </div>

                  {/* Filter Actions */}
                  <div className="flex items-center justify-between pt-2">
                    <p className="text-sm text-muted-foreground">
                      {t('billingHistory.filters.showing', { count: filteredInvoices.length, total: invoices.length })}
                    </p>
                    {hasActiveFilters && (
                      <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-2">
                        <X className="h-4 w-4" />
                        {t('billingHistory.filters.clearFilters')}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* No results after filtering */}
              {filteredInvoices.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium">{t('billingHistory.filters.noResults')}</p>
                    <p className="text-sm text-muted-foreground mt-1">{t('billingHistory.filters.noResultsHint')}</p>
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
                    {filteredInvoices.map(invoice => (
                      <TableRow key={invoice.id}>
                        <TableCell>{formatDate(new Date(invoice.created * 1000))}</TableCell>
                        <TableCell>{invoice.description || `Invoice #${invoice.number}`}</TableCell>
                        <TableCell>{formatCurrency(invoice.amount_due, invoice.currency.toUpperCase())}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              invoice.status === 'paid'
                                ? 'default'
                                : invoice.status === 'open' || invoice.status === 'uncollectible'
                                ? 'destructive'
                                : 'secondary'
                            }
                          >
                            {t(`billingHistory.status.${invoice.status}`)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {(invoice.status === 'open' || invoice.status === 'uncollectible') && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRetryInvoice(invoice.id)}
                                disabled={retryingInvoiceId === invoice.id}
                                className="border-orange-600 text-orange-900 dark:text-orange-100 hover:bg-orange-100 dark:hover:bg-orange-900"
                              >
                                {retryingInvoiceId === invoice.id ? t('billingHistory.retrying') : t('billingHistory.retryButton')}
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadInvoice(invoice.id)}
                              disabled={downloadingInvoiceId === invoice.id}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              {downloadingInvoiceId === invoice.id ? t('billingHistory.downloading') : t('billingHistory.downloadButton')}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </>
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
                        : t('availableFeatures.startTrial', { days: 2 })}
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
                            // Save the feature code to reopen dialog after adding payment method
                            setPendingSubscriptionFeatureCode(subscribingFeatureCode)
                            setSubscribingFeatureCode(null)
                            // Open add payment method dialog directly
                            setShowAddPaymentDialog(true)
                          }}
                        >
                          {t('confirmSubscribe.addPaymentMethod')}
                        </Button>
                      )}
                    </div>
                    {paymentMethods && paymentMethods.length > 0 ? (
                      <div className="flex items-center gap-3">
                        {/* Card Icon */}
                        <div className="flex items-center justify-center w-12 h-8 bg-background border border-border rounded">
                          <CreditCard className="h-5 w-5 text-muted-foreground" />
                        </div>
                        {/* Card Details - use default payment method or first one */}
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
    </div>
  )
}
