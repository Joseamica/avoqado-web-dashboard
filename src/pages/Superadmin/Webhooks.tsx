import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Filter,
  X,
  AlertTriangle,
  TrendingUp,
  Zap,
  Eye,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  listWebhookEvents,
  getWebhookMetrics,
  getEventTypes,
  retryWebhookEvent,
  type WebhookEvent,
  type WebhookMetrics,
} from '@/services/webhook.service'

export default function Webhooks() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

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
    queryKey: [
      'webhookEvents',
      eventTypeFilter,
      statusFilter,
      startDate,
      endDate,
      page,
    ],
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
        title: 'Webhook Retried',
        description: 'The webhook event has been reprocessed successfully.',
      })
      queryClient.invalidateQueries({ queryKey: ['webhookEvents'] })
      queryClient.invalidateQueries({ queryKey: ['webhookMetrics'] })
      setSelectedEvent(null)
    },
    onError: (error: any) => {
      toast({
        title: 'Retry Failed',
        description: error.response?.data?.error || 'Failed to retry webhook event',
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

  const hasActiveFilters =
    eventTypeFilter !== 'all' || statusFilter !== 'all' || startDate || endDate

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
    if (!ms) return 'N/A'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Webhook Monitoring</h1>
        <p className="text-muted-foreground mt-2">
          Monitor Stripe webhook events, debug failures, and track system health
        </p>
      </div>

      {/* Metrics Cards */}
      {metrics && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Success Rate */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics.summary.successRate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {metrics.summary.successCount} / {metrics.summary.totalEvents} events
              </p>
            </CardContent>
          </Card>

          {/* Average Processing Time */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Processing Time</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatProcessingTime(metrics.summary.avgProcessingTime)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Per successful event</p>
            </CardContent>
          </Card>

          {/* Failed Events */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed Events</CardTitle>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {metrics.summary.failedCount}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Require attention</p>
            </CardContent>
          </Card>

          {/* Pending Events */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Events</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.summary.pendingCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Currently processing</p>
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
                Webhook Events
              </CardTitle>
              <CardDescription className="mt-1">
                Real-time log of all Stripe webhook events
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              {showFilters ? 'Hide Filters' : 'Show Filters'}
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
                  <Label htmlFor="event-type">Event Type</Label>
                  <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                    <SelectTrigger id="event-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Events</SelectItem>
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
                  <Label htmlFor="status">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="SUCCESS">Success</SelectItem>
                      <SelectItem value="FAILED">Failed</SelectItem>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="RETRYING">Retrying</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Start Date */}
                <div className="space-y-2">
                  <Label htmlFor="start-date">From Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                  />
                </div>

                {/* End Date */}
                <div className="space-y-2">
                  <Label htmlFor="end-date">To Date</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Filter Actions */}
              <div className="flex items-center justify-between pt-2">
                <p className="text-sm text-muted-foreground">
                  Showing {webhookData?.events.length || 0} of {webhookData?.total || 0} events
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

          {/* Table */}
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">Loading events...</p>
          ) : !webhookData?.events.length ? (
            <p className="text-center py-8 text-muted-foreground">No webhook events found</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date/Time</TableHead>
                    <TableHead>Event Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Venue</TableHead>
                    <TableHead>Processing Time</TableHead>
                    <TableHead>Retries</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {webhookData.events.map(event => (
                    <TableRow key={event.id}>
                      <TableCell className="font-mono text-xs">
                        {format(new Date(event.createdAt), 'MMM dd, HH:mm:ss')}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {event.eventType}
                        </code>
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
                          <span className="text-xs text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-mono">
                          {formatProcessingTime(event.processingTime)}
                        </span>
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
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedEvent(event)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          {event.status === 'FAILED' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRetry(event.id)}
                              disabled={retryingEventId === event.id}
                            >
                              <RefreshCw
                                className={`h-4 w-4 mr-1 ${retryingEventId === event.id ? 'animate-spin' : ''}`}
                              />
                              Retry
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
                  Page {page + 1} of {Math.ceil((webhookData?.total || 0) / limit)}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => p + 1)}
                    disabled={!webhookData?.hasMore}
                  >
                    Next
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
                <SheetTitle>Webhook Event Details</SheetTitle>
                <SheetDescription>
                  Event ID: {selectedEvent.stripeEventId}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Metadata */}
                <div className="space-y-4">
                  <h3 className="font-semibold">Metadata</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Status:</span>
                      <Badge variant={getStatusVariant(selectedEvent.status)} className="ml-2">
                        {selectedEvent.status}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Event Type:</span>
                      <code className="ml-2 text-xs bg-muted px-2 py-1 rounded">
                        {selectedEvent.eventType}
                      </code>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Created:</span>
                      <span className="ml-2 font-mono">
                        {format(new Date(selectedEvent.createdAt), 'MMM dd, yyyy HH:mm:ss')}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Processing Time:</span>
                      <span className="ml-2 font-mono">
                        {formatProcessingTime(selectedEvent.processingTime)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Venue:</span>
                      <span className="ml-2">{selectedEvent.venue?.name || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Retry Count:</span>
                      <span className="ml-2">{selectedEvent.retryCount}</span>
                    </div>
                  </div>
                </div>

                {/* Error Message */}
                {selectedEvent.errorMessage && (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-destructive">Error Message</h3>
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded text-sm">
                      {selectedEvent.errorMessage}
                    </div>
                  </div>
                )}

                {/* JSON Payload */}
                <div className="space-y-2">
                  <h3 className="font-semibold">Event Payload</h3>
                  <pre className="p-4 bg-muted rounded text-xs overflow-auto max-h-96">
                    {JSON.stringify(selectedEvent.payload, null, 2)}
                  </pre>
                </div>

                {/* Actions */}
                {selectedEvent.status === 'FAILED' && (
                  <Button
                    className="w-full"
                    onClick={() => handleRetry(selectedEvent.id)}
                    disabled={retryingEventId === selectedEvent.id}
                  >
                    <RefreshCw
                      className={`h-4 w-4 mr-2 ${retryingEventId === selectedEvent.id ? 'animate-spin' : ''}`}
                    />
                    Retry Webhook Event
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
