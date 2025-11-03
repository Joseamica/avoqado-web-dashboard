import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  getAvailableBalance,
  getBalanceByCardType,
  getSettlementTimeline,
  getSettlementCalendar,
  type AvailableBalanceSummary,
  type CardTypeBreakdown,
  type TimelineEntry,
  type SettlementCalendarEntry,
  TransactionCardType,
} from '@/services/availableBalance.service'
import { Wallet, TrendingUp, Clock, CreditCard, Calculator, ArrowUpRight, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { Currency } from '@/utils/currency'
import { Skeleton } from '@/components/ui/skeleton'
import { PendingIncidentsAlert } from '@/components/SettlementIncident/PendingIncidentsAlert'

export default function AvailableBalance() {
  const { t } = useTranslation('availableBalance')
  const { venueId } = useCurrentVenue()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [summary, setSummary] = useState<AvailableBalanceSummary | null>(null)
  const [cardBreakdown, setCardBreakdown] = useState<CardTypeBreakdown[]>([])
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [settlementCalendar, setSettlementCalendar] = useState<SettlementCalendarEntry[]>([])

  // Fetch data
  useEffect(() => {
    let mounted = true

    if (!venueId) {
      setLoading(false)
      setError(t('error.noVenue'))
      return
    }

    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch all data in parallel
        const [summaryRes, cardRes, timelineRes, calendarRes] = await Promise.all([
          getAvailableBalance(venueId),
          getBalanceByCardType(venueId),
          getSettlementTimeline(venueId, { includePast: true, includeFuture: true }),
          getSettlementCalendar(venueId), // Next 30 days by default
        ])

        if (mounted) {
          setSummary(summaryRes.data)
          setCardBreakdown(cardRes.data)
          setTimeline(timelineRes.data)
          setSettlementCalendar(calendarRes.data)
        }
      } catch (err: any) {
        if (mounted) {
          setError(err.message || err.response?.data?.message || t('error.unexpected'))
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    fetchData()

    return () => {
      mounted = false
    }
  }, [venueId, t])

  // Card type icon mapping
  const getCardTypeIcon = (cardType: TransactionCardType) => {
    switch (cardType) {
      case TransactionCardType.DEBIT:
        return '💳'
      case TransactionCardType.CREDIT:
        return '💎'
      case TransactionCardType.AMEX:
        return '🔷'
      case TransactionCardType.INTERNATIONAL:
        return '🌍'
      default:
        return '💳'
    }
  }

  // Card type color mapping
  const getCardTypeColor = (cardType: TransactionCardType): string => {
    switch (cardType) {
      case TransactionCardType.DEBIT:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case TransactionCardType.CREDIT:
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      case TransactionCardType.AMEX:
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case TransactionCardType.INTERNATIONAL:
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  // Settlement status badge
  const getStatusBadge = (status: TimelineEntry['settlementStatus']) => {
    switch (status) {
      case 'SETTLED':
        return <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">{t('status.settled')}</Badge>
      case 'PENDING':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">{t('status.pending')}</Badge>
      case 'PROJECTED':
        return <Badge variant="outline">{t('status.projected')}</Badge>
      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>

        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{t('error.prefix')}: {error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!summary) return null

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        <Button>
          <Calculator className="mr-2 h-4 w-4" />
          {t('simulate.button')}
        </Button>
      </div>

      {/* Pending Incidents Alert */}
      {venueId && <PendingIncidentsAlert venueId={venueId} />}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('kpi.availableNow')}</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Currency(summary.availableNow)}</div>
            <p className="text-xs text-muted-foreground">{t('kpi.availableNowDescription')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('kpi.pending')}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Currency(summary.pendingSettlement)}</div>
            <p className="text-xs text-muted-foreground">{t('kpi.pendingDescription')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('kpi.nextSettlement')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Currency(summary.estimatedNextSettlement.amount)}</div>
            {summary.estimatedNextSettlement.date && (
              <p className="text-xs text-muted-foreground">
                {t('kpi.nextSettlementDate', {
                  date: format(new Date(summary.estimatedNextSettlement.date), 'MMM dd, yyyy')
                })}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Settlement Calendar - Money you'll receive each day */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {t('calendar.title', 'Calendario de Liquidaciones')}
          </CardTitle>
          <CardDescription>
            {t('calendar.description', 'Cuánto dinero recibirás cada día según las fechas de liquidación')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('calendar.table.date', 'Fecha de Liquidación')}</TableHead>
                <TableHead>{t('calendar.table.status', 'Estado')}</TableHead>
                <TableHead className="text-right">{t('calendar.table.transactions', 'Transacciones')}</TableHead>
                <TableHead className="text-right">{t('calendar.table.totalAmount', 'Monto Total')}</TableHead>
                <TableHead>{t('calendar.table.breakdown', 'Desglose por Tarjeta')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settlementCalendar.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    {t('calendar.table.noData', 'No hay liquidaciones programadas en los próximos 30 días')}
                  </TableCell>
                </TableRow>
              ) : (
                settlementCalendar.map((entry, idx) => (
                  <TableRow key={idx} className={entry.status === 'SETTLED' ? 'bg-muted/50' : ''}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {format(new Date(entry.settlementDate), 'MMM dd, yyyy')}
                      </div>
                    </TableCell>
                    <TableCell>
                      {entry.status === 'SETTLED' ? (
                        <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          {t('status.settled', 'Liquidado')}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {t('status.pending', 'Pendiente')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{entry.transactionCount}</TableCell>
                    <TableCell className="text-right">
                      <span className="font-bold text-lg">{Currency(entry.totalNetAmount)}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {entry.byCardType.map((cardTypeEntry) => (
                          <div key={cardTypeEntry.cardType} className="flex items-center gap-2 px-3 py-1 rounded-md bg-muted/50">
                            <Badge className={getCardTypeColor(cardTypeEntry.cardType)} variant="secondary">
                              {t(`cardType.${cardTypeEntry.cardType.toLowerCase()}`, cardTypeEntry.cardType)}
                            </Badge>
                            <span className="font-semibold">{Currency(cardTypeEntry.netAmount)}</span>
                            <span className="text-xs text-muted-foreground">({cardTypeEntry.transactionCount})</span>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {settlementCalendar.length > 0 && (
            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                💡 {t('calendar.tip', 'Este calendario muestra exactamente cuánto dinero recibirás cada día. Las transacciones se agrupan por fecha de liquidación, no por fecha de procesamiento.')}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Card Type Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {t('breakdown.title')}
          </CardTitle>
          <CardDescription>{t('breakdown.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('breakdown.table.cardType')}</TableHead>
                <TableHead className="text-right">{t('breakdown.table.transactions')}</TableHead>
                <TableHead className="text-right">{t('breakdown.table.totalSales')}</TableHead>
                <TableHead className="text-right">{t('breakdown.table.fees')}</TableHead>
                <TableHead className="text-right">{t('breakdown.table.netAmount')}</TableHead>
                <TableHead className="text-right">{t('breakdown.table.settlementDays')}</TableHead>
                <TableHead className="text-right">{t('breakdown.table.pending')}</TableHead>
                <TableHead className="text-right">{t('breakdown.table.settled')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cardBreakdown.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    {t('breakdown.table.noData')}
                  </TableCell>
                </TableRow>
              ) : (
                cardBreakdown.map((card) => (
                  <TableRow key={card.cardType}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{getCardTypeIcon(card.cardType)}</span>
                        <Badge className={getCardTypeColor(card.cardType)} variant="secondary">
                          {t(`cardType.${card.cardType.toLowerCase()}`)}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{card.transactionCount}</TableCell>
                    <TableCell className="text-right font-medium">{Currency(card.totalSales)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">-{Currency(card.fees)}</TableCell>
                    <TableCell className="text-right font-bold">{Currency(card.netAmount)}</TableCell>
                    <TableCell className="text-right">
                      {card.settlementDays !== null
                        ? t('breakdown.table.days', { count: card.settlementDays })
                        : '-'
                      }
                    </TableCell>
                    <TableCell className="text-right">{Currency(card.pendingAmount)}</TableCell>
                    <TableCell className="text-right text-success-foreground">
                      {Currency(card.settledAmount)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Settlement Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {t('timeline.title')}
          </CardTitle>
          <CardDescription>{t('timeline.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('timeline.table.date')}</TableHead>
                <TableHead>{t('timeline.table.status')}</TableHead>
                <TableHead className="text-right">{t('timeline.table.transactions')}</TableHead>
                <TableHead className="text-right">{t('timeline.table.gross')}</TableHead>
                <TableHead className="text-right">{t('timeline.table.fees')}</TableHead>
                <TableHead className="text-right">{t('timeline.table.net')}</TableHead>
                <TableHead className="text-right">{t('timeline.table.settlementDate')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {timeline.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {t('timeline.table.noData')}
                  </TableCell>
                </TableRow>
              ) : (
                timeline.slice(0, 10).map((entry, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">
                      {format(new Date(entry.date), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell>{getStatusBadge(entry.settlementStatus)}</TableCell>
                    <TableCell className="text-right">{entry.transactionCount}</TableCell>
                    <TableCell className="text-right">{Currency(entry.grossAmount)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      -{Currency(entry.feesAmount)}
                    </TableCell>
                    <TableCell className="text-right font-bold">{Currency(entry.netAmount)}</TableCell>
                    <TableCell className="text-right">
                      {entry.estimatedSettlementDate
                        ? format(new Date(entry.estimatedSettlementDate), 'MMM dd, yyyy')
                        : '-'
                      }
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {timeline.length > 10 && (
            <div className="flex justify-center mt-4">
              <Button variant="outline" size="sm">
                <ArrowUpRight className="mr-2 h-4 w-4" />
                {t('timeline.viewAll', { count: timeline.length })}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
