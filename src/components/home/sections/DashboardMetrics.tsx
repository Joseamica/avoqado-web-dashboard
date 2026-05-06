import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Armchair,
  CalendarCheck,
  Clock,
  DollarSign,
  Gift,
  Hash,
  Package,
  Percent,
  Receipt,
  ShoppingCart,
  Star,
  TagIcon,
  TrendingUp,
  TrendingDown,
  UserX,
  Users,
  XCircle,
} from 'lucide-react'
import { MetricCard } from '@/components/home/metrics'
import { Card, CardContent } from '@/components/ui/card'
import { Currency } from '@/utils/currency'
import { cn } from '@/lib/utils'
import { useDashboardPack } from '@/hooks/use-dashboard-pack'
import type { MetricDefinition } from '@/config/dashboard-engine'

// Icon map — maps iconName string to React element
const ICON_MAP: Record<string, React.ReactNode> = {
  DollarSign: <DollarSign className="h-5 w-5 text-blue-500" />,
  Star: <Star className="h-5 w-5 text-yellow-500" />,
  Gift: <Gift className="h-5 w-5 text-green-500" />,
  Percent: <Percent className="h-5 w-5 text-purple-500" />,
  Hash: <Hash className="h-5 w-5 text-indigo-500" />,
  Receipt: <Receipt className="h-5 w-5 text-orange-500" />,
  ShoppingCart: <ShoppingCart className="h-5 w-5 text-cyan-500" />,
  Package: <Package className="h-5 w-5 text-teal-500" />,
  Users: <Users className="h-5 w-5 text-pink-500" />,
  TagIcon: <TagIcon className="h-5 w-5 text-red-500" />,
  Armchair: <Armchair className="h-5 w-5 text-amber-500" />,
  Clock: <Clock className="h-5 w-5 text-slate-500" />,
  TrendingUp: <TrendingUp className="h-5 w-5 text-emerald-500" />,
  CalendarCheck: <CalendarCheck className="h-5 w-5 text-violet-500" />,
  UserX: <UserX className="h-5 w-5 text-rose-500" />,
  XCircle: <XCircle className="h-5 w-5 text-red-400" />,
}

// Large icon for hero card
const HERO_ICON_MAP: Record<string, React.ReactNode> = {
  DollarSign: <DollarSign className="h-8 w-8 text-blue-500" />,
  Star: <Star className="h-8 w-8 text-yellow-500" />,
  Hash: <Hash className="h-8 w-8 text-indigo-500" />,
  Receipt: <Receipt className="h-8 w-8 text-orange-500" />,
  ShoppingCart: <ShoppingCart className="h-8 w-8 text-cyan-500" />,
}

// Resolve a dot-path like 'tipStats.totalTips' from an object
function resolvePath(obj: any, path: string): any {
  return path.split('.').reduce((acc, key) => acc?.[key], obj)
}

interface DashboardMetricsProps {
  metricDefinitions: MetricDefinition[]
  dashboardData: any
  isBasicLoading: boolean
  compareType: any
  comparisonLabel: string
  isCompareLoading: boolean
}

function formatMetricValue(rawValue: any, format: string): string | number | null {
  if (rawValue === undefined || rawValue === null) return null
  switch (format) {
    case 'currency':
      return Currency(Number(rawValue))
    case 'percentage':
      return `${rawValue}%`
    case 'number':
      return typeof rawValue === 'number'
        ? (Number.isInteger(rawValue) ? rawValue : Number(rawValue.toFixed(1)))
        : rawValue
    default:
      return rawValue
  }
}

export const DashboardMetrics = ({
  metricDefinitions,
  dashboardData,
  isBasicLoading,
  compareType,
  comparisonLabel,
  isCompareLoading,
}: DashboardMetricsProps) => {
  const { t } = useTranslation('home')
  const { category } = useDashboardPack()

  const cards = useMemo(() => {
    return metricDefinitions.map(metric => {
      const rawValue = resolvePath(dashboardData, metric.valueKey)
      const changeValue = resolvePath(dashboardData, metric.changeKey)
      const labelKey = metric.nameKeyByCategory?.[category] ?? metric.nameKey

      return {
        id: metric.id,
        title: t(labelKey),
        value: isBasicLoading ? null : formatMetricValue(rawValue, metric.format),
        icon: ICON_MAP[metric.iconName] || <DollarSign className="h-5 w-5 text-muted-foreground" />,
        heroIcon: HERO_ICON_MAP[metric.iconName],
        percentage: compareType ? (changeValue ?? null) : null,
        format: metric.format,
      }
    })
  }, [metricDefinitions, dashboardData, isBasicLoading, compareType, t, category])

  if (cards.length === 0) return null

  const heroCard = cards[0]
  const secondaryCards = cards.slice(1)

  return (
    <div className="space-y-4">
      {/* Hero KPI — large, full-width */}
      <Card className="relative overflow-hidden">
        <CardContent className="p-6">
          {isBasicLoading ? (
            <div className="space-y-3">
              <div className="h-5 w-32 bg-muted rounded animate-pulse" />
              <div className="h-12 w-48 bg-muted rounded animate-pulse" />
              <div className="h-4 w-36 bg-muted rounded animate-pulse" />
            </div>
          ) : (
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">{heroCard.title}</p>
                <p className="text-4xl md:text-5xl font-bold tracking-tight text-foreground tabular-nums">
                  {heroCard.value || 0}
                </p>
                {/* Comparison badge */}
                {isCompareLoading ? (
                  <div className="h-5 w-28 bg-muted rounded-full animate-pulse mt-2" />
                ) : (
                  heroCard.percentage !== null && (
                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                          heroCard.percentage > 0
                            ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                            : heroCard.percentage < 0
                              ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                              : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {heroCard.percentage > 0 ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : heroCard.percentage < 0 ? (
                          <TrendingDown className="h-3 w-3" />
                        ) : null}
                        {heroCard.percentage > 0 ? '+' : ''}{heroCard.percentage}%
                      </span>
                      <span className="text-xs text-muted-foreground">
                        vs {comparisonLabel}
                      </span>
                    </div>
                  )
                )}
              </div>
              {/* Hero icon */}
              {heroCard.heroIcon && (
                <div className="p-3 rounded-2xl bg-muted/50">
                  {heroCard.heroIcon}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Secondary KPIs — compact row */}
      {secondaryCards.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory md:grid md:grid-cols-3 lg:grid-cols-5 md:overflow-visible">
          {secondaryCards.map(card => (
            <div key={card.id} className="snap-start shrink-0 w-[160px] md:w-auto">
              <MetricCard
                title={card.title}
                value={card.value}
                isLoading={isBasicLoading}
                icon={card.icon}
                percentage={card.percentage}
                comparisonLabel={comparisonLabel}
                isPercentageLoading={compareType ? isCompareLoading : false}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
