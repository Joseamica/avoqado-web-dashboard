import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import {
  getEventTypes,
  getWebhookMetrics,
  listWebhookEvents,
  retryWebhookEvent,
  type WebhookEvent,
  type WebhookMetrics,
} from '@/services/webhook.service'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DateTime } from 'luxon'
import { Activity, AlertTriangle, CheckCircle2, Clock, Eye, Filter, RefreshCw, TrendingUp, X, XCircle, Zap } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useVenueDateTime } from '@/utils/datetime'
import { getIntlLocale } from '@/utils/i18n-locale'

function Webhooks() {
  const { t, i18n } = useTranslation('webhooks')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { venueTimezone } = useVenueDateTime()
  const localeCode = getIntlLocale(i18n.language)

  // Filter states
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)

  // Pagination
  const [page, setPage] = useState(0)
  const limit = 50

  // Detail drawer
  const [selectedEvent, setSelectedEvent] = useState<WebhookEvent | null>(null)
  const [retryingEventId, setRetryingEventId] = useState<string | null>(null)

  // Fetch metrics (last 7 days)
  const { data: metrics } = useQuery<WebhookMetrics>({
    queryKey: ['webhookMetrics'],
    queryFn: () => getWebhookMetrics(),
  })

  // Fetch event types for filter dropdown
  const { data: eventTypes } = useQuery({
    queryKey: ['webhookEventTypes'],
    queryFn: getEventTypes,
  })

  // Fetch webhook events
  const { data: webhookData, isLoading } = useQuery({
    queryKey: ['webhookEvents', eventTypeFilter, statusFilter, startDate, endDate, page],
    queryFn: () =>
      listWebhookEvents({
        eventType: eventTypeFilter !== 'all' ? eventTypeFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        limit,
        offset: page * limit,
      }),
  })

  // Retry mutation
  const retryMutation = useMutation({
    mutationFn: retryWebhookEvent,
    onSuccess: () => {
      toast({
        title: t('toast.retried'),
        description: t('toast.retriedDesc'),
      })
      queryClient.invalidateQueries({ queryKey: ['webhookEvents'] })
      queryClient.invalidateQueries({ queryKey: ['webhookMetrics'] })
      setSelectedEvent(null)
    },
    onError: (error: any) => {
      toast({
        title: t('toast.retryFailed'),
        description: error.response?.data?.error || t('toast.retryFailedDesc'),
        variant: 'destructive',
      })
    },
    onSettled: () => {
      setRetryingEventId(null)
    },
  })

  const handleRetry = (eventId: string) => {
    setRetryingEventId(eventId)
    retryMutation.mutate(eventId)
  }

  // Clear filters
  const clearFilters = () => {
    setEventTypeFilter('all')
    setStatusFilter('all')
    setStartDate('')
    setEndDate('')
    setPage(0)
  }

  const hasActiveFilters = eventTypeFilter !== 'all' || statusFilter !== 'all' || startDate || endDate

  // Status badge variant
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return 'default' // green
      case 'FAILED':
        return 'destructive' // red
      case 'RETRYING':
        return 'secondary' // yellow/orange
      case 'PENDING':
        return 'outline' // gray
      default:
        return 'outline'
    }
  }

  // Format processing time
  const formatProcessingTime = (ms: number | null | undefined) => {
    if (!ms) return t('table.na')
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-2">{t('subtitle')}</p>
      </div>

      {/* Metrics Cards */}
      {metrics && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Success Rate */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('metrics.successRate')}</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.summary.successRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                {metrics.summary.successCount} / {metrics.summary.totalEvents} {t('metrics.events')}
              </p>
            </CardContent>
          </Card>

          {/* Average Processing Time */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('metrics.avgProcessingTime')}</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatProcessingTime(metrics.summary.avgProcessingTime)}</div>
              <p className="text-xs text-muted-foreground mt-1">{t('metrics.perSuccessfulEvent')}</p>
            </CardContent>
          </Card>

          {/* Failed Events */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('metrics.failedEvents')}</CardTitle>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{metrics.summary.failedCount}</div>
              <p className="text-xs text-muted-foreground mt-1">{t('metrics.requireAttention')}</p>
            </CardContent>
          </Card>

          {/* Pending Events */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('metrics.pendingEvents')}</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.summary.pendingCount}</div>
              <p className="text-xs text-muted-foreground mt-1">{t('metrics.currentlyProcessing')}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Webhook Events Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                {t('events.title')}
              </CardTitle>
              <CardDescription className="mt-1">{t('events.description')}</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="gap-2">
              <Filter className="h-4 w-4" />
              {showFilters ? t('events.hideFilters') : t('events.showFilters')}
              {hasActiveFilters && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">
                  {webhookData?.events.length || 0}
                </span>
              )}
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {/* Filters */}
          {showFilters && (
            <div className="mb-6 p-4 border rounded-lg bg-muted/30 space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Event Type Filter */}
                <div className="space-y-2">
                  <Label htmlFor="event-type">{t('filters.eventType')}</Label>
                  <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                    <SelectTrigger id="event-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('filters.allEvents')}</SelectItem>
                      {eventTypes?.map(et => (
                        <SelectItem key={et.type} value={et.type}>
                          {et.type} ({et.count})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Status Filter */}
                <div className="space-y-2">
                  <Label htmlFor="status">{t('filters.status')}</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('filters.allStatuses')}</SelectItem>
                      <SelectItem value="SUCCESS">{t('filters.success')}</SelectItem>
                      <SelectItem value="FAILED">{t('filters.failed')}</SelectItem>
                      <SelectItem value="PENDING">{t('filters.pending')}</SelectItem>
                      <SelectItem value="RETRYING">{t('filters.retrying')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Start Date */}
                <div className="space-y-2">
                  <Label htmlFor="start-date">{t('filters.fromDate')}</Label>
                  <Input id="start-date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>

                {/* End Date */}
                <div className="space-y-2">
                  <Label htmlFor="end-date">{t('filters.toDate')}</Label>
                  <Input id="end-date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
              </div>

              {/* Filter Actions */}
              <div className="flex items-center justify-between pt-2">
                <p className="text-sm text-muted-foreground">
                  {t('events.showing', { count: webhookData?.events.length || 0, total: webhookData?.total || 0 })}
                </p>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-2">
                    <X className="h-4 w-4" />
                    {t('events.clearFilters')}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Table */}
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">{t('events.loading')}</p>
          ) : !webhookData?.events.length ? (
            <p className="text-center py-8 text-muted-foreground">{t('events.noEvents')}</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('table.dateTime')}</TableHead>
                    <TableHead>{t('table.eventType')}</TableHead>
                    <TableHead>{t('table.status')}</TableHead>
                    <TableHead>{t('table.venue')}</TableHead>
                    <TableHead>{t('table.processingTime')}</TableHead>
                    <TableHead>{t('table.retries')}</TableHead>
                    <TableHead className="text-right">{t('table.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {webhookData.events.map(event => (
                    <TableRow key={event.id}>
                      <TableCell className="font-mono text-xs">{DateTime.fromISO(event.createdAt, { zone: 'utc' }).setZone(venueTimezone).setLocale(localeCode).toLocaleString({ month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">{event.eventType}</code>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(event.status)}>
                          {event.status === 'SUCCESS' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                          {event.status === 'FAILED' && <XCircle className="h-3 w-3 mr-1" />}
                          {event.status === 'PENDING' && <Clock className="h-3 w-3 mr-1" />}
                          {event.status === 'RETRYING' && <RefreshCw className="h-3 w-3 mr-1" />}
                          {event.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {event.venue ? (
                          <span className="text-sm">{event.venue.name}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">{t('table.na')}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-mono">{formatProcessingTime(event.processingTime)}</span>
                      </TableCell>
                      <TableCell>
                        {event.retryCount > 0 ? (
                          <Badge variant="outline" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {event.retryCount}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedEvent(event)}>
                            <Eye className="h-4 w-4 mr-1" />
                            {t('table.view')}
                          </Button>
                          {event.status === 'FAILED' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRetry(event.id)}
                              disabled={retryingEventId === event.id}
                            >
                              <RefreshCw className={`h-4 w-4 mr-1 ${retryingEventId === event.id ? 'animate-spin' : ''}`} />
                              {t('table.retry')}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  {t('pagination.page', { current: page + 1, total: Math.ceil((webhookData?.total || 0) / limit) })}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
                    {t('pagination.previous')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={!webhookData?.hasMore}>
                    {t('pagination.next')}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Event Detail Drawer */}
      <Sheet open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selectedEvent && (
            <>
              <SheetHeader>
                <SheetTitle>{t('detail.title')}</SheetTitle>
                <SheetDescription>{t('detail.eventId')}: {selectedEvent.stripeEventId}</SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Metadata */}
                <div className="space-y-4">
                  <h3 className="font-semibold">{t('detail.metadata')}</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">{t('detail.statusLabel')}</span>
                      <Badge variant={getStatusVariant(selectedEvent.status)} className="ml-2">
                        {selectedEvent.status}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('detail.eventTypeLabel')}</span>
                      <code className="ml-2 text-xs bg-muted px-2 py-1 rounded">{selectedEvent.eventType}</code>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('detail.createdLabel')}</span>
                      <span className="ml-2 font-mono">{DateTime.fromISO(selectedEvent.createdAt, { zone: 'utc' }).setZone(venueTimezone).setLocale(localeCode).toLocaleString({ month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('detail.processingTimeLabel')}</span>
                      <span className="ml-2 font-mono">{formatProcessingTime(selectedEvent.processingTime)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('detail.venueLabel')}</span>
                      <span className="ml-2">{selectedEvent.venue?.name || t('table.na')}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('detail.retryCountLabel')}</span>
                      <span className="ml-2">{selectedEvent.retryCount}</span>
                    </div>
                  </div>
                </div>

                {/* Error Message */}
                {selectedEvent.errorMessage && (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-destructive">{t('detail.errorMessage')}</h3>
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded text-sm">{selectedEvent.errorMessage}</div>
                  </div>
                )}

                {/* JSON Payload */}
                <div className="space-y-2">
                  <h3 className="font-semibold">{t('detail.eventPayload')}</h3>
                  <pre className="p-4 bg-muted rounded text-xs overflow-auto max-h-96">
                    {JSON.stringify(selectedEvent.payload, null, 2)}
                  </pre>
                </div>

                {/* Actions */}
                {selectedEvent.status === 'FAILED' && (
                  <Button className="w-full" onClick={() => handleRetry(selectedEvent.id)} disabled={retryingEventId === selectedEvent.id}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${retryingEventId === selectedEvent.id ? 'animate-spin' : ''}`} />
                    {t('detail.retryWebhook')}
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

export default Webhooks
