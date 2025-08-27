import { DateRangePicker } from '@/components/date-range-picker'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useProgressiveLoader } from '@/hooks/use-intersection-observer'
import { useSocketEvents } from '@/hooks/use-socket-events'
import { Currency } from '@/utils/currency'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { es as localeEs, fr as localeFr, enUS as localeEn } from 'date-fns/locale'
import { DollarSign, Download, Gift, Loader2, Percent, Star, TrendingUp } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, Cell, Label, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'

// Import progressive loading components
import {
  ChartSkeleton,
  ProductListSkeleton,
  ProgressiveSection,
  StaffPerformanceSkeleton,
  TablePerformanceSkeleton,
  TableSkeleton,
} from '@/components/skeleton/DashboardSkeleton'
import { CHART_TYPES, DashboardProgressiveService, METRIC_TYPES } from '@/services/dashboard.progressive.service'

// i18n keys are used instead of a local map

// Enhanced color palette for charts
const CHART_COLORS = ['#2563eb', '#60a8fb', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1']

// Simple icon components
const DollarIcon = () => <DollarSign className="h-5 w-5 text-blue-500" />
const StarIcon = () => <Star className="h-5 w-5 text-yellow-500" />
const TipIcon = () => <Gift className="h-5 w-5 text-green-500" />
const PercentIcon = () => <Percent className="h-5 w-5 text-purple-500" />

// Type for comparison period
type ComparisonPeriod = 'day' | 'week' | 'month' | 'custom' | ''

// Metric card component
const MetricCard = ({
  title,
  value,
  isLoading,
  icon,
  percentage = null,
  comparisonLabel = '',
  isPercentageLoading = false,
}: {
  title: string
  value: string | number | null
  isLoading: boolean
  icon: React.ReactNode
  percentage?: number | null
  comparisonLabel?: string
  isPercentageLoading?: boolean
}) => {
  const { t } = useTranslation()
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="h-4 w-4 text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-7 w-20 bg-muted rounded animate-pulse"></div>
        ) : (
          <div className="space-y-1">
            <div className="text-2xl font-bold text-foreground">{value || 0}</div>
            {isPercentageLoading ? (
              <div className="h-4 w-24 bg-muted rounded animate-pulse mt-1"></div>
            ) : (
              percentage !== null && (
                <div
                  className={`text-xs flex items-center ${
                    percentage > 0
                      ? 'text-green-600 dark:text-green-400'
                      : percentage < 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-muted-foreground'
                  }`}
                >
                  {percentage > 0 ? (
                    <>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3 w-3 mr-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                      <span>
                        {percentage}% vs {comparisonLabel}
                      </span>
                    </>
                  ) : percentage < 0 ? (
                    <>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3 w-3 mr-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      <span>
                        {Math.abs(percentage)}% vs {comparisonLabel}
                      </span>
                    </>
                  ) : (
                    <span>
                      {t('home.noChange', { defaultValue: 'Sin cambios' })} vs {comparisonLabel}
                    </span>
                  )}
                </div>
              )
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const Home = () => {
  const { venueId } = useCurrentVenue()
  const { t, i18n } = useTranslation()
  const localeCode = i18n.language?.startsWith('fr') ? 'fr-FR' : i18n.language?.startsWith('en') ? 'en-US' : 'es-ES'
  const dateLocale = i18n.language?.startsWith('fr') ? localeFr : i18n.language?.startsWith('en') ? localeEn : localeEs
  const [exportLoading, setExportLoading] = useState(false)
  const [compareType, setCompareType] = useState<ComparisonPeriod>('')
  const [comparisonLabel, setComparisonLabel] = useState(t('home.comparison.previousPeriod'))

  // Define ranges
  const [selectedRange, setSelectedRange] = useState({
    from: new Date(new Date().setHours(0, 0, 0, 0) - 7 * 24 * 60 * 60 * 1000), // last 7 days
    to: new Date(new Date().setHours(23, 59, 59, 999)), // today
  })

  const [compareRange, setCompareRange] = useState({
    from: new Date(new Date().setHours(0, 0, 0, 0) - 14 * 24 * 60 * 60 * 1000), // previous 7 days
    to: new Date(new Date(new Date().setHours(0, 0, 0, 0) - 8 * 24 * 60 * 60 * 1000).getTime() - 1), // day before the selectedRange starts
  })

  const [activeFilter, setActiveFilter] = useState('7days')

  // Initialize progressive loading service
  const dashboardService = useMemo(() => new DashboardProgressiveService(venueId), [venueId])

  // Handler for "Today" filter
  const handleToday = useCallback(() => {
    const today = new Date()
    const todayStart = new Date(today.setHours(0, 0, 0, 0))
    const todayEnd = new Date(new Date().setHours(23, 59, 59, 999))

    const yesterdayStart = new Date(todayStart)
    yesterdayStart.setDate(yesterdayStart.getDate() - 1)
    const yesterdayEnd = new Date(yesterdayStart)
    yesterdayEnd.setHours(23, 59, 59, 999)

    setSelectedRange({ from: todayStart, to: todayEnd })
    setCompareRange({ from: yesterdayStart, to: yesterdayEnd })
    setCompareType('day')
    setComparisonLabel(t('home.comparison.yesterday'))
    setActiveFilter('today')
  }, [t])

  // Handler for "Last 7 days" filter
  const handleLast7Days = useCallback(() => {
    const today = new Date()
    const end = new Date(today.setHours(23, 59, 59, 999))
    const start = new Date(new Date().setHours(0, 0, 0, 0) - 7 * 24 * 60 * 60 * 1000)

    const compareEnd = new Date(start)
    compareEnd.setMilliseconds(compareEnd.getMilliseconds() - 1)
    const compareStart = new Date(compareEnd)
    compareStart.setDate(compareStart.getDate() - 7)
    compareStart.setHours(0, 0, 0, 0)

    setSelectedRange({ from: start, to: end })
    setCompareRange({ from: compareStart, to: compareEnd })
    setCompareType('week')
    setComparisonLabel(t('home.comparison.prev7days'))
    setActiveFilter('7days')
  }, [t])

  // Handler for "Last 30 days" filter
  const handleLast30Days = useCallback(() => {
    const today = new Date()
    const end = new Date(today.setHours(23, 59, 59, 999))
    const start = new Date(new Date().setHours(0, 0, 0, 0) - 30 * 24 * 60 * 60 * 1000)

    const compareEnd = new Date(start)
    compareEnd.setMilliseconds(compareEnd.getMilliseconds() - 1)
    const compareStart = new Date(compareEnd)
    compareStart.setDate(compareStart.getDate() - 30)
    compareStart.setHours(0, 0, 0, 0)

    setSelectedRange({ from: start, to: end })
    setCompareRange({ from: compareStart, to: compareEnd })
    setCompareType('month')
    setComparisonLabel(t('home.comparison.prev30days'))
    setActiveFilter('30days')
  }, [t])

  // Basic metrics query (priority load)
  const {
    data: basicData,
    isLoading: isBasicLoading,
    isError: isBasicError,
    error: basicError,
    refetch: refetchBasicData,
  } = useQuery({
    queryKey: ['basic_metrics', venueId, selectedRange?.from?.toISOString(), selectedRange?.to?.toISOString()],
    queryFn: async () => {
      return await dashboardService.getBasicMetrics(selectedRange)
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  // Comparison data query
  const {
    data: compareData,
    isLoading: isCompareLoading,
    refetch: refetchCompareData,
  } = useQuery({
    queryKey: ['basic_metrics_compare', venueId, compareRange?.from?.toISOString(), compareRange?.to?.toISOString()],
    queryFn: async () => {
      if (!compareType) return null
      return await dashboardService.getBasicMetrics(compareRange)
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: !!compareType,
  })

  // Register socket event handlers
  useSocketEvents(
    venueId,
    data => {
      console.log('Received payment update:', data)
      refetchBasicData()
    },
    data => {
      console.log('Received shift update:', data)
      refetchBasicData()
    },
  )

  // Extract the basic data we need
  const filteredReviews = useMemo(() => basicData?.reviews || [], [basicData?.reviews])
  const filteredPayments = useMemo(() => basicData?.payments || [], [basicData?.payments])
  const paymentMethodsData = useMemo(() => basicData?.paymentMethodsData || [], [basicData?.paymentMethodsData])

  const fiveStarReviews = useMemo(() => {
    return filteredReviews.filter(review => review.stars === 5).length
  }, [filteredReviews])

  // Calculate total amount from payments
  const amount = useMemo(() => {
    return filteredPayments.reduce((sum, payment) => sum + Number(payment.amount), 0)
  }, [filteredPayments])

  const totalAmount = filteredPayments.length > 0 ? amount : 0

  // Calculate tip-related metrics
  const tipStats = useMemo(() => {
    if (!filteredPayments?.length) return { totalTips: 0, avgTipPercentage: 0 }

    const paymentsWithTips = filteredPayments.filter(payment => payment.tips && payment.tips.length > 0)

    const totalTips = paymentsWithTips.reduce((sum, payment) => {
      const tipsSum = payment.tips.reduce((tipSum, tip) => tipSum + Number(tip.amount), 0)
      return sum + tipsSum
    }, 0)

    let avgTipPercentage = 0
    if (paymentsWithTips.length > 0) {
      const tipPercentages = paymentsWithTips.map(payment => {
        const paymentAmount = Number(payment.amount)
        const tipsTotal = payment.tips.reduce((tipSum, tip) => tipSum + Number(tip.amount), 0)
        return paymentAmount > 0 ? (tipsTotal / paymentAmount) * 100 : 0
      })

      avgTipPercentage = tipPercentages.reduce((sum, percentage) => sum + percentage, 0) / paymentsWithTips.length
    }

    return {
      totalTips,
      avgTipPercentage: (avgTipPercentage || 0).toFixed(1),
    }
  }, [filteredPayments])

  // Process comparison data
  const compareReviews = useMemo(() => compareData?.reviews || [], [compareData?.reviews])
  const compareFiveStarReviews = useMemo(() => {
    return compareReviews.filter(review => review.stars === 5).length
  }, [compareReviews])

  const comparePayments = useMemo(() => compareData?.payments || [], [compareData?.payments])
  const compareAmount = useMemo(() => {
    return comparePayments.reduce((sum, payment) => sum + Number(payment.amount), 0)
  }, [comparePayments])

  const compareTipStats = useMemo(() => {
    if (!comparePayments?.length) return { totalTips: 0, avgTipPercentage: '0' }

    const paymentsWithTips = comparePayments.filter(payment => payment.tips && payment.tips.length > 0)

    const totalTips = paymentsWithTips.reduce((sum, payment) => {
      const tipsSum = payment.tips.reduce((tipSum, tip) => tipSum + Number(tip.amount), 0)
      return sum + tipsSum
    }, 0)

    let avgTipPercentage = 0
    if (paymentsWithTips.length > 0) {
      const tipPercentages = paymentsWithTips.map(payment => {
        const paymentAmount = Number(payment.amount)
        const tipsTotal = payment.tips.reduce((tipSum, tip) => tipSum + Number(tip.amount), 0)
        return paymentAmount > 0 ? (tipsTotal / paymentAmount) * 100 : 0
      })

      avgTipPercentage = tipPercentages.reduce((sum, percentage) => sum + percentage, 0) / paymentsWithTips.length
    }

    return {
      totalTips,
      avgTipPercentage: (avgTipPercentage || 0).toFixed(1),
    }
  }, [comparePayments])

  // Calculate comparison percentages
  const getComparisonPercentage = (currentValue: number, previousValue: number): number => {
    if (previousValue === 0) return currentValue > 0 ? 100 : 0
    return Math.round(((currentValue - previousValue) / previousValue) * 100)
  }

  const amountChangePercentage = useMemo(() => {
    return getComparisonPercentage(totalAmount, compareAmount)
  }, [totalAmount, compareAmount])

  const reviewsChangePercentage = useMemo(() => {
    return getComparisonPercentage(fiveStarReviews, compareFiveStarReviews)
  }, [fiveStarReviews, compareFiveStarReviews])

  const tipsChangePercentage = useMemo(() => {
    return getComparisonPercentage(tipStats.totalTips, compareTipStats.totalTips)
  }, [tipStats.totalTips, compareTipStats.totalTips])

  const tipAvgChangePercentage = useMemo(() => {
    return getComparisonPercentage(parseFloat(String(tipStats.avgTipPercentage)), parseFloat(String(compareTipStats.avgTipPercentage)))
  }, [tipStats.avgTipPercentage, compareTipStats.avgTipPercentage])

  // Export functions (simplified for now)
  const exportToCSV = useCallback(async () => {
    // Simplified export - could be enhanced to fetch all data if needed
    setExportLoading(true)
    // Implementation would be similar to original but with basic data
    setExportLoading(false)
  }, [])

  const exportToExcel = useCallback(async () => {
    // Simplified export - could be enhanced to fetch all data if needed
    setExportLoading(true)
    // Implementation would be similar to original but with basic data
    setExportLoading(false)
  }, [])

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header with date range buttons */}
      <div className="sticky top-0 z-10 bg-background border-b border-border shadow-sm p-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <div className="flex items-center gap-3 overflow-x-auto pb-1 md:pb-0">
            {/* Quick filter buttons */}
            <div className="flex space-x-2">
              <Button
                size="sm"
                variant={activeFilter === 'today' ? 'default' : 'outline'}
                onClick={handleToday}
                className="whitespace-nowrap"
              >
                Hoy
              </Button>
              <Button
                size="sm"
                variant={activeFilter === '7days' ? 'default' : 'outline'}
                onClick={handleLast7Days}
                className="whitespace-nowrap"
              >
                {t('home.filters.last7')}
              </Button>
              <Button
                size="sm"
                variant={activeFilter === '30days' ? 'default' : 'outline'}
                onClick={handleLast30Days}
                className="whitespace-nowrap"
              >
                {t('home.filters.last30')}
              </Button>
            </div>

            <DateRangePicker
              showCompare={false}
              onUpdate={({ range }) => {
                setSelectedRange(range)

                const selectedDuration = range.to.getTime() - range.from.getTime()
                const compareEnd = new Date(range.from.getTime() - 1)
                const compareStart = new Date(compareEnd.getTime() - selectedDuration)

                setCompareRange({ from: compareStart, to: compareEnd })
                setCompareType('custom')
                setComparisonLabel('período anterior')
                setActiveFilter('custom')
              }}
              initialDateFrom={selectedRange.from}
              initialDateTo={selectedRange.to}
              align="start"
              locale={localeCode}
            />

            <div className="relative">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isBasicLoading || exportLoading || isBasicError}
                    className="flex items-center gap-2"
                  >
                    {exportLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>{t('home.export.exporting')}</span>
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        <span>{t('home.export.export')}</span>
                      </>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={exportToCSV}>{t('home.export.json')}</DropdownMenuItem>
                  <DropdownMenuItem onClick={exportToExcel}>{t('home.export.csv')}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 p-2 md:p-4 space-y-4 mx-auto w-full">
        {isBasicError ? (
          <Card className="p-6">
            <div className="text-center space-y-4">
              <h2 className="text-xl font-semibold text-destructive">{t('home.error.failedTitle')}</h2>
              <p className="text-muted-foreground">{basicError?.message || t('home.error.unknown')}</p>
              <Button
                onClick={() => {
                  refetchBasicData()
                  if (compareType) refetchCompareData()
                }}
              >
                {t('header.retry')}
              </Button>
            </div>
          </Card>
        ) : (
          <>
            {/* Key metrics cards - Priority Load */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Total ventas"
                value={isBasicLoading ? null : Currency(totalAmount)}
                isLoading={isBasicLoading}
                icon={<DollarIcon />}
                percentage={compareType ? amountChangePercentage : null}
                comparisonLabel={comparisonLabel}
                isPercentageLoading={compareType ? isCompareLoading : false}
              />
              <MetricCard
                title="5 estrellas Google"
                value={isBasicLoading ? null : fiveStarReviews}
                isLoading={isBasicLoading}
                icon={<StarIcon />}
                percentage={compareType ? reviewsChangePercentage : null}
                comparisonLabel={comparisonLabel}
                isPercentageLoading={compareType ? isCompareLoading : false}
              />
              <MetricCard
                title="Total propinas"
                value={isBasicLoading ? null : Currency(tipStats.totalTips, false)}
                isLoading={isBasicLoading}
                icon={<TipIcon />}
                percentage={compareType ? tipsChangePercentage : null}
                comparisonLabel={comparisonLabel}
                isPercentageLoading={compareType ? isCompareLoading : false}
              />
              <MetricCard
                title="Promedio propinas %"
                value={isBasicLoading ? null : `${tipStats.avgTipPercentage}%`}
                isLoading={isBasicLoading}
                icon={<PercentIcon />}
                percentage={compareType ? tipAvgChangePercentage : null}
                comparisonLabel={comparisonLabel}
                isPercentageLoading={compareType ? isCompareLoading : false}
              />
            </div>

            {/* Payment methods chart - Also priority since it uses basic data */}
            <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
              <Card className="lg:col-span-4 flex flex-col">
                <CardHeader className="border-b pb-3">
                  <CardTitle>{t('home.sections.paymentMethods')}</CardTitle>
                  <CardDescription>
                    {selectedRange.from && selectedRange.to
                      ? `${format(selectedRange.from, 'dd MMM yyyy', { locale: dateLocale })} - ${format(selectedRange.to, 'dd MMM yyyy', {
                          locale: dateLocale,
                        })}`
                      : t('home.currentPeriod')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 pt-6 pb-0">
                  {isBasicLoading ? (
                    <div className="animate-pulse flex h-full w-full flex-col space-y-4">
                      <div className="h-6 bg-muted rounded w-1/2 mx-auto"></div>
                      <div className="h-64 bg-muted rounded-full w-64 mx-auto"></div>
                    </div>
                  ) : !paymentMethodsData || paymentMethodsData.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-muted-foreground">{t('home.noData')}</p>
                    </div>
                  ) : (
                    <div className="mx-auto aspect-square max-h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Tooltip
                            formatter={value => `${Currency(Number(value), false)}`}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                          />
                          <Pie
                            data={paymentMethodsData}
                            dataKey="total"
                            nameKey="method"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            innerRadius={60}
                            paddingAngle={2}
                            strokeWidth={5}
                          >
                            {paymentMethodsData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                            <Label
                              content={({ viewBox }) => {
                                if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                                  return (
                                    <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                                      <tspan
                                        x={viewBox.cx}
                                        y={viewBox.cy}
                                        className="text-lg font-bold"
                                        style={{ fill: 'hsl(var(--foreground))' }}
                                      >
                                        {Currency(totalAmount, false)}
                                      </tspan>
                                      <tspan
                                        x={viewBox.cx}
                                        y={(viewBox.cy || 0) + 24}
                                        className="text-sm"
                                        style={{ fill: 'hsl(var(--muted-foreground))' }}
                                      >
                                        {t('home.total')}
                                      </tspan>
                                    </text>
                                  )
                                }
                              }}
                            />
                          </Pie>
                          <Legend verticalAlign="bottom" align="center" layout="horizontal" iconSize={10} iconType="circle" />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
                {!isBasicLoading && paymentMethodsData && paymentMethodsData.length > 0 && compareType && (
                  <CardFooter className="flex-col gap-2 text-sm pt-2">
                    <div className="flex items-center gap-2 font-medium leading-none">
                      {amountChangePercentage > 0 ? (
                        <>
                          <TrendingUp className="h-4 w-4 text-green-600" />
                          <span className="text-green-600">
                            Incremento de {amountChangePercentage}% vs {comparisonLabel}
                          </span>
                        </>
                      ) : amountChangePercentage < 0 ? (
                        <>
                          <TrendingUp className="h-4 w-4 text-red-600 rotate-180" />
                          <span className="text-red-600">
                            Disminución de {Math.abs(amountChangePercentage)}% vs {comparisonLabel}
                          </span>
                        </>
                      ) : (
                        <span>Sin cambios vs {comparisonLabel}</span>
                      )}
                    </div>
                  </CardFooter>
                )}
              </Card>

              {/* Progressive sections will be added here using intersection observer */}
              <ProgressiveChartSection
                venueId={venueId}
                chartType={CHART_TYPES.BEST_SELLING_PRODUCTS}
                selectedRange={selectedRange}
                className="lg:col-span-3"
              />
            </div>

            {/* Strategic Analytics Sections */}

            {/* Revenue Trends - Priority Chart */}
            <ProgressiveChartSection
              venueId={venueId}
              chartType="revenue-trends"
              selectedRange={selectedRange}
              className="grid grid-cols-1"
            />

            {/* Operational Performance Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ProgressiveChartSection venueId={venueId} chartType="aov-trends" selectedRange={selectedRange} />

              <ProgressiveChartSection venueId={venueId} chartType="order-frequency" selectedRange={selectedRange} />
            </div>

            {/* Staff & Table Performance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ProgressiveMetricSection venueId={venueId} metricType="staff-efficiency" selectedRange={selectedRange} />

              <ProgressiveMetricSection venueId={venueId} metricType="table-efficiency" selectedRange={selectedRange} />
            </div>

            {/* Customer Experience Analytics */}
            <ProgressiveChartSection
              venueId={venueId}
              chartType="customer-satisfaction"
              selectedRange={selectedRange}
              className="grid grid-cols-1"
            />

            {/* Operational Efficiency */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ProgressiveChartSection venueId={venueId} chartType={CHART_TYPES.PEAK_HOURS} selectedRange={selectedRange} />

              <ProgressiveChartSection venueId={venueId} chartType="kitchen-performance" selectedRange={selectedRange} />
            </div>

            {/* Additional Analytics */}
            <ProgressiveChartSection
              venueId={venueId}
              chartType={CHART_TYPES.TIPS_OVER_TIME}
              selectedRange={selectedRange}
              className="grid grid-cols-1"
            />

            {/* Product & Financial Analytics */}
            <ProgressiveMetricSection
              venueId={venueId}
              metricType="product-analytics"
              selectedRange={selectedRange}
              className="grid grid-cols-1"
            />
          </>
        )}
      </div>
    </div>
  )
}

// Progressive chart section component
const ProgressiveChartSection = ({
  venueId,
  chartType,
  selectedRange,
  className = '',
}: {
  venueId: string
  chartType: string
  selectedRange: { from: Date; to: Date }
  className?: string
}) => {
  const [ref, isVisible] = useProgressiveLoader()
  const dashboardService = useMemo(() => new DashboardProgressiveService(venueId), [venueId])

  const { data, isLoading } = useQuery({
    queryKey: ['chart', chartType, venueId, selectedRange.from.toISOString(), selectedRange.to.toISOString()],
    queryFn: async () => {
      return await dashboardService.getChartData(chartType as any, selectedRange)
    },
    enabled: isVisible,
    staleTime: 5 * 60 * 1000,
  })

  return (
    <div ref={ref} className={className}>
      <ProgressiveSection
        isLoading={!isVisible || isLoading}
        skeleton={chartType === CHART_TYPES.BEST_SELLING_PRODUCTS ? <ProductListSkeleton /> : <ChartSkeleton />}
      >
        {/* Render the specific chart based on chartType and data */}
        {renderChartContent(chartType, data)}
      </ProgressiveSection>
    </div>
  )
}

// Progressive metric section component
const ProgressiveMetricSection = ({
  venueId,
  metricType,
  selectedRange,
  className = '',
}: {
  venueId: string
  metricType: string
  selectedRange: { from: Date; to: Date }
  className?: string
}) => {
  const [ref, isVisible] = useProgressiveLoader()
  const dashboardService = useMemo(() => new DashboardProgressiveService(venueId), [venueId])

  const { data, isLoading } = useQuery({
    queryKey: ['metric', metricType, venueId, selectedRange.from.toISOString(), selectedRange.to.toISOString()],
    queryFn: async () => {
      return await dashboardService.getExtendedMetrics(metricType as any, selectedRange)
    },
    enabled: isVisible,
    staleTime: 5 * 60 * 1000,
  })

  return (
    <div ref={ref} className={className}>
      <ProgressiveSection
        isLoading={!isVisible || isLoading}
        skeleton={
          metricType === METRIC_TYPES.TABLE_PERFORMANCE ? (
            <TablePerformanceSkeleton />
          ) : metricType === METRIC_TYPES.PRODUCT_PROFITABILITY ? (
            <TableSkeleton />
          ) : (
            <StaffPerformanceSkeleton />
          )
        }
      >
        {/* Render the specific metric content based on metricType and data */}
        {renderMetricContent(metricType, data)}
      </ProgressiveSection>
    </div>
  )
}

// Helper function to render chart content
const renderChartContent = (chartType: string, data: any) => {
  if (!data) return <div>No data available</div>

  switch (chartType) {
    case CHART_TYPES.BEST_SELLING_PRODUCTS:
      return <BestSellingProductsChart data={data} />

    case CHART_TYPES.PEAK_HOURS:
      return <PeakHoursChart data={data} />

    case CHART_TYPES.TIPS_OVER_TIME:
      return <TipsOverTimeChart data={data} />

    // Strategic Analytics Charts
    case 'revenue-trends':
      return <RevenueTrendsChart data={data} />

    case 'aov-trends':
      return <AOVTrendsChart data={data} />

    case 'order-frequency':
      return <OrderFrequencyChart data={data} />

    case 'customer-satisfaction':
      return <CustomerSatisfactionChart data={data} />

    case 'kitchen-performance':
      return <KitchenPerformanceChart data={data} />

    default:
      return (
        <Card>
          <CardHeader>
            <CardTitle>{chartType.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-8 text-center text-muted-foreground">Chart content for {chartType} would be rendered here</div>
          </CardContent>
        </Card>
      )
  }
}

// Helper function to render metric content
const renderMetricContent = (metricType: string, data: any) => {
  if (!data) return <div>No data available</div>

  switch (metricType) {
    case 'staff-efficiency':
      return <StaffEfficiencyMetrics data={data} />

    case 'table-efficiency':
      return <TableEfficiencyMetrics data={data} />

    case 'product-analytics':
      return <ProductAnalyticsMetrics data={data} />

    default:
      return (
        <Card>
          <CardHeader>
            <CardTitle>{metricType.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-8 text-center text-muted-foreground">Metric content for {metricType} would be rendered here</div>
          </CardContent>
        </Card>
      )
  }
}

// Strategic Analytics Components with original Recharts styling

// Best Selling Products Chart
const BestSellingProductsChart = ({ data }: { data: any }) => {
  const { t } = useTranslation()
  // Process products data for best sellers by category
  const bestSellingProducts = useMemo(() => {
    const productsData = data?.products || []
    if (!productsData) return { FOOD: [], BEVERAGE: [], OTHER: [] }

    const categories = { FOOD: [], BEVERAGE: [], OTHER: [] }

    productsData.forEach((product: any) => {
      const productType = product.type || 'OTHER'
      if (categories[productType]) {
        const existing = categories[productType].find((p: any) => p.name === product.name)
        if (existing) {
          existing.quantity = Number(existing.quantity) + Number(product.quantity)
        } else {
          categories[productType].push({ ...product })
        }
      } else {
        categories.OTHER.push({ ...product })
      }
    })

    // Sort by quantity and limit top 3
    Object.keys(categories).forEach(type => {
      categories[type].sort((a: any, b: any) => b.quantity - a.quantity)
      categories[type] = categories[type].slice(0, 3)
    })

    return categories
  }, [data?.products])

  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <CardTitle>{t('home.sections.bestSellers')}</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-5">
          {Object.entries(bestSellingProducts).map(([category, products]) => (
            <div key={category} className="space-y-2">
              <h3 className="font-medium text-sm text-muted-foreground">{t(`home.categories.${String(category)}`)}</h3>
              {products.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('home.noData')}</p>
              ) : (
                <ul className="space-y-1">
                  {products.map((product: any, idx: number) => (
                    <li key={idx} className="flex justify-between items-center text-sm py-1">
                      <span>{product.name}</span>
                      <span className="font-medium">{product.quantity}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Peak Hours Chart
const PeakHoursChart = ({ data }: { data: any }) => {
  const { t } = useTranslation()
  const peakHoursData = data || []

  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <CardTitle>{t('home.sections.peakHours')}</CardTitle>
        <CardDescription>{t('home.sections.peakHoursDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="pt-6" style={{ height: '360px' }}>
        {!peakHoursData || peakHoursData.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">{t('home.noData')}</p>
          </div>
        ) : (
          <ChartContainer
            className="h-full"
            config={{
              sales: {
                label: t('home.charts.sales'),
                color: CHART_COLORS[0],
              },
              transactions: {
                label: t('home.charts.transactions'),
                color: CHART_COLORS[1],
              },
            }}
          >
            <BarChart
              accessibilityLayer
              data={peakHoursData}
              margin={{
                top: 30,
                right: 30,
                left: 20,
                bottom: 20,
              }}
              height={280}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="hour"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={value => `${value}:00`}
                label={{ value: t('home.charts.hourOfDay'), position: 'insideBottomRight', offset: -10 }}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value: any, name: any) =>
                      name === 'sales' ? Currency(Number(value), false) : `${value} ${t('home.charts.transactionsSuffix')}`
                    }
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="sales" fill="var(--color-sales)" radius={4} maxBarSize={30} />
              <Bar dataKey="transactions" fill="var(--color-transactions)" radius={4} maxBarSize={30} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

// Tips Over Time Chart
const TipsOverTimeChart = ({ data }: { data: any }) => {
  const { t, i18n } = useTranslation()
  const localeCode = i18n.language?.startsWith('fr') ? 'fr-FR' : i18n.language?.startsWith('en') ? 'en-US' : 'es-ES'
  // Process tips data over time
  const tipsOverTime = useMemo(() => {
    const payments = data?.payments || []
    if (!payments || payments.length === 0) return []

    const tipsByDate = new Map()

    payments.forEach((payment: any) => {
      if (payment.tips && payment.tips.length > 0) {
        const date = new Date(payment.createdAt).toISOString().split('T')[0]
        const tipAmount = payment.tips.reduce((sum: number, tip: any) => sum + Number(tip.amount), 0)

        if (tipsByDate.has(date)) {
          tipsByDate.set(date, tipsByDate.get(date) + tipAmount)
        } else {
          tipsByDate.set(date, tipAmount)
        }
      }
    })

    return Array.from(tipsByDate.entries())
      .map(([date, amount]) => ({
        date,
        tips: amount,
        formattedDate: new Date(date).toLocaleDateString(localeCode, { month: 'short', day: 'numeric' }),
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [data?.payments])

  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <CardTitle>{t('home.sections.tipsOverTime')}</CardTitle>
        <CardDescription>{t('home.sections.tipsOverTimeDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="pt-6" style={{ height: '360px' }}>
        {!tipsOverTime || tipsOverTime.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">{t('home.noData')}</p>
          </div>
        ) : (
          <ChartContainer
            className="h-full"
            config={{
              tips: {
                label: t('home.charts.tips'),
                color: CHART_COLORS[2],
              },
            }}
          >
            <BarChart
              accessibilityLayer
              data={tipsOverTime}
              margin={{
                top: 30,
                right: 30,
                left: 20,
                bottom: 20,
              }}
              height={280}
            >
              <CartesianGrid vertical={false} />
              <XAxis dataKey="formattedDate" tickLine={false} tickMargin={10} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent formatter={(value: any) => Currency(Number(value))} />} />
              <Bar dataKey="tips" fill="var(--color-tips)" radius={4} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

// Revenue Trends Chart
const RevenueTrendsChart = ({ data }: { data: any }) => {
  const { t } = useTranslation()
  const revenueData = data?.revenue || []

  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <CardTitle>{t('home.sections.revenueTrends')}</CardTitle>
        <CardDescription>{t('home.sections.revenueTrendsDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="pt-6" style={{ height: '360px' }}>
        {!revenueData || revenueData.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">{t('home.noData')}</p>
          </div>
        ) : (
          <ChartContainer
            className="h-full"
            config={{
              revenue: {
                label: t('home.charts.revenue'),
                color: CHART_COLORS[0],
              },
            }}
          >
            <BarChart
              accessibilityLayer
              data={revenueData}
              margin={{
                top: 30,
                right: 30,
                left: 20,
                bottom: 20,
              }}
              height={280}
            >
              <CartesianGrid vertical={false} />
              <XAxis dataKey="formattedDate" tickLine={false} tickMargin={10} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent formatter={(value: any) => Currency(Number(value))} />} />
              <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

// Average Order Value Trends Chart
const AOVTrendsChart = ({ data }: { data: any }) => {
  const aovData = data?.aov || []

  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <CardTitle>Ticket Promedio</CardTitle>
        <CardDescription>Valor promedio por orden</CardDescription>
      </CardHeader>
      <CardContent className="pt-6" style={{ height: '360px' }}>
        {!aovData || aovData.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">No hay datos disponibles</p>
          </div>
        ) : (
          <ChartContainer
            className="h-full"
            config={{
              aov: {
                label: 'Ticket Promedio',
                color: CHART_COLORS[1],
              },
            }}
          >
            <BarChart
              accessibilityLayer
              data={aovData}
              margin={{
                top: 30,
                right: 30,
                left: 20,
                bottom: 20,
              }}
              height={280}
            >
              <CartesianGrid vertical={false} />
              <XAxis dataKey="formattedDate" tickLine={false} tickMargin={10} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent formatter={(value: any) => Currency(Number(value))} />} />
              <Bar dataKey="aov" fill="var(--color-aov)" radius={4} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

// Order Frequency Chart
const OrderFrequencyChart = ({ data }: { data: any }) => {
  const frequencyData = data?.frequency || []

  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <CardTitle>Frecuencia de Órdenes</CardTitle>
        <CardDescription>Número de órdenes por hora</CardDescription>
      </CardHeader>
      <CardContent className="pt-6" style={{ height: '360px' }}>
        {!frequencyData || frequencyData.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">No hay datos disponibles</p>
          </div>
        ) : (
          <ChartContainer
            className="h-full"
            config={{
              orders: {
                label: 'Órdenes',
                color: CHART_COLORS[3],
              },
            }}
          >
            <BarChart
              accessibilityLayer
              data={frequencyData}
              margin={{
                top: 30,
                right: 30,
                left: 20,
                bottom: 20,
              }}
              height={280}
            >
              <CartesianGrid vertical={false} />
              <XAxis dataKey="hour" tickLine={false} tickMargin={10} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent formatter={(value: any) => `${value} órdenes`} />} />
              <Bar dataKey="orders" fill="var(--color-orders)" radius={4} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

// Customer Satisfaction Chart
const CustomerSatisfactionChart = ({ data }: { data: any }) => {
  const satisfactionData = data?.satisfaction || []

  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <CardTitle>Satisfacción del Cliente</CardTitle>
        <CardDescription>Calificaciones promedio y tendencias de reviews</CardDescription>
      </CardHeader>
      <CardContent className="pt-6" style={{ height: '360px' }}>
        {!satisfactionData || satisfactionData.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">No hay datos disponibles</p>
          </div>
        ) : (
          <ChartContainer
            className="h-full"
            config={{
              rating: {
                label: 'Calificación',
                color: CHART_COLORS[4],
              },
              reviewCount: {
                label: 'N° Reviews',
                color: CHART_COLORS[5],
              },
            }}
          >
            <BarChart
              accessibilityLayer
              data={satisfactionData}
              margin={{
                top: 30,
                right: 30,
                left: 20,
                bottom: 20,
              }}
              height={280}
            >
              <CartesianGrid vertical={false} />
              <XAxis dataKey="formattedDate" tickLine={false} tickMargin={10} axisLine={false} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value: any, name: any) => (name === 'rating' ? `${value} estrellas` : `${value} reviews`)}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="rating" fill="var(--color-rating)" radius={4} maxBarSize={30} />
              <Bar dataKey="reviewCount" fill="var(--color-reviewCount)" radius={4} maxBarSize={30} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

// Kitchen Performance Chart
const KitchenPerformanceChart = ({ data }: { data: any }) => {
  const kitchenData = data?.kitchen || []

  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <CardTitle>Rendimiento de Cocina</CardTitle>
        <CardDescription>Tiempos de preparación vs metas</CardDescription>
      </CardHeader>
      <CardContent className="pt-6" style={{ height: '360px' }}>
        {!kitchenData || kitchenData.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">No hay datos disponibles</p>
          </div>
        ) : (
          <ChartContainer
            className="h-full"
            config={{
              prepTime: {
                label: 'Tiempo Real',
                color: CHART_COLORS[0],
              },
              target: {
                label: 'Meta',
                color: CHART_COLORS[2],
              },
            }}
          >
            <BarChart
              accessibilityLayer
              data={kitchenData}
              margin={{
                top: 30,
                right: 30,
                left: 20,
                bottom: 20,
              }}
              height={280}
            >
              <CartesianGrid vertical={false} />
              <XAxis dataKey="category" tickLine={false} tickMargin={10} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent formatter={(value: any) => `${value} min`} />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="prepTime" fill="var(--color-prepTime)" radius={4} maxBarSize={30} />
              <Bar dataKey="target" fill="var(--color-target)" radius={4} maxBarSize={30} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

// Strategic Metric Components
const StaffEfficiencyMetrics = ({ data }: { data: any }) => {
  const { t } = useTranslation()
  const staffData = data?.staffPerformance || []

  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <CardTitle>{t('home.sections.staffEfficiency')}</CardTitle>
        <CardDescription>{t('home.sections.staffEfficiencyDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        {!staffData || staffData.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-muted-foreground">{t('home.noData')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {staffData.slice(0, 5).map((staff: any, index: number) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400">{index + 1}</span>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{staff.name}</p>
                    <p className="text-sm text-muted-foreground">{staff.role}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-foreground">{Currency(staff.totalSales || 0, false)}</p>
                  <p className="text-xs text-muted-foreground">
                    {staff.orderCount || 0} {t('home.charts.orders')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const TableEfficiencyMetrics = ({ data }: { data: any }) => {
  const { t } = useTranslation()
  const tableData = data?.tablePerformance || []

  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <CardTitle>{t('home.sections.tableEfficiency')}</CardTitle>
        <CardDescription>{t('home.sections.tableEfficiencyDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        {!tableData || tableData.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-muted-foreground">{t('home.noData')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tableData.slice(0, 5).map((table: any, index: number) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                    <span className="text-xs font-medium text-green-600 dark:text-green-400">{table.tableNumber}</span>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {t('home.table', { defaultValue: 'Mesa' })} {table.tableNumber}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {table.orderCount || 0} {t('home.charts.orders')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-foreground">{Currency(table.totalRevenue || 0, false)}</p>
                  <p className="text-xs text-muted-foreground">
                    {Currency(table.avgTicket || 0, false)} {t('home.charts.avg')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const ProductAnalyticsMetrics = ({ data }: { data: any }) => {
  const { t } = useTranslation()
  const productData = data?.productProfitability || []

  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <CardTitle>{t('home.sections.productAnalytics')}</CardTitle>
        <CardDescription>{t('home.sections.productAnalyticsDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        {!productData || productData.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-muted-foreground">{t('home.noData')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {productData.slice(0, 5).map((product: any, index: number) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                    <span className="text-xs font-medium text-purple-600 dark:text-purple-400">{index + 1}</span>
                  </div>
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {product.quantity || 0} {t('home.charts.sold')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">{Currency(product.totalRevenue || 0, false)}</p>
                  <p className="text-xs text-muted-foreground">
                    {(product.marginPercentage || 0).toFixed(1)}% {t('home.charts.margin')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default Home
