import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { AlertCircle, Clock, DollarSign, ChevronRight, CheckCircle2, Loader2, Calendar } from 'lucide-react'
import { getVenueIncidents, bulkConfirmIncidents, SettlementIncident } from '@/services/settlementIncident.service'
import { ConfirmIncidentDialog } from './ConfirmIncidentDialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useVenueDateTime } from '@/utils/datetime'
import { getIntlLocale } from '@/utils/i18n-locale'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface PendingIncidentsAlertProps {
  venueId: string
}

interface DateGroup {
  date: string
  formattedDate: string
  incidents: SettlementIncident[]
  totalAmount: number
  byCardType: Map<string, { count: number; amount: number }>
}

export function PendingIncidentsAlert({ venueId }: PendingIncidentsAlertProps) {
  const { t, i18n } = useTranslation(['settlementIncidents', 'common'])
  const { formatDate } = useVenueDateTime()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const localeCode = getIntlLocale(i18n.language)

  const [selectedIncident, setSelectedIncident] = useState<SettlementIncident | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())

  const { data, isLoading, error } = useQuery({
    queryKey: ['settlement-incidents', venueId, 'pending'],
    queryFn: () => getVenueIncidents(venueId, { status: 'pending' }),
    refetchInterval: 60000, // Refetch every minute
  })

  const pendingIncidents = data?.data || []

  // Bulk confirm mutation
  const bulkConfirmMutation = useMutation({
    mutationFn: (incidentIds: string[]) =>
      bulkConfirmIncidents(venueId, incidentIds, {
        settlementArrived: true,
        actualDate: new Date().toISOString(),
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['settlement-incidents', venueId] })
      toast({
        title: t('bulkConfirm.success'),
        description: t('bulkConfirm.successDescription', { count: result.data.confirmed }),
      })
    },
    onError: (error: any) => {
      toast({
        title: t('bulkConfirm.error'),
        description: error.message || t('common:error.unexpected'),
        variant: 'destructive',
      })
    },
  })

  // Group incidents by estimated settlement date
  const dateGroups = useMemo((): DateGroup[] => {
    const groups = new Map<string, DateGroup>()

    for (const incident of pendingIncidents) {
      const dateKey = incident.estimatedSettlementDate.split('T')[0]

      if (!groups.has(dateKey)) {
        groups.set(dateKey, {
          date: dateKey,
          formattedDate: formatDate(incident.estimatedSettlementDate),
          incidents: [],
          totalAmount: 0,
          byCardType: new Map(),
        })
      }

      const group = groups.get(dateKey)!
      group.incidents.push(incident)
      group.totalAmount += Number(incident.amount)

      // Group by card type within date
      const cardType = incident.cardType
      if (!group.byCardType.has(cardType)) {
        group.byCardType.set(cardType, { count: 0, amount: 0 })
      }
      const cardTypeStats = group.byCardType.get(cardType)!
      cardTypeStats.count += 1
      cardTypeStats.amount += Number(incident.amount)
    }

    // Sort by date (ascending - earliest first)
    return Array.from(groups.values()).sort((a, b) => a.date.localeCompare(b.date))
  }, [pendingIncidents, formatDate])

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat(localeCode, {
      style: 'currency',
      currency: 'MXN',
    }).format(amount)

  const toggleExpanded = (date: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev)
      if (next.has(date)) {
        next.delete(date)
      } else {
        next.add(date)
      }
      return next
    })
  }

  const handleConfirmClick = (incident: SettlementIncident) => {
    setSelectedIncident(incident)
    setDialogOpen(true)
  }

  const handleConfirmDate = (dateGroup: DateGroup) => {
    const incidentIds = dateGroup.incidents.map((i) => i.id)
    bulkConfirmMutation.mutate(incidentIds)
  }

  const handleConfirmAll = () => {
    const incidentIds = pendingIncidents.map((i) => i.id)
    bulkConfirmMutation.mutate(incidentIds)
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return null // Silently fail - this is not critical
  }

  if (pendingIncidents.length === 0) {
    return null // Don't show anything if no pending incidents
  }

  const totalPendingAmount = pendingIncidents.reduce((sum, incident) => sum + Number(incident.amount), 0)
  const formattedTotalAmount = formatCurrency(totalPendingAmount)

  return (
    <>
      <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
        <AlertCircle className="h-5 w-5 text-orange-600" />
        <AlertTitle className="text-orange-900 dark:text-orange-100">
          {t('pendingAlert.title', { count: pendingIncidents.length })}
        </AlertTitle>
        <AlertDescription className="text-orange-800 dark:text-orange-200">
          {t('pendingAlert.description', { amount: formattedTotalAmount })}
        </AlertDescription>
      </Alert>

      <Card className="mt-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                {t('pendingIncidents.title')}
              </CardTitle>
              <CardDescription>{t('pendingIncidents.description')}</CardDescription>
            </div>
            {/* Global Confirm All Button */}
            {pendingIncidents.length > 1 && (
              <Button
                onClick={handleConfirmAll}
                disabled={bulkConfirmMutation.isPending}
                className="shrink-0"
              >
                {bulkConfirmMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                {t('pendingIncidents.confirmAll', { count: pendingIncidents.length })}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {dateGroups.map((group) => {
            const isExpanded = expandedDates.has(group.date)
            const hasMultiple = group.incidents.length > 1

            return (
              <Collapsible
                key={group.date}
                open={isExpanded}
                onOpenChange={() => toggleExpanded(group.date)}
              >
                <div className="rounded-lg border bg-card">
                  {/* Date Group Header */}
                  <div className="flex items-center justify-between p-4">
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center gap-3 flex-1 text-left hover:opacity-80 transition-opacity">
                        <ChevronRight
                          className={cn(
                            'h-4 w-4 text-muted-foreground transition-transform',
                            isExpanded && 'rotate-90'
                          )}
                        />
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{group.formattedDate}</span>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {t('pendingIncidents.transactionCount', { count: group.incidents.length })}
                        </Badge>
                        <span className="text-lg font-bold ml-auto mr-4">
                          {formatCurrency(group.totalAmount)}
                        </span>
                      </button>
                    </CollapsibleTrigger>
                    {/* Confirm All for Date Button */}
                    {hasMultiple && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleConfirmDate(group)
                        }}
                        disabled={bulkConfirmMutation.isPending}
                      >
                        {bulkConfirmMutation.isPending ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                        )}
                        {t('pendingIncidents.confirmDate')}
                      </Button>
                    )}
                    {!hasMultiple && (
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleConfirmClick(group.incidents[0])
                        }}
                      >
                        {t('pendingIncidents.confirmButton')}
                      </Button>
                    )}
                  </div>

                  {/* Card Type Summary (always visible) */}
                  <div className="px-4 pb-3 flex flex-wrap gap-2">
                    {Array.from(group.byCardType.entries()).map(([cardType, stats]) => (
                      <Badge
                        key={cardType}
                        variant="outline"
                        className="text-xs font-normal"
                      >
                        {cardType} ({stats.count}) · {formatCurrency(stats.amount)}
                      </Badge>
                    ))}
                  </div>

                  {/* Expanded Individual Items */}
                  <CollapsibleContent>
                    <div className="border-t px-4 py-3 space-y-2 bg-muted/30">
                      {group.incidents.map((incident) => (
                        <div
                          key={incident.id}
                          className="flex items-center justify-between rounded-md border bg-background p-3"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {formatCurrency(Number(incident.amount))}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {incident.processorName}
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                {incident.cardType}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>
                                {t('pendingIncidents.expectedOn')} {group.formattedDate}
                              </span>
                            </div>
                          </div>
                          <Button
                            onClick={() => handleConfirmClick(incident)}
                            size="sm"
                            variant="ghost"
                          >
                            {t('pendingIncidents.confirmButton')}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            )
          })}

          {/* Total Summary */}
          <div className="flex items-center justify-between rounded-lg bg-muted p-4 mt-4">
            <div className="flex items-center gap-2 font-semibold">
              <DollarSign className="h-5 w-5" />
              {t('pendingIncidents.totalPending')}
            </div>
            <div className="text-lg font-bold">{formattedTotalAmount}</div>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <ConfirmIncidentDialog
        incident={selectedIncident}
        venueId={venueId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  )
}
