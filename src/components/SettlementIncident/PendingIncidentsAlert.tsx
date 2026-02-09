import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { GlassCard } from '@/components/ui/glass-card'
import { AlertCircle, ChevronRight, CheckCircle2, Loader2, Calendar, Banknote, Globe } from 'lucide-react'
import { getVenueIncidents, bulkConfirmIncidents, SettlementIncident } from '@/services/settlementIncident.service'
import getIcon from '@/utils/getIcon'
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
  const { t: tBalance } = useTranslation('availableBalance')
  const { formatDate } = useVenueDateTime()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const localeCode = getIntlLocale(i18n.language)

  const [selectedIncident, setSelectedIncident] = useState<SettlementIncident | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())
  const [isOpen, setIsOpen] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['settlement-incidents', venueId, 'pending'],
    queryFn: () => getVenueIncidents(venueId, { status: 'pending' }),
    refetchInterval: 60000, // Refetch every minute
  })

  const pendingIncidents = useMemo(() => data?.data || [], [data?.data])

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

  // Translate card type key (DEBIT → "Débito") and get brand icon
  const translateCardType = (cardType: string) =>
    tBalance(`cardType.${cardType.toLowerCase()}`, cardType)

  const getCardTypeIcon = (cardType: string) => {
    const upper = cardType.toUpperCase()
    // AMEX has a direct SVG match in getIcon
    if (upper === 'AMEX') return getIcon('amex')
    // DEBIT maps to Visa (most common debit brand in MX)
    if (upper === 'DEBIT') return getIcon('visa')
    // CREDIT maps to Mastercard (generic credit)
    if (upper === 'CREDIT') return getIcon('mastercard')
    // INTERNATIONAL / CASH / unknown → lucide icon
    if (upper === 'INTERNATIONAL') return <Globe className="h-4 w-4 text-muted-foreground" />
    if (upper === 'CASH') return <Banknote className="h-4 w-4 text-muted-foreground" />
    return getIcon(cardType)
  }

  if (isLoading) {
    return <Skeleton className="h-16 w-full rounded-2xl" />
  }

  if (error || pendingIncidents.length === 0) {
    return null
  }

  const totalPendingAmount = pendingIncidents.reduce((sum, incident) => sum + Number(incident.amount), 0)
  const formattedTotalAmount = formatCurrency(totalPendingAmount)

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <GlassCard className="border-orange-500/30">
          {/* Compact header — always visible */}
          <CollapsibleTrigger asChild>
            <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors rounded-2xl">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-500/5 shrink-0">
                  <AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm">
                      {t('pendingAlert.title', { count: pendingIncidents.length })}
                    </h3>
                    <span className="text-sm font-bold">{formattedTotalAmount}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {t('pendingIncidents.description')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                {/* Confirm All — visible in collapsed state */}
                {pendingIncidents.length > 1 && (
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleConfirmAll()
                    }}
                    disabled={bulkConfirmMutation.isPending}
                  >
                    {bulkConfirmMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    {t('pendingIncidents.confirmAll', { count: pendingIncidents.length })}
                  </Button>
                )}
                <ChevronRight className={cn('w-4 h-4 text-muted-foreground transition-transform', isOpen && 'rotate-90')} />
              </div>
            </div>
          </CollapsibleTrigger>

          {/* Expandable detail — date groups */}
          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-2">
              <div className="h-px bg-border/50" />

              {dateGroups.map((group) => {
                const isExpanded = expandedDates.has(group.date)
                const hasMultiple = group.incidents.length > 1

                return (
                  <div key={group.date} className="rounded-lg border border-border/30 bg-card/50">
                    <div className="flex items-center justify-between p-3 gap-2">
                      <button
                        className="flex items-center gap-2 flex-1 text-left hover:opacity-80 transition-opacity min-w-0"
                        onClick={() => toggleExpanded(group.date)}
                      >
                        <ChevronRight
                          className={cn(
                            'h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0',
                            isExpanded && 'rotate-90'
                          )}
                        />
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium">{group.formattedDate}</span>
                        <div className="flex flex-wrap gap-1 min-w-0">
                          {Array.from(group.byCardType.entries()).map(([cardType, stats]) => (
                            <Badge key={cardType} variant="outline" className="text-[10px] font-normal py-0 h-5 gap-1">
                              <span className="[&_figure]:w-5 [&_figure]:h-4 [&_figure]:p-0 [&_figure]:border-0 [&_figure]:shadow-none [&_figure]:rounded-none flex items-center">
                                {getCardTypeIcon(cardType)}
                              </span>
                              {translateCardType(cardType)} ({stats.count}) · {formatCurrency(stats.amount)}
                            </Badge>
                          ))}
                        </div>
                      </button>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-bold">{formatCurrency(group.totalAmount)}</span>
                        {hasMultiple ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
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
                        ) : (
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleConfirmClick(group.incidents[0])
                            }}
                          >
                            {t('pendingIncidents.confirmButton')}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Expanded individual items */}
                    {isExpanded && (
                      <div className="border-t border-border/30 px-3 py-2 space-y-1.5 bg-muted/10">
                        {group.incidents.map((incident) => (
                          <div
                            key={incident.id}
                            className="flex items-center justify-between rounded-md bg-muted/30 p-2 text-sm"
                          >
                            <div className="flex items-center gap-2">
                              <span className="[&_figure]:w-5 [&_figure]:h-4 [&_figure]:p-0 [&_figure]:border-0 [&_figure]:shadow-none [&_figure]:rounded-none flex items-center">
                                {getCardTypeIcon(incident.cardType)}
                              </span>
                              <span className="font-medium">
                                {formatCurrency(Number(incident.amount))}
                              </span>
                              <Badge variant="outline" className="text-[10px] py-0 h-5">
                                {incident.processorName}
                              </Badge>
                              <Badge variant="secondary" className="text-[10px] py-0 h-5">
                                {translateCardType(incident.cardType)}
                              </Badge>
                            </div>
                            <Button
                              onClick={() => handleConfirmClick(incident)}
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                            >
                              {t('pendingIncidents.confirmButton')}
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CollapsibleContent>
        </GlassCard>
      </Collapsible>

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
