import api from '@/api'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { formatTokenCount } from '@/hooks/use-token-budget'
import { downloadInvoice, getVenueInvoices, type StripeInvoice } from '@/services/features.service'
import { getTokenHistory, type TokenPurchaseRecord } from '@/services/chatService'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { AlertCircle, Download, ExternalLink, Filter, Search, X, Zap, CreditCard } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

// Unified billing item type
type BillingItem = {
  id: string
  date: Date
  type: 'invoice' | 'token_purchase'
  concept: string
  amount: number
  currency: string
  status: string
  // Invoice-specific
  invoice?: StripeInvoice
  // Token purchase-specific
  tokenPurchase?: TokenPurchaseRecord
}

export default function History() {
  const { t, i18n } = useTranslation('billing')
  const { venueId, venue } = useCurrentVenue()
  const { toast } = useToast()

  // Get venue currency (default to MXN for Mexican venues)
  const venueCurrency = venue?.currency || 'MXN'
  const queryClient = useQueryClient()

  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null)
  const [retryingInvoiceId, setRetryingInvoiceId] = useState<string | null>(null)

  // Invoice filters
  const [invoiceSearch, setInvoiceSearch] = useState('')
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<string>('all')
  const [invoiceStartDate, setInvoiceStartDate] = useState('')
  const [invoiceEndDate, setInvoiceEndDate] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Invoice sorting
  const [invoiceSort, setInvoiceSort] = useState<string>('date-desc')

  // Fetch invoices
  const { data: invoices, isLoading: loadingInvoices } = useQuery<StripeInvoice[]>({
    queryKey: ['venueInvoices', venueId],
    queryFn: () => getVenueInvoices(venueId),
    enabled: !!venueId,
  })

  // Fetch token purchases
  const { data: tokenHistory, isLoading: loadingTokens } = useQuery({
    queryKey: ['tokenHistory', venueId],
    queryFn: () => getTokenHistory({ limit: 100 }),
    enabled: !!venueId,
  })

  const tokenPurchases = tokenHistory?.purchases?.records || []

  // Combine invoices and token purchases into unified billing items
  const allBillingItems = useMemo((): BillingItem[] => {
    const items: BillingItem[] = []

    // Add invoices
    if (invoices) {
      invoices.forEach(invoice => {
        items.push({
          id: invoice.id,
          date: new Date(invoice.created * 1000),
          type: 'invoice',
          concept: invoice.description || `Invoice #${invoice.number}`,
          amount: invoice.amount_due,
          currency: invoice.currency.toUpperCase(),
          status: invoice.status,
          invoice,
        })
      })
    }

    // Add token purchases (amountPaid is now stored in venue's local currency)
    tokenPurchases.forEach(purchase => {
      items.push({
        id: purchase.id,
        date: new Date(purchase.createdAt),
        type: 'token_purchase',
        concept: `${formatTokenCount(purchase.tokenAmount)} tokens`,
        amount: Math.round(parseFloat(purchase.amountPaid) * 100), // Convert to cents/centavos
        currency: venueCurrency, // Use venue's configured currency (default MXN)
        status: purchase.status.toLowerCase(),
        tokenPurchase: purchase,
      })
    })

    return items
  }, [invoices, tokenPurchases, venueCurrency])

  // Filter and sort billing items
  const filteredBillingItems = useMemo(() => {
    const filtered = allBillingItems.filter(item => {
      if (invoiceSearch) {
        const searchLower = invoiceSearch.toLowerCase()
        const matchesConcept = item.concept.toLowerCase().includes(searchLower)
        if (!matchesConcept) return false
      }

      if (invoiceStatusFilter !== 'all' && item.status !== invoiceStatusFilter) {
        return false
      }

      if (invoiceStartDate) {
        const startDate = new Date(invoiceStartDate)
        if (item.date < startDate) return false
      }
      if (invoiceEndDate) {
        const endDate = new Date(invoiceEndDate)
        endDate.setHours(23, 59, 59, 999)
        if (item.date > endDate) return false
      }

      return true
    })

    const sorted = [...filtered].sort((a, b) => {
      switch (invoiceSort) {
        case 'date-desc':
          return b.date.getTime() - a.date.getTime()
        case 'date-asc':
          return a.date.getTime() - b.date.getTime()
        case 'amount-desc':
          return b.amount - a.amount
        case 'amount-asc':
          return a.amount - b.amount
        default:
          return b.date.getTime() - a.date.getTime()
      }
    })

    return sorted
  }, [allBillingItems, invoiceSearch, invoiceStatusFilter, invoiceStartDate, invoiceEndDate, invoiceSort])

  const clearFilters = () => {
    setInvoiceSearch('')
    setInvoiceStatusFilter('all')
    setInvoiceStartDate('')
    setInvoiceEndDate('')
  }

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

  const handleRetryInvoice = (invoiceId: string) => {
    setRetryingInvoiceId(invoiceId)
    retryInvoicePaymentMutation.mutate(invoiceId)
  }

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

  // Helper to get status badge variant for billing items
  const getStatusVariant = (item: BillingItem): 'default' | 'secondary' | 'destructive' => {
    if (item.type === 'invoice') {
      if (item.status === 'paid') return 'default'
      if (item.status === 'open' || item.status === 'uncollectible') return 'destructive'
      return 'secondary'
    } else {
      // Token purchase
      if (item.status === 'completed') return 'default'
      if (item.status === 'failed' || item.status === 'refunded') return 'destructive'
      return 'secondary'
    }
  }

  // Helper to get status label
  const getStatusLabel = (item: BillingItem): string => {
    if (item.type === 'invoice') {
      return t(`billingHistory.status.${item.status}`)
    } else {
      return t(`tokenPurchases.status.${item.status}`)
    }
  }

  // Helper to get concept type label
  const getConceptTypeLabel = (item: BillingItem): string => {
    if (item.type === 'invoice') {
      return t('billingHistory.conceptType.subscription')
    } else {
      return t('billingHistory.conceptType.tokens')
    }
  }

  // Check if data is loading
  const isLoading = loadingInvoices || loadingTokens

  return (
    <div className="px-8 pt-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              {t('billingHistory.title')}
            </CardTitle>
            {allBillingItems.length > 0 && (
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
                      {filteredBillingItems.length}
                    </span>
                  )}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">{t('loading')}</p>
          ) : allBillingItems.length === 0 ? (
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
                          <SelectItem value="completed">{t('tokenPurchases.status.completed')}</SelectItem>
                          <SelectItem value="open">{t('billingHistory.status.open')}</SelectItem>
                          <SelectItem value="pending">{t('tokenPurchases.status.pending')}</SelectItem>
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
                      {t('billingHistory.filters.showing', { count: filteredBillingItems.length, total: allBillingItems.length })}
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
              {filteredBillingItems.length === 0 ? (
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
                      <TableHead>{t('billingHistory.columns.type')}</TableHead>
                      <TableHead>{t('billingHistory.columns.description')}</TableHead>
                      <TableHead>{t('billingHistory.columns.amount')}</TableHead>
                      <TableHead>{t('billingHistory.columns.status')}</TableHead>
                      <TableHead className="text-right">{t('billingHistory.columns.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBillingItems.map(item => (
                      <TableRow key={item.id}>
                        <TableCell>{formatDate(item.date)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="gap-1">
                            {item.type === 'invoice' ? (
                              <CreditCard className="h-3 w-3" />
                            ) : (
                              <Zap className="h-3 w-3 text-yellow-500" />
                            )}
                            {getConceptTypeLabel(item)}
                          </Badge>
                        </TableCell>
                        <TableCell>{item.concept}</TableCell>
                        <TableCell>{formatCurrency(item.amount, item.currency)}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(item)}>
                            {getStatusLabel(item)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Invoice-specific actions */}
                            {item.type === 'invoice' && item.invoice && (
                              <>
                                {(item.status === 'open' || item.status === 'uncollectible') && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleRetryInvoice(item.invoice!.id)}
                                    disabled={retryingInvoiceId === item.invoice!.id}
                                    className="border-orange-600 text-orange-900 dark:text-orange-100 hover:bg-orange-100 dark:hover:bg-orange-900"
                                  >
                                    {retryingInvoiceId === item.invoice!.id ? t('billingHistory.retrying') : t('billingHistory.retryButton')}
                                  </Button>
                                )}
                                {/* Receipt link for paid invoices */}
                                {item.status === 'paid' && item.invoice.hosted_invoice_url && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    asChild
                                  >
                                    <a href={item.invoice.hosted_invoice_url} target="_blank" rel="noopener noreferrer">
                                      <ExternalLink className="h-4 w-4 mr-2" />
                                      {t('billingHistory.viewReceiptButton')}
                                    </a>
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDownloadInvoice(item.invoice!.id)}
                                  disabled={downloadingInvoiceId === item.invoice!.id}
                                >
                                  <Download className="h-4 w-4 mr-2" />
                                  {downloadingInvoiceId === item.invoice!.id ? t('billingHistory.downloading') : t('billingHistory.downloadButton')}
                                </Button>
                              </>
                            )}
                            {/* Token purchase - show view receipt and download invoice buttons */}
                            {item.type === 'token_purchase' && item.tokenPurchase && item.status === 'completed' && (
                              <>
                                {/* View Receipt - hosted invoice URL */}
                                {item.tokenPurchase.stripeReceiptUrl && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    asChild
                                  >
                                    <a href={item.tokenPurchase.stripeReceiptUrl} target="_blank" rel="noopener noreferrer">
                                      <ExternalLink className="h-4 w-4 mr-2" />
                                      {t('billingHistory.viewReceiptButton')}
                                    </a>
                                  </Button>
                                )}
                                {/* Download Invoice PDF */}
                                {item.tokenPurchase.stripeInvoicePdfUrl && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    asChild
                                  >
                                    <a href={item.tokenPurchase.stripeInvoicePdfUrl} target="_blank" rel="noopener noreferrer">
                                      <Download className="h-4 w-4 mr-2" />
                                      {t('billingHistory.downloadButton')}
                                    </a>
                                  </Button>
                                )}
                              </>
                            )}
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
    </div>
  )
}
