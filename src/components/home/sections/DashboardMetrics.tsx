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
  UserX,
  Users,
  XCircle,
} from 'lucide-react'
import { MetricCard } from '@/components/home/metrics'
import { Currency } from '@/utils/currency'
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

export const DashboardMetrics = ({
  metricDefinitions,
  dashboardData,
  isBasicLoading,
  compareType,
  comparisonLabel,
  isCompareLoading,
}: DashboardMetricsProps) => {
  const { t } = useTranslation('home')

  const cards = useMemo(() => {
    return metricDefinitions.map(metric => {
      const rawValue = resolvePath(dashboardData, metric.valueKey)
      const changeValue = resolvePath(dashboardData, metric.changeKey)

      let formattedValue: string | number | null = null
      if (!isBasicLoading && rawValue !== undefined && rawValue !== null) {
        switch (metric.format) {
          case 'currency':
            formattedValue = Currency(Number(rawValue))
            break
          case 'percentage':
            formattedValue = `${rawValue}%`
            break
          case 'number':
            formattedValue = typeof rawValue === 'number'
              ? (Number.isInteger(rawValue) ? rawValue : Number(rawValue.toFixed(1)))
              : rawValue
            break
        }
      }

      return {
        id: metric.id,
        title: t(metric.nameKey),
        value: formattedValue,
        icon: ICON_MAP[metric.iconName] || <DollarSign className="h-5 w-5 text-muted-foreground" />,
        percentage: compareType ? (changeValue ?? null) : null,
      }
    })
  }, [metricDefinitions, dashboardData, isBasicLoading, compareType, t])

  // Dynamic grid: 3 cols for ≤3 cards, 4 cols for 4, 6 cols for 5-6
  const gridCols = cards.length <= 3
    ? 'lg:grid-cols-3'
    : cards.length <= 4
      ? 'lg:grid-cols-4'
      : 'lg:grid-cols-3 xl:grid-cols-6'

  return (
    <div className={`grid grid-cols-2 ${gridCols} gap-4`}>
      {cards.map(card => (
        <MetricCard
          key={card.id}
          title={card.title}
          value={card.value}
          isLoading={isBasicLoading}
          icon={card.icon}
          percentage={card.percentage}
          comparisonLabel={comparisonLabel}
          isPercentageLoading={compareType ? isCompareLoading : false}
        />
      ))}
    </div>
  )
}
