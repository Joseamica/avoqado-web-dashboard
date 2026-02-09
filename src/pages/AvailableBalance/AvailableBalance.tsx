import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { DateTime } from 'luxon'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { Card, CardContent } from '@/components/ui/card'
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { GlassCard } from '@/components/ui/glass-card'
import { MetricCard } from '@/components/ui/metric-card'
import { StatusPulse } from '@/components/ui/status-pulse'
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
import {
  Wallet,
  TrendingUp,
  Clock,
  CreditCard,
  Calculator,
  ArrowUpRight,
  Calendar,
  Banknote,
  AlertCircle,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
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

  // Timeline collapsible state
  const [timelineOpen, setTimelineOpen] = useState(false)

  // Calendar expanded rows
  const [expandedCalendarRows, setExpandedCalendarRows] = useState<Set<number>>(new Set())

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
      // 404 = no payment config for this card type — show inline message instead of toast
      if (err.response?.status === 404) {
        setSimulationResult({
          simulatedAmount: data.amount,
          cardType: data.cardType,
          transactionDate: data.transactionDate,
          estimatedSettlementDate: null as any,
          settlementDays: null as any,
          grossAmount: data.amount,
          fees: 0,
          netAmount: data.amount,
          configuration: null as any,
        })
      } else {
        toast({
          title: t('simulate.error'),
          description: err.message || err.response?.data?.message || t('error.unexpected'),
          variant: 'destructive',
        })
      }
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

  // Card type accent color for MetricCard-style tiles
  const getCardTypeAccent = (cardType: TransactionCardType): 'blue' | 'purple' | 'green' | 'orange' | 'yellow' => {
    switch (cardType) {
      case TransactionCardType.DEBIT:
        return 'blue'
      case TransactionCardType.CREDIT:
        return 'purple'
      case TransactionCardType.AMEX:
        return 'green'
      case TransactionCardType.INTERNATIONAL:
        return 'orange'
      case TransactionCardType.CASH:
        return 'green'
      default:
        return 'blue'
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
        return (
          <div className="flex items-center gap-1.5">
            <StatusPulse status="success" size="sm" />
            <span className="text-sm font-medium text-green-700 dark:text-green-400">{t('status.settled')}</span>
          </div>
        )
      case 'PENDING':
        return (
          <div className="flex items-center gap-1.5">
            <StatusPulse status="warning" size="sm" />
            <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">{t('status.pending')}</span>
          </div>
        )
      case 'PROJECTED':
        return (
          <div className="flex items-center gap-1.5">
            <StatusPulse status="info" size="sm" />
            <span className="text-sm font-medium text-blue-700 dark:text-blue-400">{t('status.projected')}</span>
          </div>
        )
      default:
        return null
    }
  }

  // Calendar status with StatusPulse
  const getCalendarStatusBadge = (status: string) => {
    if (status === 'SETTLED') {
      return (
        <div className="flex items-center gap-1.5">
          <StatusPulse status="success" size="sm" />
          <span className="text-sm font-medium text-green-700 dark:text-green-400">{t('status.settled', 'Liquidado')}</span>
        </div>
      )
    }
    return (
      <div className="flex items-center gap-1.5">
        <StatusPulse status="warning" size="sm" />
        <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">{t('status.pending', 'Pendiente')}</span>
      </div>
    )
  }

  // Toggle calendar row expansion
  const toggleCalendarRow = (idx: number) => {
    setExpandedCalendarRows(prev => {
      const next = new Set(prev)
      if (next.has(idx)) {
        next.delete(idx)
      } else {
        next.add(idx)
      }
      return next
    })
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

        {/* Bento skeleton */}
        <div className="grid grid-cols-12 gap-4">
          <Skeleton className="col-span-12 lg:col-span-8 h-40 rounded-2xl" />
          <div className="col-span-12 lg:col-span-4 space-y-4">
            <Skeleton className="h-[4.5rem] rounded-2xl" />
            <Skeleton className="h-[4.5rem] rounded-2xl" />
            <Skeleton className="h-[4.5rem] rounded-2xl" />
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
        </div>

        <Skeleton className="h-64 rounded-2xl" />
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

      {/* ===== HERO KPI SECTION — Bento Grid (varies by tab) ===== */}
      {activeTab === 'cash' ? (
        /* Cash Tab: Hero with closeout info integrated */
        <GlassCard className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5">
                <Banknote className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('kpi.availableNow')}</p>
                <p className="text-4xl font-bold tracking-tight">{Currency(filteredSummary.availableNow)}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('instant')} · {tabCounts.cashCount} {t('breakdown.table.transactions').toLowerCase()}
                </p>
                {expectedCashData && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {expectedCashData.hasCloseouts
                      ? expectedCashData.daysSinceLastCloseout === 0
                        ? tCashCloseout('lastCloseoutToday')
                        : tCashCloseout('lastCloseout', { days: expectedCashData.daysSinceLastCloseout })
                      : tCashCloseout('noCloseouts')
                    }
                  </p>
                )}
              </div>
            </div>
            <Button onClick={() => setShowCloseoutDialog(true)} size="lg">
              <Banknote className="w-4 h-4 mr-2" />
              {tCashCloseout('button')}
            </Button>
          </div>
        </GlassCard>
      ) : activeTab === 'all' ? (
        /* All Tab: Bento 8/4 — Hero total + side metrics */
        <div className="grid grid-cols-12 gap-4">
          {/* Hero - col 1-8 */}
          <GlassCard className="col-span-12 lg:col-span-8 p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
                <Wallet className="w-7 h-7 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('kpi.availableNow')}</p>
                <p className="text-4xl font-bold tracking-tight">
                  {Currency(separateAmounts.cardsAvailable + separateAmounts.cashAvailable)}
                </p>
                <div className="flex flex-wrap items-center gap-3 mt-2">
                  <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <CreditCard className="w-3.5 h-3.5" />
                    {Currency(separateAmounts.cardsAvailable)}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Banknote className="w-3.5 h-3.5" />
                    {Currency(separateAmounts.cashAvailable)}
                  </span>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Side metrics - col 9-12 */}
          <div className="col-span-12 lg:col-span-4 grid grid-cols-2 lg:grid-cols-1 gap-4">
            <MetricCard
              label={t('kpi.pending')}
              value={Currency(separateAmounts.cardsPending)}
              subValue={t('kpi.pendingDescription')}
              icon={<Clock className="w-4 h-4" />}
              accent="yellow"
            />
            <MetricCard
              label={t('kpi.nextSettlement')}
              value={Currency(summary?.estimatedNextSettlement.amount || 0)}
              subValue={
                summary?.estimatedNextSettlement.date
                  ? t('kpi.nextSettlementDate', { date: formatDate(summary.estimatedNextSettlement.date) })
                  : undefined
              }
              icon={<TrendingUp className="w-4 h-4" />}
              accent="green"
            />
            <MetricCard
              label={t('kpi.cashAvailable')}
              value={Currency(separateAmounts.cashAvailable)}
              subValue={`${t('instant')} · ${tabCounts.cashCount} txns`}
              icon={<Banknote className="w-4 h-4" />}
              accent="green"
              className="col-span-2 lg:col-span-1"
            />
          </div>
        </div>
      ) : (
        /* Cards Tab: Bento 8/4 — Hero cards available + side metrics */
        <div className="grid grid-cols-12 gap-4">
          {/* Hero - col 1-8 */}
          <GlassCard className="col-span-12 lg:col-span-8 p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-500/5">
                <CreditCard className="w-7 h-7 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('kpi.availableNow')}</p>
                <p className="text-4xl font-bold tracking-tight">{Currency(filteredSummary.availableNow)}</p>
                <p className="text-sm text-muted-foreground mt-1">{t('kpi.availableNowDescription')}</p>
              </div>
            </div>
          </GlassCard>

          {/* Side metrics - col 9-12 */}
          <div className="col-span-12 lg:col-span-4 grid grid-cols-2 lg:grid-cols-1 gap-4">
            <MetricCard
              label={t('kpi.pending')}
              value={Currency(filteredSummary.pendingSettlement)}
              subValue={t('kpi.pendingDescription')}
              icon={<Clock className="w-4 h-4" />}
              accent="yellow"
            />
            <MetricCard
              label={t('kpi.nextSettlement')}
              value={Currency(filteredSummary.estimatedNextSettlement.amount)}
              subValue={
                filteredSummary.estimatedNextSettlement.date
                  ? t('kpi.nextSettlementDate', { date: formatDate(filteredSummary.estimatedNextSettlement.date) })
                  : undefined
              }
              icon={<TrendingUp className="w-4 h-4" />}
              accent="green"
            />
          </div>
        </div>
      )}

      {/* Cash Closeout History - only on cash tab (moved up, right after hero) */}
      {activeTab === 'cash' && <CashCloseoutHistory venueId={venueId!} />}

      {/* ===== CARD TYPE BREAKDOWN — Tile Cards (replaces 8-col table) ===== */}
      {activeTab !== 'cash' && filteredCardBreakdown.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">{t('breakdown.title')}</h3>
            <span className="text-sm text-muted-foreground">— {t('breakdown.description')}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredCardBreakdown.map((card) => {
              const settledPercent = card.netAmount > 0
                ? Math.round((card.settledAmount / card.netAmount) * 100)
                : 0

              return (
                <GlassCard key={card.cardType} className="p-4 space-y-3">
                  {/* Header: icon + type */}
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'p-1.5 rounded-lg bg-gradient-to-br',
                      getCardTypeAccent(card.cardType) === 'blue' && 'from-blue-500/20 to-blue-500/5',
                      getCardTypeAccent(card.cardType) === 'purple' && 'from-purple-500/20 to-purple-500/5',
                      getCardTypeAccent(card.cardType) === 'green' && 'from-green-500/20 to-green-500/5',
                      getCardTypeAccent(card.cardType) === 'orange' && 'from-orange-500/20 to-orange-500/5',
                    )}>
                      <span className="text-lg">{getCardTypeIcon(card.cardType)}</span>
                    </div>
                    <span className="font-medium text-sm">{t(`cardType.${card.cardType.toLowerCase()}`)}</span>
                  </div>

                  {/* Main amount */}
                  <p className="text-2xl font-bold tracking-tight">{Currency(card.netAmount)}</p>

                  {/* Details */}
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>{card.transactionCount} {t('breakdown.table.transactions').toLowerCase()}</span>
                      <span>
                        {card.cardType === TransactionCardType.CASH
                          ? t('instant')
                          : card.settlementDays !== null
                            ? t('breakdown.table.days', { count: card.settlementDays })
                            : '-'
                        }
                      </span>
                    </div>
                    {card.cardType !== TransactionCardType.CASH && (
                      <div className="flex justify-between">
                        <span>{t('breakdown.table.fees')}</span>
                        <span>-{Currency(card.fees)}</span>
                      </div>
                    )}
                  </div>

                  {/* Progress bar: settled vs pending */}
                  <div className="space-y-1">
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 dark:bg-green-400 rounded-full transition-all"
                        style={{ width: `${settledPercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{settledPercent}% {t('status.settled', 'liquidado').toLowerCase()}</span>
                      <span>{Currency(card.pendingAmount)} {t('status.pending', 'pend.').toLowerCase()}</span>
                    </div>
                  </div>
                </GlassCard>
              )
            })}
          </div>
        </div>
      )}

      {/* ===== SETTLEMENT CALENDAR — Simplified 3 cols + expandable rows ===== */}
      {activeTab !== 'cash' && (
        <GlassCard className="overflow-hidden">
          <div className="p-4 sm:p-6 pb-0">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold">{t('calendar.title', 'Calendario de Liquidaciones')}</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {t('calendar.description', 'Cuánto dinero recibirás cada día según las fechas de liquidación')}
            </p>
          </div>
          <div className="px-4 sm:px-6 pb-4 sm:pb-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('calendar.table.date', 'Fecha')}</TableHead>
                  <TableHead className="text-right">{t('calendar.table.totalAmount', 'Monto')}</TableHead>
                  <TableHead className="text-center">{t('calendar.table.status', 'Estado')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCalendar.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      {t('calendar.table.noData', 'No hay liquidaciones programadas en los próximos 30 días')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCalendar.map((entry, idx) => {
                    const isExpanded = expandedCalendarRows.has(idx)
                    return (
                      <TableRow
                        key={idx}
                        className={cn(
                          'cursor-pointer transition-colors hover:bg-muted/50',
                          entry.status === 'SETTLED' && 'bg-muted/30',
                        )}
                        onClick={() => toggleCalendarRow(idx)}
                      >
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <ChevronRight
                                className={cn(
                                  'h-4 w-4 text-muted-foreground transition-transform',
                                  isExpanded && 'rotate-90',
                                )}
                              />
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{formatDate(entry.settlementDate)}</span>
                            </div>
                            {/* Expanded: card type breakdown */}
                            {isExpanded && (
                              <div className="ml-10 mt-2 space-y-1.5">
                                {entry.byCardType.map((cardTypeEntry) => (
                                  <div key={cardTypeEntry.cardType} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                      <span>{getCardTypeIcon(cardTypeEntry.cardType)}</span>
                                      <Badge className={getCardTypeColor(cardTypeEntry.cardType)} variant="secondary">
                                        {t(`cardType.${cardTypeEntry.cardType.toLowerCase()}`, cardTypeEntry.cardType)}
                                      </Badge>
                                      <span className="text-xs text-muted-foreground">
                                        ({cardTypeEntry.transactionCount} txns)
                                      </span>
                                    </div>
                                    <span className="font-semibold">{Currency(cardTypeEntry.netAmount)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-lg font-bold">{Currency(entry.totalNetAmount)}</span>
                          <p className="text-xs text-muted-foreground">
                            {entry.transactionCount} txns
                          </p>
                        </TableCell>
                        <TableCell className="text-center">
                          {getCalendarStatusBadge(entry.status)}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </GlassCard>
      )}

      {/* ===== SETTLEMENT TIMELINE — Collapsible (closed by default) ===== */}
      {activeTab !== 'cash' && timeline.length > 0 && (
        <Collapsible open={timelineOpen} onOpenChange={setTimelineOpen}>
          <GlassCard>
            <CollapsibleTrigger asChild>
              <div className="p-4 sm:p-6 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
                    <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{t('timeline.title')}</h3>
                    <p className="text-xs text-muted-foreground">{t('timeline.description')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {timeline.length}
                  </Badge>
                  <ChevronRight className={cn('w-4 h-4 text-muted-foreground transition-transform', timelineOpen && 'rotate-90')} />
                </div>
              </div>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-4">
                <div className="h-px bg-border/50" />
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('timeline.table.date')}</TableHead>
                      <TableHead>{t('timeline.table.status')}</TableHead>
                      <TableHead className="text-right">{t('timeline.table.transactions')}</TableHead>
                      <TableHead className="text-right">{t('timeline.table.net')}</TableHead>
                      <TableHead className="text-right">{t('timeline.table.settlementDate')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timeline.slice(0, 10).map((entry, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">
                          {formatDate(entry.date)}
                        </TableCell>
                        <TableCell>{getStatusBadge(entry.settlementStatus)}</TableCell>
                        <TableCell className="text-right">{entry.transactionCount}</TableCell>
                        <TableCell className="text-right font-bold">{Currency(entry.netAmount)}</TableCell>
                        <TableCell className="text-right">
                          {entry.estimatedSettlementDate
                            ? formatDate(entry.estimatedSettlementDate)
                            : '-'
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {timeline.length > 10 && (
                  <div className="flex justify-center">
                    <Button variant="outline" size="sm">
                      <ArrowUpRight className="mr-2 h-4 w-4" />
                      {t('timeline.viewAll', { count: timeline.length })}
                    </Button>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </GlassCard>
        </Collapsible>
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
