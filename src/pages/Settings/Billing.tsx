import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar, CreditCard, Download, AlertCircle, Sparkles, CheckCircle2, Trash2, AlertTriangle, Search, X, Filter } from 'lucide-react'
import getIcon from '@/utils/getIcon'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
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
import { AddPaymentMethodDialog } from '@/components/AddPaymentMethodDialog'
import api from '@/api'

// Payment Method type
interface PaymentMethod {
  id: string
  card: {
    brand: string
    last4: string
    exp_month: number
    exp_year: number
  }
  customer?: string
}

export default function Billing() {
  const { t, i18n } = useTranslation('billing')
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [cancelingFeatureId, setCancelingFeatureId] = useState<string | null>(null)
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null)
  const [subscribingFeatureCode, setSubscribingFeatureCode] = useState<string | null>(null)
  const [showAddPaymentDialog, setShowAddPaymentDialog] = useState(false)
  const [removingPaymentMethodId, setRemovingPaymentMethodId] = useState<string | null>(null)
  const [retryingInvoiceId, setRetryingInvoiceId] = useState<string | null>(null)

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

  // Fetch payment methods
  const { data: paymentMethods, isLoading: loadingPaymentMethods} = useQuery<PaymentMethod[]>({
    queryKey: ['paymentMethods', venueId],
    queryFn: async () => {
      const response = await api.get(`/api/v1/dashboard/venues/${venueId}/payment-methods`)
      return response.data.data
    },
    enabled: !!venueId,
  })

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

  // Remove payment method mutation
  const removePaymentMethodMutation = useMutation({
    mutationFn: (paymentMethodId: string) => api.delete(`/api/v1/dashboard/venues/${venueId}/payment-methods/${paymentMethodId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paymentMethods', venueId] })
      queryClient.invalidateQueries({ queryKey: ['venueFeatures', venueId] })
      toast({
        title: t('paymentMethods.toasts.removeSuccess'),
        variant: 'default',
      })
      setRemovingPaymentMethodId(null)
    },
    onError: () => {
      toast({
        title: t('paymentMethods.toasts.removeError'),
        variant: 'destructive',
      })
      setRemovingPaymentMethodId(null)
    },
  })

  // Set default payment method mutation
  const setDefaultPaymentMethodMutation = useMutation({
    mutationFn: (paymentMethodId: string) =>
      api.put(`/api/v1/dashboard/venues/${venueId}/payment-methods/set-default`, { paymentMethodId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paymentMethods', venueId] })
      queryClient.invalidateQueries({ queryKey: ['venueFeatures', venueId] })
      toast({
        title: t('paymentMethods.toasts.setDefaultSuccess'),
        variant: 'default',
      })
    },
    onError: () => {
      toast({
        title: t('paymentMethods.toasts.setDefaultError'),
        variant: 'destructive',
      })
    },
  })

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

  // Get card brand display name
  const getCardBrand = (brand: string) => {
    const brandLower = brand.toLowerCase()
    const brandKey = `paymentMethods.cardBrand.${brandLower}` as const
    return t(brandKey) || t('paymentMethods.cardBrand.unknown')
  }

  // Handle payment method success
  const handlePaymentMethodSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['paymentMethods', venueId] })
    queryClient.invalidateQueries({ queryKey: ['venueFeatures', venueId] })
  }

  // Detect expiring cards (within 30 days)
  const expiringCards = useMemo(() => {
    if (!paymentMethods) return []

    const now = new Date()
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    return paymentMethods.filter(pm => {
      const expiry = new Date(pm.card.exp_year, pm.card.exp_month, 0) // Last day of expiry month
      return expiry > now && expiry <= thirtyDaysFromNow
    }).map(pm => {
      const expiry = new Date(pm.card.exp_year, pm.card.exp_month, 0)
      const daysUntilExpiry = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      return { ...pm, daysUntilExpiry, expiry }
    })
  }, [paymentMethods])

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

      {/* Expiring Card Warning */}
      {expiringCards.length > 0 && (
        <Alert variant="destructive" className="border-orange-500 bg-orange-50 dark:bg-orange-950/50">
          <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          <div className="flex-1">
            <h3 className="font-semibold text-orange-900 dark:text-orange-100 mb-1">
              {t('paymentMethods.warnings.cardExpiring.title', { count: expiringCards.length })}
            </h3>
            <AlertDescription className="text-orange-800 dark:text-orange-200">
              {expiringCards.map((card, idx) => (
                <div key={card.id} className="flex items-center justify-between py-1">
                  <span>
                    {t('paymentMethods.warnings.cardExpiring.description', {
                      brand: getCardBrand(card.card.brand),
                      last4: card.card.last4,
                      days: card.daysUntilExpiry,
                      date: formatDate(card.expiry),
                    })}
                  </span>
                  {idx === 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAddPaymentDialog(true)}
                      className="ml-4 border-orange-600 text-orange-900 dark:text-orange-100 hover:bg-orange-100 dark:hover:bg-orange-900"
                    >
                      {t('paymentMethods.warnings.cardExpiring.updateButton')}
                    </Button>
                  )}
                </div>
              ))}
            </AlertDescription>
          </div>
        </Alert>
      )}

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

      {/* Payment Methods */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              <CardTitle>{t('paymentMethods.title')}</CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowAddPaymentDialog(true)}>
              <CreditCard className="h-4 w-4 mr-2" />
              {t('paymentMethods.addButton')}
            </Button>
          </div>
          <CardDescription>{t('paymentMethods.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingPaymentMethods ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : !paymentMethods?.length ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium">{t('paymentMethods.noPaymentMethods')}</p>
                <p className="text-sm text-muted-foreground mt-1">{t('paymentMethods.addFirst')}</p>
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {paymentMethods.map(method => {
                const isDefault = featuresStatus?.paymentMethod?.last4 === method.card.last4
                return (
                  <Card key={method.id} className={isDefault ? 'border-primary' : ''}>
                    <CardContent className="p-4 space-y-3">
                      {/* Card brand */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {getIcon(method.card.brand)}
                          <div>
                            <p className="text-sm font-medium">{getCardBrand(method.card.brand)}</p>
                            <p className="text-xs text-muted-foreground">{t('paymentMethods.cardEnding', { last4: method.card.last4 })}</p>
                          </div>
                        </div>
                        {isDefault && (
                          <span className="text-[10px] font-medium text-primary border border-primary/30 rounded px-1.5 py-0.5">
                            {t('paymentMethods.defaultBadge')}
                          </span>
                        )}
                      </div>

                      {/* Expiration */}
                      <p className="text-xs text-muted-foreground">
                        {t('paymentMethods.expiresOn', {
                          month: String(method.card.exp_month).padStart(2, '0'),
                          year: method.card.exp_year,
                        })}
                      </p>

                      {/* Actions */}
                      <div className="flex gap-2">
                        {!isDefault && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 text-xs"
                            onClick={() => setDefaultPaymentMethodMutation.mutate(method.id)}
                            disabled={setDefaultPaymentMethodMutation.isPending}
                          >
                            {t('paymentMethods.setDefaultButton')}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setRemovingPaymentMethodId(method.id)}
                          disabled={removePaymentMethodMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

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
                    <SelectItem value="date-desc">Newest First</SelectItem>
                    <SelectItem value="date-asc">Oldest First</SelectItem>
                    <SelectItem value="amount-desc">Highest Amount</SelectItem>
                    <SelectItem value="amount-asc">Lowest Amount</SelectItem>
                  </SelectContent>
                </Select>

                {/* Filter toggle */}
                <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="gap-2">
                  <Filter className="h-4 w-4" />
                  {showFilters ? 'Hide Filters' : 'Show Filters'}
                  {hasActiveFilters && <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">{filteredInvoices.length}</span>}
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
                        Search
                      </Label>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="invoice-search"
                          type="text"
                          placeholder="Invoice # or description..."
                          value={invoiceSearch}
                          onChange={e => setInvoiceSearch(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </div>

                    {/* Status Filter */}
                    <div className="space-y-2">
                      <Label htmlFor="invoice-status" className="text-sm font-medium">
                        Status
                      </Label>
                      <Select value={invoiceStatusFilter} onValueChange={setInvoiceStatusFilter}>
                        <SelectTrigger id="invoice-status">
                          <SelectValue placeholder="All statuses" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="uncollectible">Uncollectible</SelectItem>
                          <SelectItem value="void">Void</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Start Date */}
                    <div className="space-y-2">
                      <Label htmlFor="invoice-start-date" className="text-sm font-medium">
                        From Date
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
                        To Date
                      </Label>
                      <Input
                        id="invoice-end-date"
                        type="date"
                        value={invoiceEndDate}
                        onChange={e => setInvoiceEndDate(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Filter Actions */}
                  <div className="flex items-center justify-between pt-2">
                    <p className="text-sm text-muted-foreground">
                      Showing {filteredInvoices.length} of {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}
                    </p>
                    {hasActiveFilters && (
                      <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-2">
                        <X className="h-4 w-4" />
                        Clear Filters
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
                    <p className="font-medium">No invoices match your filters</p>
                    <p className="text-sm text-muted-foreground mt-1">Try adjusting your search or filter criteria</p>
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
                      <Badge variant={invoice.status === 'paid' ? 'default' : invoice.status === 'open' || invoice.status === 'uncollectible' ? 'destructive' : 'secondary'}>
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
          </AlertDialogHeader>
          {subscribingFeatureCode &&
            (() => {
              const feature = featuresStatus?.availableFeatures.find(f => f.code === subscribingFeatureCode)
              if (!feature) return null

              const hasHadBefore = feature.hadPreviously
              const price = formatCurrency(Number(feature.monthlyPrice) * 100, 'MXN')
              const days = 5

              return (
                <div className="space-y-4 px-6 pb-2">
                      {/* Description */}
                      <p className="text-sm text-muted-foreground">
                        {hasHadBefore
                          ? t('confirmSubscribe.description', { feature: feature.name, price })
                          : t('confirmSubscribe.descriptionWithTrial', { feature: feature.name, price, days })}
                      </p>

                      {/* Payment Method Section */}
                      <div className="border border-border rounded-lg p-4 bg-muted/50">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium">{t('confirmSubscribe.paymentMethod')}</p>
                          {!paymentMethods?.length && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
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
                      trialPeriodDays: feature.hadPreviously ? 0 : 5,
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

      {/* Remove Payment Method Confirmation Dialog */}
      <AlertDialog open={!!removingPaymentMethodId} onOpenChange={() => setRemovingPaymentMethodId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('paymentMethods.confirmRemove.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('paymentMethods.confirmRemove.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('paymentMethods.confirmRemove.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (removingPaymentMethodId) {
                  removePaymentMethodMutation.mutate(removingPaymentMethodId)
                }
              }}
            >
              {t('paymentMethods.confirmRemove.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Payment Method Dialog */}
      <AddPaymentMethodDialog
        open={showAddPaymentDialog}
        onOpenChange={setShowAddPaymentDialog}
        onSuccess={handlePaymentMethodSuccess}
        venueId={venueId}
      />
    </div>
  )
}
