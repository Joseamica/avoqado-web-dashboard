import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { DateTime } from 'luxon'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  simulateTransaction,
  type AvailableBalanceSummary,
  type CardTypeBreakdown,
  type TimelineEntry,
  type SettlementCalendarEntry,
  type SimulationParams,
  type SimulationResult,
  TransactionCardType,
} from '@/services/availableBalance.service'
import { getExpectedCash } from '@/services/cashCloseout.service'
import { Wallet, TrendingUp, Clock, CreditCard, Calculator, ArrowUpRight, Calendar, Banknote, AlertCircle } from 'lucide-react'
import { Currency } from '@/utils/currency'
import { useVenueDateTime } from '@/utils/datetime'
import { Skeleton } from '@/components/ui/skeleton'
import { PendingIncidentsAlert } from '@/components/SettlementIncident/PendingIncidentsAlert'
import { CreditOfferBanner } from '@/components/CreditOffer/CreditOfferBanner'
import { CashCloseoutDialog } from '@/components/CashCloseout/CashCloseoutDialog'
import { CashCloseoutHistory } from '@/components/CashCloseout/CashCloseoutHistory'
import { useToast } from '@/hooks/use-toast'

// Tab filter type
type TabValue = 'all' | 'cards' | 'cash'

export default function AvailableBalance() {
  const { t } = useTranslation('availableBalance')
  const { t: tCashCloseout } = useTranslation('cashCloseout')
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { formatDate } = useVenueDateTime()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [summary, setSummary] = useState<AvailableBalanceSummary | null>(null)
  const [cardBreakdown, setCardBreakdown] = useState<CardTypeBreakdown[]>([])
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [settlementCalendar, setSettlementCalendar] = useState<SettlementCalendarEntry[]>([])

  // Simulation dialog state
  const [showSimulationDialog, setShowSimulationDialog] = useState(false)
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null)
  const [simulationLoading, setSimulationLoading] = useState(false)

  // Cash closeout dialog state
  const [showCloseoutDialog, setShowCloseoutDialog] = useState(false)

  // Query for expected cash info (for alert banner and metadata)
  const { data: expectedCashData } = useQuery({
    queryKey: ['cash-closeout', 'expected', venueId],
    queryFn: () => getExpectedCash(venueId!),
    enabled: !!venueId,
  })

  // Simulation form
  const simulationForm = useForm<SimulationParams>({
    defaultValues: {
      amount: 0,
      cardType: TransactionCardType.DEBIT,
      transactionDate: DateTime.now().toISODate() || '',
      transactionTime: '',
    },
  })

  // Tab filter state
  const [activeTab, setActiveTab] = useState<TabValue>('all')

  // Helper to check if a card type is cash
  const isCash = (cardType: TransactionCardType) => cardType === TransactionCardType.CASH

  // Filter card breakdown based on active tab
  const filteredCardBreakdown = useMemo(() => {
    if (activeTab === 'all') return cardBreakdown
    if (activeTab === 'cash') return cardBreakdown.filter(c => isCash(c.cardType))
    return cardBreakdown.filter(c => !isCash(c.cardType))
  }, [cardBreakdown, activeTab])

  // Filter settlement calendar based on active tab
  const filteredCalendar = useMemo(() => {
    if (activeTab === 'all') return settlementCalendar
    return settlementCalendar.map(entry => ({
      ...entry,
      byCardType: activeTab === 'cash'
        ? entry.byCardType.filter(c => c.cardType === TransactionCardType.CASH)
        : entry.byCardType.filter(c => c.cardType !== TransactionCardType.CASH),
      totalNetAmount: activeTab === 'cash'
        ? entry.byCardType.filter(c => c.cardType === TransactionCardType.CASH).reduce((sum, c) => sum + c.netAmount, 0)
        : entry.byCardType.filter(c => c.cardType !== TransactionCardType.CASH).reduce((sum, c) => sum + c.netAmount, 0),
      transactionCount: activeTab === 'cash'
        ? entry.byCardType.filter(c => c.cardType === TransactionCardType.CASH).reduce((sum, c) => sum + c.transactionCount, 0)
        : entry.byCardType.filter(c => c.cardType !== TransactionCardType.CASH).reduce((sum, c) => sum + c.transactionCount, 0),
    })).filter(entry => entry.byCardType.length > 0)
  }, [settlementCalendar, activeTab])

  // Compute filtered summary based on tab
  const filteredSummary = useMemo(() => {
    if (!summary || activeTab === 'all') return summary

    const breakdown = filteredCardBreakdown
    return {
      ...summary,
      totalSales: breakdown.reduce((sum, c) => sum + c.totalSales, 0),
      totalFees: breakdown.reduce((sum, c) => sum + c.fees, 0),
      availableNow: breakdown.reduce((sum, c) => sum + c.settledAmount, 0),
      pendingSettlement: breakdown.reduce((sum, c) => sum + c.pendingAmount, 0),
      estimatedNextSettlement: activeTab === 'cash'
        ? { date: null, amount: 0 } // Cash has no pending settlement
        : summary.estimatedNextSettlement,
    }
  }, [summary, filteredCardBreakdown, activeTab])

  // Count transactions for tab badges
  const tabCounts = useMemo(() => {
    const total = cardBreakdown.reduce((sum, c) => sum + c.transactionCount, 0)
    const cashCount = cardBreakdown.filter(c => isCash(c.cardType)).reduce((sum, c) => sum + c.transactionCount, 0)
    const cardsCount = total - cashCount
    return { total, cashCount, cardsCount }
  }, [cardBreakdown])

  // Separate amounts for "All" tab display
  const separateAmounts = useMemo(() => {
    const cashItems = cardBreakdown.filter(c => isCash(c.cardType))
    const cardItems = cardBreakdown.filter(c => !isCash(c.cardType))
    return {
      cashAvailable: cashItems.reduce((sum, c) => sum + c.settledAmount, 0),
      cardsAvailable: cardItems.reduce((sum, c) => sum + c.settledAmount, 0),
      cardsPending: cardItems.reduce((sum, c) => sum + c.pendingAmount, 0),
    }
  }, [cardBreakdown])

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

  // Handle simulation submission
  const handleSimulation = async (data: SimulationParams) => {
    if (!venueId) return

    try {
      setSimulationLoading(true)

      // Handle CASH simulation locally (instant settlement, 0 fees)
      if (data.cardType === TransactionCardType.CASH) {
        setSimulationResult({
          simulatedAmount: data.amount,
          cardType: TransactionCardType.CASH,
          transactionDate: data.transactionDate,
          estimatedSettlementDate: data.transactionDate, // Same day
          settlementDays: 0, // Instant
          grossAmount: data.amount,
          fees: 0, // No fees for cash
          netAmount: data.amount, // 100% of amount
          configuration: {
            settlementDays: 0,
            settlementDayType: 'CALENDAR_DAYS' as const,
            cutoffTime: '23:59',
          },
        })
        return
      }

      // Convert yyyy-MM-dd to ISO 8601 format for card payments
      const dateObj = new Date(data.transactionDate + 'T00:00:00')
      const isoDate = dateObj.toISOString()

      // Format the payload properly
      const payload: SimulationParams = {
        amount: data.amount,
        cardType: data.cardType,
        transactionDate: isoDate, // Convert to ISO format
        transactionTime: data.transactionTime || undefined, // Don't send empty string, send undefined
      }

      const response = await simulateTransaction(venueId, payload)
      setSimulationResult(response.data)
    } catch (err: any) {
      toast({
        title: t('simulate.error'),
        description: err.message || err.response?.data?.message || t('error.unexpected'),
        variant: 'destructive',
      })
    } finally {
      setSimulationLoading(false)
    }
  }

  // Reset simulation dialog
  const handleCloseSimulation = () => {
    setShowSimulationDialog(false)
    setSimulationResult(null)
    simulationForm.reset({
      amount: 0,
      cardType: TransactionCardType.DEBIT,
      transactionDate: DateTime.now().toISODate() || '',
      transactionTime: '',
    })
  }

  // Handle successful cash closeout - refetch all balance data
  const handleCloseoutSuccess = async () => {
    // Invalidate all queries that might be affected by the closeout
    await queryClient.invalidateQueries({ queryKey: ['available-balance'] })
    await queryClient.invalidateQueries({ queryKey: ['cash-closeout'] })

    // Refetch the page data
    if (venueId) {
      try {
        const [summaryRes, cardRes, timelineRes, calendarRes] = await Promise.all([
          getAvailableBalance(venueId),
          getBalanceByCardType(venueId),
          getSettlementTimeline(venueId, { includePast: true, includeFuture: true }),
          getSettlementCalendar(venueId),
        ])

        setSummary(summaryRes.data)
        setCardBreakdown(cardRes.data)
        setTimeline(timelineRes.data)
        setSettlementCalendar(calendarRes.data)
      } catch {
        // Silently ignore - data will refresh on next load
      }
    }
  }

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
      case TransactionCardType.CASH:
        return '💵'
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
      case TransactionCardType.CASH:
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
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

  if (!summary || !filteredSummary) return null

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <PageTitleWithInfo
            title={t('title')}
            className="text-3xl font-bold tracking-tight"
            tooltip={t('info.page', {
              defaultValue: 'Consulta el saldo disponible y simula fechas de deposito.',
            })}
          />
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        <Button onClick={() => setShowSimulationDialog(true)}>
          <Calculator className="mr-2 h-4 w-4" />
          {t('simulate.button')}
        </Button>
      </div>

      {/* Pill-Style Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
        <TabsList className="inline-flex h-10 items-center justify-start rounded-full bg-muted/60 px-1 py-1 text-muted-foreground border border-border">
          <TabsTrigger
            value="all"
            className="group rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground"
          >
            <span>{t('tabs.all')}</span>
            <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-xs text-foreground bg-foreground/10 group-hover:bg-foreground/20 group-data-[state=active]:bg-background/20 group-data-[state=active]:text-background">
              {tabCounts.total}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="cards"
            className="group rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground"
          >
            <CreditCard className="w-4 h-4 mr-1.5" />
            <span>{t('tabs.cards')}</span>
            <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-xs text-foreground bg-foreground/10 group-hover:bg-foreground/20 group-data-[state=active]:bg-background/20 group-data-[state=active]:text-background">
              {tabCounts.cardsCount}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="cash"
            className="group rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground"
          >
            <Banknote className="w-4 h-4 mr-1.5" />
            <span>{t('tabs.cash')}</span>
            <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-xs text-foreground bg-foreground/10 group-hover:bg-foreground/20 group-data-[state=active]:bg-background/20 group-data-[state=active]:text-background">
              {tabCounts.cashCount}
            </span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Pending Incidents Alert */}
      {venueId && <PendingIncidentsAlert venueId={venueId} />}

      {/* Credit Offer Banner - Shows when venue has a pending financing offer */}
      {venueId && <CreditOfferBanner venueId={venueId} />}

      {/* Cash Closeout Reminder Alert - Shows when > 7 days since last closeout */}
      {expectedCashData && expectedCashData.daysSinceLastCloseout > 7 && (
        <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              {tCashCloseout('alert.title')}
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {tCashCloseout('alert.message', { days: expectedCashData.daysSinceLastCloseout })}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCloseoutDialog(true)}
            className="border-amber-500/50 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
          >
            {tCashCloseout('alert.action')}
          </Button>
        </div>
      )}

      {/* Cash Closeout Button - Shows when viewing cash or all tabs */}
      {(activeTab === 'cash' || activeTab === 'all') && (
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 rounded-lg">
          <div>
            <p className="text-sm font-medium">
              {expectedCashData && expectedCashData.hasCloseouts
                ? expectedCashData.daysSinceLastCloseout === 0
                  ? tCashCloseout('lastCloseoutToday')
                  : tCashCloseout('lastCloseout', { days: expectedCashData.daysSinceLastCloseout })
                : tCashCloseout('noCloseouts')
              }
            </p>
            {expectedCashData && (
              <p className="text-xs text-muted-foreground">
                {t('breakdown.table.transactions')}: {expectedCashData.transactionCount}
              </p>
            )}
          </div>
          <Button onClick={() => setShowCloseoutDialog(true)}>
            <Banknote className="w-4 h-4 mr-2" />
            {tCashCloseout('button')}
          </Button>
        </div>
      )}

      {/* KPI Cards - Show different cards based on tab */}
      {activeTab === 'cash' ? (
        <>
          {/* Cash-specific KPI: Only show available amount (cash is instant) */}
          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('kpi.availableNow')}</CardTitle>
              <Banknote className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{Currency(filteredSummary.availableNow)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('instant')} • {tabCounts.cashCount} {t('breakdown.table.transactions').toLowerCase()}
              </p>
            </CardContent>
          </Card>

          {/* Cash Closeout History */}
          <CashCloseoutHistory venueId={venueId!} />
        </>
      ) : activeTab === 'all' ? (
        /* All tab: Show 4 KPIs - Cards (3) + Cash (1) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('kpi.cardsAvailable')}</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Currency(separateAmounts.cardsAvailable)}</div>
              <p className="text-xs text-muted-foreground">{t('kpi.cardsAvailableDescription')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('kpi.pending')}</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Currency(separateAmounts.cardsPending)}</div>
              <p className="text-xs text-muted-foreground">{t('kpi.pendingDescription')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('kpi.nextSettlement')}</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Currency(summary?.estimatedNextSettlement.amount || 0)}</div>
              {summary?.estimatedNextSettlement.date && (
                <p className="text-xs text-muted-foreground">
                  {t('kpi.nextSettlementDate', {
                    date: formatDate(summary.estimatedNextSettlement.date)
                  })}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('kpi.cashAvailable')}</CardTitle>
              <Banknote className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Currency(separateAmounts.cashAvailable)}</div>
              <p className="text-xs text-muted-foreground">
                {t('instant')} • {tabCounts.cashCount} {t('breakdown.table.transactions').toLowerCase()}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Cards tab: Show 3 KPIs for cards only */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('kpi.availableNow')}</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Currency(filteredSummary.availableNow)}</div>
              <p className="text-xs text-muted-foreground">{t('kpi.availableNowDescription')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('kpi.pending')}</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Currency(filteredSummary.pendingSettlement)}</div>
              <p className="text-xs text-muted-foreground">{t('kpi.pendingDescription')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('kpi.nextSettlement')}</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Currency(filteredSummary.estimatedNextSettlement.amount)}</div>
              {filteredSummary.estimatedNextSettlement.date && (
                <p className="text-xs text-muted-foreground">
                  {t('kpi.nextSettlementDate', {
                    date: formatDate(filteredSummary.estimatedNextSettlement.date)
                  })}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Settlement Calendar - Only for cards, not applicable to cash */}
      {activeTab !== 'cash' && (
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
                {filteredCalendar.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      {t('calendar.table.noData', 'No hay liquidaciones programadas en los próximos 30 días')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCalendar.map((entry, idx) => (
                    <TableRow key={idx} className={entry.status === 'SETTLED' ? 'bg-muted/50' : ''}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {formatDate(entry.settlementDate)}
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

            {filteredCalendar.length > 0 && (
              <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  💡 {t('calendar.tip', 'Este calendario muestra exactamente cuánto dinero recibirás cada día. Las transacciones se agrupan por fecha de liquidación, no por fecha de procesamiento.')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Card Type Breakdown - Only for cards/all tab, not for cash */}
      {activeTab !== 'cash' && (
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
                {filteredCardBreakdown.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      {t('breakdown.table.noData')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCardBreakdown.map((card) => (
                    <TableRow key={card.cardType}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{getCardTypeIcon(card.cardType)}</span>
                          <Badge className={getCardTypeColor(card.cardType)} variant="secondary">
                            {t(`cardType.${card.cardType.toLowerCase()}`)}
                          </Badge>
                          {card.cardType === TransactionCardType.CASH && (
                            <Badge variant="outline" className="text-xs">
                              {t('instant')}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{card.transactionCount}</TableCell>
                      <TableCell className="text-right font-medium">{Currency(card.totalSales)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {card.cardType === TransactionCardType.CASH ? '-' : `-${Currency(card.fees)}`}
                      </TableCell>
                      <TableCell className="text-right font-bold">{Currency(card.netAmount)}</TableCell>
                      <TableCell className="text-right">
                        {card.cardType === TransactionCardType.CASH
                          ? t('instant')
                          : card.settlementDays !== null
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
      )}

      {/* Settlement Timeline - Only for cards/all tab, not for cash */}
      {activeTab !== 'cash' && (
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
                      {formatDate(entry.date)}
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
                        ? formatDate(entry.estimatedSettlementDate)
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
      )}

      {/* Simulation Dialog */}
      <Dialog open={showSimulationDialog} onOpenChange={handleCloseSimulation}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('simulate.title')}</DialogTitle>
            <DialogDescription>{t('simulate.description')}</DialogDescription>
          </DialogHeader>

          <Form {...simulationForm}>
            <form onSubmit={simulationForm.handleSubmit(handleSimulation)} className="space-y-4">
              <FormField
                control={simulationForm.control}
                name="amount"
                rules={{
                  required: t('simulate.form.amount'),
                  min: { value: 0.01, message: t('simulate.form.amount') },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('simulate.form.amount')}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder={t('simulate.form.amountPlaceholder')}
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={simulationForm.control}
                name="cardType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('simulate.form.cardType')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('simulate.form.cardTypePlaceholder')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={TransactionCardType.CASH}>
                          <div className="flex items-center gap-2">
                            <Banknote className="w-4 h-4" />
                            {t('cardType.cash')} ({t('instant')})
                          </div>
                        </SelectItem>
                        <SelectItem value={TransactionCardType.DEBIT}>
                          {t('cardType.debit')}
                        </SelectItem>
                        <SelectItem value={TransactionCardType.CREDIT}>
                          {t('cardType.credit')}
                        </SelectItem>
                        <SelectItem value={TransactionCardType.AMEX}>
                          {t('cardType.amex')}
                        </SelectItem>
                        <SelectItem value={TransactionCardType.INTERNATIONAL}>
                          {t('cardType.international')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={simulationForm.control}
                name="transactionDate"
                rules={{ required: t('simulate.form.transactionDate') }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('simulate.form.transactionDate')}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={simulationForm.control}
                name="transactionTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('simulate.form.transactionTime')}</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        placeholder={t('simulate.form.transactionTimePlaceholder')}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Simulation Result */}
              {simulationResult && (
                <div className="mt-6 p-4 bg-muted/50 rounded-lg space-y-4">
                  <h3 className="font-semibold text-lg">{t('simulate.result.title')}</h3>

                  {simulationResult.estimatedSettlementDate && simulationResult.settlementDays !== null ? (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">{t('simulate.result.settlementDate')}</p>
                          <p className="text-xl font-bold">
                            {formatDate(simulationResult.estimatedSettlementDate)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            ({simulationResult.settlementDays} {t('simulate.result.settlementDays')})
                          </p>
                        </div>

                        <div>
                          <p className="text-sm text-muted-foreground">{t('simulate.result.netAmount')}</p>
                          <p className="text-xl font-bold text-green-600 dark:text-green-400">
                            {Currency(simulationResult.netAmount)}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t('simulate.result.grossAmount')}:</span>
                          <span className="font-medium">{Currency(simulationResult.grossAmount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t('simulate.result.fees')}:</span>
                          <span className="font-medium text-destructive">-{Currency(simulationResult.fees)}</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t">
                          <span className="font-semibold">{t('simulate.result.netAmount')}:</span>
                          <span className="font-bold">{Currency(simulationResult.netAmount)}</span>
                        </div>
                      </div>

                      {simulationResult.configuration && (
                        <div className="pt-3 border-t">
                          <p className="text-sm font-medium mb-2">{t('simulate.result.configuration')}</p>
                          <div className="space-y-1 text-xs text-muted-foreground">
                            <p>
                              • {t('simulate.result.configDays', {
                                count: simulationResult.configuration.settlementDays,
                                type: simulationResult.configuration.settlementDayType === 'BUSINESS_DAYS'
                                  ? t('simulate.result.businessDays', { count: simulationResult.configuration.settlementDays })
                                  : t('simulate.result.calendarDays', { count: simulationResult.configuration.settlementDays })
                              })}
                            </p>
                            <p>
                              • {t('simulate.result.cutoffTime', { time: simulationResult.configuration.cutoffTime })}
                            </p>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-muted-foreground">
                        No se encontró configuración de liquidación para este tipo de tarjeta. Por favor, configura las reglas de liquidación primero.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseSimulation}>
                  {t('simulate.form.cancel')}
                </Button>
                <Button type="submit" disabled={simulationLoading}>
                  {simulationLoading ? t('simulate.form.submit') + '...' : t('simulate.form.submit')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Cash Closeout Dialog */}
      {venueId && (
        <CashCloseoutDialog
          open={showCloseoutDialog}
          onOpenChange={setShowCloseoutDialog}
          venueId={venueId}
          onSuccess={handleCloseoutSuccess}
        />
      )}
    </div>
  )
}
