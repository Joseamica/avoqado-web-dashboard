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
  Globe,
  BadgeDollarSign,
  Landmark,
  Coins,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Currency } from '@/utils/currency'
import { useVenueDateTime } from '@/utils/datetime'
import { Skeleton } from '@/components/ui/skeleton'
import { PendingIncidentsAlert } from '@/components/SettlementIncident/PendingIncidentsAlert'
import { CreditOfferBanner } from '@/components/CreditOffer/CreditOfferBanner'
import { CashCloseoutDialog } from '@/components/CashCloseout/CashCloseoutDialog'
import { CashCloseoutHistory } from '@/components/CashCloseout/CashCloseoutHistory'
import { SettlementCalendarWeek } from './SettlementCalendarWeek'
import { CardTypeBreakdownStrip } from './CardTypeBreakdownStrip'
import { SettlementTimelineTable } from './SettlementTimelineTable'
import { useToast } from '@/hooks/use-toast'

// Tab filter type
type TabValue = 'all' | 'cards' | 'cash'

export default function AvailableBalance() {
  const { t } = useTranslation('availableBalance')
  const { t: tCashCloseout } = useTranslation('cashCloseout')
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { formatDate, venueTimezone } = useVenueDateTime()

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
    const iconClass = 'w-4.5 h-4.5'
    switch (cardType) {
      case TransactionCardType.DEBIT:
        return <Landmark className={cn(iconClass, 'text-blue-500')} />
      case TransactionCardType.CREDIT:
        return <CreditCard className={cn(iconClass, 'text-purple-500')} />
      case TransactionCardType.AMEX:
        return <BadgeDollarSign className={cn(iconClass, 'text-green-500')} />
      case TransactionCardType.INTERNATIONAL:
        return <Globe className={cn(iconClass, 'text-orange-500')} />
      case TransactionCardType.CASH:
        return <Coins className={cn(iconClass, 'text-emerald-500')} />
      default:
        return <CreditCard className={cn(iconClass, 'text-blue-500')} />
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
          <p className="text-sm text-muted-foreground mt-1">{t('description')}</p>
        </div>
        <Button variant="outline" onClick={() => setShowSimulationDialog(true)} className="gap-2">
          <Calculator className="h-4 w-4" />
          {t('simulate.button')}
        </Button>
      </div>

      {/* Stripe-style underline tabs */}
      <div className="border-b border-border">
        <nav className="flex items-center gap-6">
          <button
            onClick={() => setActiveTab('all')}
            className={`relative flex items-center gap-2 pb-3 text-sm font-medium transition-colors ${
              activeTab === 'all' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>{t('tabs.all')}</span>
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-xs bg-muted text-muted-foreground">
              {tabCounts.total}
            </span>
            {activeTab === 'all' && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('cards')}
            className={`relative flex items-center gap-1.5 pb-3 text-sm font-medium transition-colors ${
              activeTab === 'cards' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>{t('tabs.cards')}</span>
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-xs bg-muted text-muted-foreground">
              {tabCounts.cardsCount}
            </span>
            {activeTab === 'cards' && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('cash')}
            className={`relative flex items-center gap-1.5 pb-3 text-sm font-medium transition-colors ${
              activeTab === 'cash' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Banknote className="w-4 h-4" />
            <span>{t('tabs.cash')}</span>
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-xs bg-muted text-muted-foreground">
              {tabCounts.cashCount}
            </span>
            {activeTab === 'cash' && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-full" />
            )}
          </button>
        </nav>
      </div>

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

      {/* ===== CASH TAB HERO — Closeout button + summary (only on cash tab) ===== */}
      {activeTab === 'cash' && (
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
      )}

      {/* Cash Closeout History - only on cash tab */}
      {activeTab === 'cash' && <CashCloseoutHistory venueId={venueId!} />}

      {/* ===== SETTLEMENT CALENDAR — moved to top, primary view ===== */}
      {activeTab !== 'cash' && (
        <SettlementCalendarWeek
          entries={filteredCalendar}
          timezone={venueTimezone}
          formatCurrency={Currency}
          cardTypeLabel={key => t(`cardType.${key.toLowerCase()}`, key)}
        />
      )}

      {/* ===== CARD TYPE BREAKDOWN — under the calendar ===== */}
      {activeTab !== 'cash' && filteredCardBreakdown.length > 0 && (
        <CardTypeBreakdownStrip
          items={filteredCardBreakdown.map(c => ({
            cardType: c.cardType,
            netAmount: c.netAmount,
            fees: c.fees,
            transactionCount: c.transactionCount,
            settlementDays: c.settlementDays,
          }))}
          formatCurrency={Currency}
          cardTypeLabel={key => t(`cardType.${key.toLowerCase()}`, key)}
          cashKey={TransactionCardType.CASH}
          title={t('breakdown.title')}
          description={t('breakdown.description')}
        />
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
                <SettlementTimelineTable
                  data={timeline}
                  formatCurrency={Currency}
                  cardTypeLabel={key => t(`cardType.${key.toLowerCase()}`, key)}
                />
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
                <div className="mt-6 rounded-xl border border-input bg-muted/30 overflow-hidden">
                  <div className="px-4 py-3 border-b border-input bg-muted/50">
                    <h3 className="font-semibold text-sm">{t('simulate.result.title')}</h3>
                  </div>

                  {simulationResult.estimatedSettlementDate && simulationResult.settlementDays !== null ? (
                    <div className="p-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">{t('simulate.result.settlementDate')}</p>
                          <p className="text-lg font-bold">
                            {formatDate(simulationResult.estimatedSettlementDate)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            ({simulationResult.settlementDays} {t('simulate.result.settlementDays')})
                          </p>
                        </div>

                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">{t('simulate.result.netAmount')}</p>
                          <p className="text-lg font-bold text-green-600 dark:text-green-400">
                            {Currency(simulationResult.netAmount)}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1.5 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t('simulate.result.grossAmount')}</span>
                          <span className="font-medium">{Currency(simulationResult.grossAmount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t('simulate.result.fees')}</span>
                          <span className="font-medium text-destructive">-{Currency(simulationResult.fees)}</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t border-input">
                          <span className="font-semibold">{t('simulate.result.netAmount')}</span>
                          <span className="font-bold">{Currency(simulationResult.netAmount)}</span>
                        </div>
                      </div>

                      {simulationResult.configuration && (
                        <div className="pt-3 border-t border-input">
                          <p className="text-xs font-medium text-muted-foreground mb-1.5">{t('simulate.result.configuration')}</p>
                          <div className="space-y-0.5 text-xs text-muted-foreground">
                            <p>
                              {t('simulate.result.configDays', {
                                count: simulationResult.configuration.settlementDays,
                                type: simulationResult.configuration.settlementDayType === 'BUSINESS_DAYS'
                                  ? t('simulate.result.businessDays', { count: simulationResult.configuration.settlementDays })
                                  : t('simulate.result.calendarDays', { count: simulationResult.configuration.settlementDays })
                              })}
                              {' · '}
                              {t('simulate.result.cutoffTime', { time: simulationResult.configuration.cutoffTime })}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-6 text-center">
                      <AlertCircle className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {t('simulate.result.noConfig')}
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
