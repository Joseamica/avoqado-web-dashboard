/**
 * Dashboard Renderer
 *
 * Data-driven layout engine. Takes a ResolvedDashboard and renders
 * hero KPIs + chart rows using progressive loading.
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp } from 'lucide-react'
import { Pie, PieChart, Label } from 'recharts'

import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import {
  ChartSkeleton,
  ProductListSkeleton,
  ProgressiveSection,
  StaffPerformanceSkeleton,
  TablePerformanceSkeleton,
  TableSkeleton,
} from '@/components/skeleton/DashboardSkeleton'
import { useProgressiveLoader } from '@/hooks/use-intersection-observer'
import { DashboardProgressiveService } from '@/services/dashboard.progressive.service'
import { Currency } from '@/utils/currency'
import { useVenueDateTime } from '@/utils/datetime'

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
  SalesByWeekdayChart,
  CategoryMixChart,
  ChannelMixChart,
  SalesHeatmapChart,
  DiscountAnalysisChart,
  ReservationOverviewChart,
  StaffRankingTable,
} from '@/components/home/charts'
import { StaffEfficiencyMetrics, TableEfficiencyMetrics, ProductAnalyticsMetrics } from '@/components/home/metrics'

import type { ResolvedDashboard, ResolvedRow, ChartDefinition } from '@/config/dashboard-engine'
import type { useDashboardData } from '@/hooks/useDashboardData'

// ==========================================
// Component Map
// ==========================================

const CHART_COMPONENT_MAP: Record<string, React.ComponentType<{ data: any }>> = {
  BestSellingProductsChart,
  PeakHoursChart,
  TipsOverTimeChart,
  RevenueTrendsChart,
  AOVTrendsChart,
  OrderFrequencyChart,
  CustomerSatisfactionChart,
  KitchenPerformanceChart,
  StaffEfficiencyMetrics,
  TableEfficiencyMetrics,
  ProductAnalyticsMetrics,
  SalesByWeekdayChart,
  CategoryMixChart,
  ChannelMixChart,
  SalesHeatmapChart,
  DiscountAnalysisChart,
  ReservationOverviewChart,
  StaffRankingTable,
}

// ==========================================
// Skeleton Map
// ==========================================

function getSkeletonForType(skeletonType: string) {
  switch (skeletonType) {
    case 'product-list':
      return <ProductListSkeleton />
    case 'staff':
      return <StaffPerformanceSkeleton />
    case 'table-perf':
      return <TablePerformanceSkeleton />
    case 'table':
      return <TableSkeleton />
    case 'chart':
    default:
      return <ChartSkeleton />
  }
}

// ==========================================
// Progressive Chart Section
// ==========================================

const ProgressiveChartSection = ({
  venueId,
  chartDef,
  selectedRange,
  className = '',
}: {
  venueId: string
  chartDef: ChartDefinition
  selectedRange: { from: Date; to: Date }
  className?: string
}) => {
  const [ref, isVisible] = useProgressiveLoader()
  const dashboardService = useMemo(() => new DashboardProgressiveService(venueId), [venueId])
  const { t } = useTranslation('home')

  const endpoint = chartDef.dataSource.endpoint

  const { data, isLoading } = useQuery({
    queryKey: [chartDef.dataSource.type, endpoint, venueId, selectedRange.from.toISOString(), selectedRange.to.toISOString()],
    queryFn: async () => {
      if (chartDef.dataSource.type === 'metric') {
        return await dashboardService.getExtendedMetrics(endpoint as any, selectedRange)
      }
      return await dashboardService.getChartData(endpoint as any, selectedRange)
    },
    enabled: isVisible,
    staleTime: 5 * 60 * 1000,
  })

  const Component = CHART_COMPONENT_MAP[chartDef.componentId]

  return (
    <div ref={ref} className={className}>
      <ProgressiveSection
        isLoading={!isVisible || isLoading}
        skeleton={getSkeletonForType(chartDef.skeletonType)}
      >
        {data && Component ? (
          <Component data={data} />
        ) : (
          <div>{t('noData')}</div>
        )}
      </ProgressiveSection>
    </div>
  )
}

// ==========================================
// Payment Methods Pie (basic data, not a chart endpoint)
// ==========================================

const PaymentMethodsPieSection = ({
  dashboardData,
  className = '',
}: {
  dashboardData: ReturnType<typeof useDashboardData>
  className?: string
}) => {
  const { t } = useTranslation('home')
  const { formatDate } = useVenueDateTime()
  const {
    isBasicLoading,
    paymentMethodsData,
    totalAmount,
    amountChangePercentage,
    compareType,
    comparisonLabel,
    selectedRange,
  } = dashboardData

  return (
    <Card className={`flex flex-col ${className}`}>
      <CardHeader className="items-center pb-0">
        <CardTitle>{t('sections.paymentMethods')}</CardTitle>
        <CardDescription>
          {selectedRange.from && selectedRange.to
            ? `${formatDate(selectedRange.from)} - ${formatDate(selectedRange.to)}`
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
              total: { label: t('total') },
              ...paymentMethodsData.reduce((acc: any, item: any, index: number) => {
                const methodKey = normalizePaymentMethod(item.method, t)
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
                            <span className="text-muted-foreground">{t(`payments.methods.${methodKey}`)}</span>
                          </div>
                          <span className="font-mono font-medium tabular-nums text-foreground">
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
                  const methodKey = normalizePaymentMethod(item.method, t)
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
                          <tspan x={viewBox.cx} y={(viewBox.cy || 0) - 6} className="fill-foreground text-base font-bold">
                            {Currency(totalAmount, false)}
                          </tspan>
                          <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 14} className="fill-muted-foreground text-xs">
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
                {t('comparison.trending')} {amountChangePercentage}%{' '}
                <TrendingUp className="h-4 w-4" />
              </>
            ) : amountChangePercentage < 0 ? (
              <>
                {t('comparison.trending')} {Math.abs(amountChangePercentage)}%{' '}
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
  )
}

function normalizePaymentMethod(method: unknown, t: (key: string) => string): string {
  const raw = typeof method === 'string' ? method : String(method)
  const lower = raw.trim().toLowerCase()
  const candidates = ['card', 'cash'] as const
  const matchedKey = candidates.find(k => t(`payments.methods.${k}`) === raw)
  const norm =
    matchedKey ||
    (['card', 'tarjeta', 'credito', 'crédito', 'tc', 'visa', 'mastercard'].some(alias => lower.includes(alias))
      ? 'card'
      : undefined) ||
    (['cash', 'efectivo', 'contado'].some(alias => lower.includes(alias)) ? 'cash' : undefined)
  return (norm || lower) as string
}

// ==========================================
// Row Renderer
// ==========================================

const DashboardRowRenderer = ({
  row,
  venueId,
  selectedRange,
  dashboardData,
}: {
  row: ResolvedRow
  venueId: string
  selectedRange: { from: Date; to: Date }
  dashboardData: ReturnType<typeof useDashboardData>
}) => {
  const layoutClasses: Record<string, string> = {
    full: 'grid grid-cols-1 gap-6',
    split: 'grid grid-cols-1 lg:grid-cols-2 gap-6',
    weighted: 'grid grid-cols-1 lg:grid-cols-7 gap-6',
  }

  const gridClass = layoutClasses[row.layout] || layoutClasses.full

  return (
    <div className={gridClass}>
      {row.items.map((chartDef, index) => {
        if (chartDef.dataSource.type === 'basic') {
          const colSpan = row.layout === 'weighted'
            ? (index === 0 ? 'lg:col-span-4' : 'lg:col-span-3')
            : ''
          return (
            <PaymentMethodsPieSection
              key={chartDef.id}
              dashboardData={dashboardData}
              className={colSpan}
            />
          )
        }

        const colSpan = row.layout === 'weighted'
          ? (index === 0 ? 'lg:col-span-4' : 'lg:col-span-3')
          : ''

        return (
          <ProgressiveChartSection
            key={chartDef.id}
            venueId={venueId}
            chartDef={chartDef}
            selectedRange={selectedRange}
            className={colSpan}
          />
        )
      })}
    </div>
  )
}

// ==========================================
// Main DashboardRenderer
// ==========================================

interface DashboardRendererProps {
  resolvedDashboard: ResolvedDashboard
  dashboardData: ReturnType<typeof useDashboardData>
}

export const DashboardRenderer = ({
  resolvedDashboard,
  dashboardData,
}: DashboardRendererProps) => {
  const { venueId, selectedRange } = dashboardData

  return (
    <>
      {/* Hero KPI Cards — driven by engine metric definitions */}
      <DashboardMetrics
        metricDefinitions={resolvedDashboard.heroKpis}
        dashboardData={dashboardData}
        isBasicLoading={dashboardData.isBasicLoading}
        compareType={dashboardData.compareType}
        comparisonLabel={dashboardData.comparisonLabel}
        isCompareLoading={dashboardData.isCompareLoading}
      />

      {/* Dashboard Rows */}
      {resolvedDashboard.rows.map(row => (
        <DashboardRowRenderer
          key={row.id}
          row={row}
          venueId={venueId}
          selectedRange={selectedRange}
          dashboardData={dashboardData}
        />
      ))}
    </>
  )
}
