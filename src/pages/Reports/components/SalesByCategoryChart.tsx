/**
 * SalesByCategoryChart Component
 *
 * Lightweight bar chart showing category sales by time period.
 * Used in the Sales by Category report for time-based report types.
 *
 * Mirrors SalesByItemChart but uses a flat emerald surface (the report's accent)
 * instead of a gradient — new surfaces follow the flat-token design rule.
 */

import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Currency } from '@/utils/currency'
import type { TimePeriodCategoryMetrics } from '@/services/reports/salesByCategory.service'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface SalesByCategoryChartProps {
  data: TimePeriodCategoryMetrics[]
}

const GlassCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div
    className={cn(
      'relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm',
      'shadow-sm transition-all duration-300',
      className,
    )}
  >
    {children}
  </div>
)

export function SalesByCategoryChart({ data }: SalesByCategoryChartProps) {
  const { t } = useTranslation('reports')

  if (!data || data.length === 0) {
    return null
  }

  const normalizedData = data.map(d => ({
    ...d,
    grossSales: typeof d.grossSales === 'object' && d.grossSales !== null ? Number(d.grossSales) : Number(d.grossSales) || 0,
    itemsSold: typeof d.itemsSold === 'object' && d.itemsSold !== null ? Number(d.itemsSold) : Number(d.itemsSold) || 0,
  }))

  const maxValue = Math.max(...normalizedData.map(d => d.grossSales), 1)
  const chartHeight = 200
  const barWidth = Math.max(8, Math.min(40, 100 / normalizedData.length - 2))

  return (
    <GlassCard className="p-6">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">{t('salesByCategory.chart.title')}</h3>

      <div className="relative" style={{ height: chartHeight }}>
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-0 w-16 flex flex-col justify-between text-xs text-muted-foreground pr-2">
          <span className="text-right">{Currency(maxValue)}</span>
          <span className="text-right">{Currency(maxValue / 2)}</span>
          <span className="text-right">{Currency(0)}</span>
        </div>

        {/* Chart area */}
        <div className="ml-16 h-full relative border-l border-b border-border/30">
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
            <div className="border-t border-dashed border-border/20" />
            <div className="border-t border-dashed border-border/20" />
            <div />
          </div>

          <div className="absolute inset-0 flex items-end justify-around px-2">
            {normalizedData.map((item, index) => {
              const heightPx = (item.grossSales / maxValue) * chartHeight
              return (
                <TooltipProvider key={index}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex flex-col justify-end items-center cursor-pointer group h-full" style={{ width: `${barWidth}%` }}>
                        <div
                          className={cn(
                            'w-full rounded-t-sm transition-colors duration-200',
                            'bg-emerald-500/80 group-hover:bg-emerald-500',
                          )}
                          style={{ height: Math.max(heightPx, item.grossSales > 0 ? 4 : 0) }}
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      <div className="space-y-1">
                        <p className="font-medium">{item.periodLabel || item.period}</p>
                        <p className="text-muted-foreground">
                          {t('salesByCategory.columns.grossSales')}: {Currency(item.grossSales)}
                        </p>
                        <p className="text-muted-foreground">
                          {t('salesByCategory.columns.itemsSold')}: {item.itemsSold}
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )
            })}
          </div>
        </div>
      </div>

      {/* X-axis labels */}
      <div className="ml-16 flex justify-around mt-2">
        {normalizedData.map((item, index) => {
          const showLabel = normalizedData.length <= 12 || index % Math.ceil(normalizedData.length / 12) === 0
          return (
            <div key={index} className="text-center" style={{ width: `${barWidth}%` }}>
              {showLabel && <span className="text-xs text-muted-foreground truncate block">{item.periodLabel?.split(' ')[0] || item.period}</span>}
            </div>
          )
        })}
      </div>
    </GlassCard>
  )
}

export default SalesByCategoryChart
