import api from '@/api'
import { DateRangePicker } from '@/components/date-range-picker'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useTheme } from '@/context/ThemeContext'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useSocketEvents } from '@/hooks/use-socket-events'
import { useProgressiveLoader } from '@/hooks/use-intersection-observer'
import { Currency } from '@/utils/currency'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { DollarSign, Download, Gift, Loader2, Percent, Star, TrendingUp } from 'lucide-react'
import { unparse } from 'papaparse'
import { useCallback, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Label, LabelList, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'

// Import progressive loading components
import {
  MetricCardSkeleton,
  ChartSkeleton,
  PieChartSkeleton,
  ProductListSkeleton,
  TablePerformanceSkeleton,
  TableSkeleton,
  StaffPerformanceSkeleton,
  ProgressiveSection,
} from '@/components/skeleton/DashboardSkeleton'
import { DashboardProgressiveService, CHART_TYPES, METRIC_TYPES } from '@/services/dashboard.progressive.service'

// Translations for payment methods
const PAYMENT_METHOD_TRANSLATIONS = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  AMEX: 'Amex',
  OTHER: 'Otro',
}

// Translations for product categories
const CATEGORY_TRANSLATIONS = {
  FOOD: 'Comida',
  BEVERAGE: 'Bebida',
  OTHER: 'Otros',
}

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
  comparisonLabel = 'período anterior',
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
            <div className="text-2xl font-bold">{value || 0}</div>
            {isPercentageLoading ? (
              <div className="h-4 w-24 bg-muted rounded animate-pulse mt-1"></div>
            ) : (
              percentage !== null && (
                <div
                  className={`text-xs flex items-center ${
                    percentage > 0 ? 'text-green-600' : percentage < 0 ? 'text-red-600' : 'text-muted-foreground'
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
                    <span>Sin cambios vs {comparisonLabel}</span>
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

const HomeProgressive = () => {
  const { venueId } = useCurrentVenue()
  const { isDark } = useTheme()
  const [exportLoading, setExportLoading] = useState(false)
  const [compareType, setCompareType] = useState<ComparisonPeriod>('')
  const [comparisonLabel, setComparisonLabel] = useState('período anterior')

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
    setComparisonLabel('ayer')
    setActiveFilter('today')
  }, [])

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
    setComparisonLabel('7 días anteriores')
    setActiveFilter('7days')
  }, [])

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
    setComparisonLabel('30 días anteriores')
    setActiveFilter('30days')
  }, [])

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
      <div className="sticky top-0 z-10 bg-card border-border border-b shadow-sm p-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h1 className="text-2xl font-bold">Dashboard</h1>
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
                Últimos 7 días
              </Button>
              <Button
                size="sm"
                variant={activeFilter === '30days' ? 'default' : 'outline'}
                onClick={handleLast30Days}
                className="whitespace-nowrap"
              >
                Últimos 30 días
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
              locale="es-ES"
            />
            
            <div className="relative">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" disabled={isBasicLoading || exportLoading || isBasicError} className="flex items-center gap-2">
                    {exportLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Exportando...</span>
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        <span>Exportar</span>
                      </>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={exportToCSV}>Exportar como JSON</DropdownMenuItem>
                  <DropdownMenuItem onClick={exportToExcel}>Exportar como CSV (Excel)</DropdownMenuItem>
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
              <h2 className="text-xl font-semibold text-red-600">Failed to load dashboard data</h2>
              <p className="text-muted-foreground">{basicError?.message || 'An unknown error occurred'}</p>
              <Button
                onClick={() => {
                  refetchBasicData()
                  if (compareType) refetchCompareData()
                }}
              >
                Retry
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
                value={isBasicLoading ? null : Currency(tipStats.totalTips)}
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
                  <CardTitle>Métodos de pago</CardTitle>
                  <CardDescription>
                    {selectedRange.from && selectedRange.to
                      ? `${format(selectedRange.from, 'dd MMM yyyy', { locale: es })} - ${format(selectedRange.to, 'dd MMM yyyy', {
                          locale: es,
                        })}`
                      : 'Periodo actual'}
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
                      <p className="text-gray-500">No hay datos disponibles</p>
                    </div>
                  ) : (
                    <div className="mx-auto aspect-square max-h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Tooltip
                            formatter={value => `${Currency(Number(value))}`}
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
                                        {Currency(totalAmount)}
                                      </tspan>
                                      <tspan
                                        x={viewBox.cx}
                                        y={(viewBox.cy || 0) + 24}
                                        className="text-sm"
                                        style={{ fill: 'hsl(var(--muted-foreground))' }}
                                      >
                                        Total
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

            {/* Additional progressive sections */}
            <ProgressiveChartSection
              venueId={venueId}
              chartType={CHART_TYPES.TIPS_OVER_TIME}
              selectedRange={selectedRange}
              className="grid grid-cols-1"
            />

            <ProgressiveChartSection
              venueId={venueId}
              chartType={CHART_TYPES.SALES_BY_PAYMENT_METHOD}
              selectedRange={selectedRange}
              className="grid grid-cols-1"
            />

            <ProgressiveChartSection
              venueId={venueId}
              chartType={CHART_TYPES.PEAK_HOURS}
              selectedRange={selectedRange}
              className="grid grid-cols-1"
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ProgressiveMetricSection
                venueId={venueId}
                metricType={METRIC_TYPES.TABLE_PERFORMANCE}
                selectedRange={selectedRange}
              />

              <ProgressiveMetricSection
                venueId={venueId}
                metricType={METRIC_TYPES.PRODUCT_PROFITABILITY}
                selectedRange={selectedRange}
              />
            </div>

            <ProgressiveChartSection
              venueId={venueId}
              chartType={CHART_TYPES.WEEKLY_TRENDS}
              selectedRange={selectedRange}
              className="grid grid-cols-1"
            />

            <ProgressiveMetricSection
              venueId={venueId}
              metricType={METRIC_TYPES.STAFF_PERFORMANCE}
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
  className = "" 
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
        skeleton={
          chartType === CHART_TYPES.BEST_SELLING_PRODUCTS ? (
            <ProductListSkeleton />
          ) : (
            <ChartSkeleton />
          )
        }
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
  className = "" 
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

// Helper function to render chart content (simplified for now)
const renderChartContent = (chartType: string, data: any) => {
  if (!data) return <div>No data available</div>
  
  // This would be expanded to render the actual charts
  return (
    <Card>
      <CardHeader>
        <CardTitle>{chartType.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="p-8 text-center text-gray-500">
          Chart content for {chartType} would be rendered here
        </div>
      </CardContent>
    </Card>
  )
}

// Helper function to render metric content (simplified for now)
const renderMetricContent = (metricType: string, data: any) => {
  if (!data) return <div>No data available</div>
  
  // This would be expanded to render the actual metrics
  return (
    <Card>
      <CardHeader>
        <CardTitle>{metricType.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="p-8 text-center text-gray-500">
          Metric content for {metricType} would be rendered here
        </div>
      </CardContent>
    </Card>
  )
}

export default HomeProgressive