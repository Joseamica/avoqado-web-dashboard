import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp } from 'lucide-react'
import { Pie, PieChart, Label } from 'recharts'
import { format } from 'date-fns'
import { es as localeEs, fr as localeFr, enUS as localeEn } from 'date-fns/locale'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { KYCStatusBanner } from '@/components/KYCStatusBanner'
import {
  ChartSkeleton,
  ProductListSkeleton,
  ProgressiveSection,
  StaffPerformanceSkeleton,
  TablePerformanceSkeleton,
  TableSkeleton,
} from '@/components/skeleton/DashboardSkeleton'
import { useProgressiveLoader } from '@/hooks/use-intersection-observer'
import { DashboardProgressiveService, CHART_TYPES, METRIC_TYPES } from '@/services/dashboard.progressive.service'
import { Currency } from '@/utils/currency'

// Hooks
import { useDashboardData } from '@/hooks/useDashboardData'
import { useDashboardExport } from '@/hooks/useDashboardExport'

// Components
import { DashboardHeader } from '@/components/home/sections/DashboardHeader'
import { DashboardMetrics } from '@/components/home/sections/DashboardMetrics'
import {
  BestSellingProductsChart,
  PeakHoursChart,
  TipsOverTimeChart,
  RevenueTrendsChart,
  AOVTrendsChart,
  OrderFrequencyChart,
  CustomerSatisfactionChart,
  KitchenPerformanceChart,
} from '@/components/home/charts'
import { StaffEfficiencyMetrics, TableEfficiencyMetrics, ProductAnalyticsMetrics } from '@/components/home/metrics'

const Home = () => {
  const { t, i18n } = useTranslation('home')
  const dateLocale = i18n.language?.startsWith('fr') ? localeFr : i18n.language?.startsWith('en') ? localeEn : localeEs

  // Use custom hook for data logic
  const dashboardData = useDashboardData()
  const {
    venueId,
    selectedRange,
    compareType,
    comparisonLabel,
    isBasicLoading,
    isBasicError,
    basicError,
    refetchBasicData,
    refetchCompareData,
    totalAmount,
    paymentMethodsData,
    amountChangePercentage,
  } = dashboardData

  // Use custom hook for export logic
  const { exportLoading, exportToJSON, exportToCSV } = useDashboardExport(dashboardData)

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header with date range buttons */}
      <DashboardHeader
        {...dashboardData}
        isBasicLoading={isBasicLoading}
        exportLoading={exportLoading}
        isBasicError={isBasicError}
        exportToJSON={exportToJSON}
        exportToCSV={exportToCSV}
      />

      {/* KYC Status Banner (shown when KYC verification is needed) */}
      <div className="px-2 md:px-4 pt-4">
        <KYCStatusBanner />
      </div>

      {/* Main content */}
      <div className="flex-1 p-2 md:p-4 space-y-4 mx-auto w-full section-soft cards-tinted">
        {isBasicError ? (
          <Card className="p-6">
            <div className="text-center space-y-4">
              <h2 className="text-xl font-semibold text-destructive">{t('error.failedTitle')}</h2>
              <p className="text-muted-foreground">{basicError?.message || t('error.unknown')}</p>
              <Button
                onClick={() => {
                  refetchBasicData()
                  if (compareType) refetchCompareData()
                }}
              >
                {t('common:tryAgain')}
              </Button>
            </div>
          </Card>
        ) : (
          <>
            {/* Key metrics cards - Priority Load */}
            <DashboardMetrics {...dashboardData} />

            {/* Payment methods chart - Also priority since it uses basic data */}
            <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
              <Card className="lg:col-span-4 flex flex-col">
                <CardHeader className="items-center pb-0">
                  <CardTitle>{t('sections.paymentMethods')}</CardTitle>
                  <CardDescription>
                    {selectedRange.from && selectedRange.to
                      ? `${format(selectedRange.from, 'dd MMM yyyy', { locale: dateLocale })} - ${format(selectedRange.to, 'dd MMM yyyy', {
                          locale: dateLocale,
                        })}`
                      : t('currentPeriod')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 pb-0">
                  {isBasicLoading ? (
                    <div className="animate-pulse flex h-full w-full flex-col space-y-4">
                      <div className="h-6 bg-muted rounded w-1/2 mx-auto"></div>
                      <div className="h-64 bg-muted rounded-full w-64 mx-auto"></div>
                    </div>
                  ) : !paymentMethodsData || paymentMethodsData.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-muted-foreground">{t('noData')}</p>
                    </div>
                  ) : (
                    <ChartContainer
                      config={{
                        total: {
                          label: t('total'),
                        },
                        ...paymentMethodsData.reduce((acc: any, item: any, index: number) => {
                          const raw = typeof item.method === 'string' ? item.method : String(item.method)
                          const lower = raw.trim().toLowerCase()
                          // Prefer known keys via translation match for current locale
                          const candidates = ['card', 'cash'] as const
                          const matchedKey = candidates.find(k => t(`payments.methods.${k}`) === raw)
                          // Fallback normalization by common aliases
                          const norm =
                            matchedKey ||
                            (['card', 'tarjeta', 'credito', 'crédito', 'tc', 'visa', 'mastercard'].some(alias => lower.includes(alias))
                              ? 'card'
                              : undefined) ||
                            (['cash', 'efectivo', 'contado'].some(alias => lower.includes(alias)) ? 'cash' : undefined)
                          const methodKey = (norm || lower) as 'card' | 'cash' | string
                          return {
                            ...acc,
                            [methodKey]: {
                              label: t(`payments.methods.${methodKey}`),
                              color: `var(--chart-${(index % 5) + 1})`,
                            },
                          }
                        }, {}),
                      }}
                      className="mx-auto aspect-square max-h-[250px]"
                    >
                      <PieChart>
                        <ChartTooltip
                          cursor={false}
                          content={
                            <ChartTooltipContent
                              hideLabel
                              formatter={(value, _name, item: any) => {
                                const methodKey = item?.payload?.method
                                const color = item?.color || item?.payload?.fill
                                return (
                                  <div className="flex w-full items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                      <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: color }} />
                                      <span className="text-zinc-500 dark:text-zinc-400">{t(`payments.methods.${methodKey}`)}</span>
                                    </div>
                                    <span className="font-mono font-medium tabular-nums text-zinc-950 dark:text-zinc-50">
                                      {Currency(Number(value), false)}
                                    </span>
                                  </div>
                                )
                              }}
                            />
                          }
                        />
                        <Pie
                          data={paymentMethodsData.map((item: any, index: number) => {
                            const raw = typeof item.method === 'string' ? item.method : String(item.method)
                            const lower = raw.trim().toLowerCase()
                            const candidates = ['card', 'cash'] as const
                            const matchedKey = candidates.find(k => t(`payments.methods.${k}`) === raw)
                            const norm =
                              matchedKey ||
                              (['card', 'tarjeta', 'credito', 'crédito', 'tc', 'visa', 'mastercard'].some(alias => lower.includes(alias))
                                ? 'card'
                                : undefined) ||
                              (['cash', 'efectivo', 'contado'].some(alias => lower.includes(alias)) ? 'cash' : undefined)
                            const methodKey = (norm || lower) as 'card' | 'cash' | string
                            return {
                              ...item,
                              method: methodKey,
                              fill: `var(--chart-${(index % 5) + 1})`,
                            }
                          })}
                          dataKey="total"
                          nameKey="method"
                          innerRadius={60}
                          strokeWidth={5}
                        >
                          <Label
                            content={({ viewBox }) => {
                              if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                                return (
                                  <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                                    <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-xl font-bold">
                                      {Currency(totalAmount, false)}
                                    </tspan>
                                    <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 20} className="fill-muted-foreground text-sm">
                                      {t('total')}
                                    </tspan>
                                  </text>
                                )
                              }
                            }}
                          />
                        </Pie>
                      </PieChart>
                    </ChartContainer>
                  )}
                </CardContent>
                {!isBasicLoading && paymentMethodsData && paymentMethodsData.length > 0 && compareType && (
                  <CardFooter className="flex-col gap-2 text-sm">
                    <div className="flex items-center gap-2 font-medium leading-none">
                      {amountChangePercentage > 0 ? (
                        <>
                          {t('comparison.trending')} {amountChangePercentage}% {t('comparison.thisMonth')}{' '}
                          <TrendingUp className="h-4 w-4" />
                        </>
                      ) : amountChangePercentage < 0 ? (
                        <>
                          {t('comparison.trending')} {Math.abs(amountChangePercentage)}% {t('comparison.thisMonth')}{' '}
                          <TrendingUp className="h-4 w-4 rotate-180" />
                        </>
                      ) : (
                        t('comparison.noChange')
                      )}
                    </div>
                    <div className="leading-none text-muted-foreground">
                      {t('comparison.showingTotal')} vs {comparisonLabel}
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
  const { t } = useTranslation('home')

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
        {renderChartContent(chartType, data, t)}
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
  const { t } = useTranslation('home')

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
        {renderMetricContent(metricType, data, t)}
      </ProgressiveSection>
    </div>
  )
}

// Helper function to render chart content
const renderChartContent = (chartType: string, data: any, t: (k: string, o?: any) => string) => {
  if (!data) return <div>{t('noData')}</div>

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
            <div className="p-8 text-center text-muted-foreground">{t('chartContent.placeholder', { name: chartType })}</div>
          </CardContent>
        </Card>
      )
  }
}

// Helper function to render metric content
const renderMetricContent = (metricType: string, data: any, t: (k: string, o?: any) => string) => {
  if (!data) return <div>{t('noData')}</div>

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
            <div className="p-8 text-center text-muted-foreground">{t('metricContent.placeholder', { name: metricType })}</div>
          </CardContent>
        </Card>
      )
  }
}

export default Home
