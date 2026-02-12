import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { DollarSign, Gift, Hash, Percent, Receipt, Star } from 'lucide-react'
import { MetricCard } from '@/components/home/metrics'
import { Currency } from '@/utils/currency'
import type { KpiCardId } from '@/config/dashboard-sectors'

// Simple icon components
const DollarIcon = () => <DollarSign className="h-5 w-5 text-blue-500" />
const StarIcon = () => <Star className="h-5 w-5 text-yellow-500" />
const TipIcon = () => <Gift className="h-5 w-5 text-green-500" />
const PercentIcon = () => <Percent className="h-5 w-5 text-purple-500" />
const TransactionsIcon = () => <Hash className="h-5 w-5 text-indigo-500" />
const TicketIcon = () => <Receipt className="h-5 w-5 text-orange-500" />

interface DashboardMetricsProps {
  isBasicLoading: boolean
  totalAmount: number
  compareType: any
  amountChangePercentage: number
  comparisonLabel: string
  isCompareLoading: boolean
  fiveStarReviews: number
  reviewsChangePercentage: number
  tipStats: { totalTips: number; avgTipPercentage: number | string }
  tipsChangePercentage: number
  tipAvgChangePercentage: number
  totalTransactions: number
  avgTicket: number
  transactionsChangePercentage: number
  avgTicketChangePercentage: number
  kpiCards?: KpiCardId[]
}

interface CardDefinition {
  title: string
  value: string | number | null
  icon: React.ReactNode
  percentage: number | null
}

export const DashboardMetrics = ({
  isBasicLoading,
  totalAmount,
  compareType,
  amountChangePercentage,
  comparisonLabel,
  isCompareLoading,
  fiveStarReviews,
  reviewsChangePercentage,
  tipStats,
  tipsChangePercentage,
  tipAvgChangePercentage,
  totalTransactions,
  avgTicket,
  transactionsChangePercentage,
  avgTicketChangePercentage,
  kpiCards,
}: DashboardMetricsProps) => {
  const { t } = useTranslation('home')

  // Build card definitions map
  const cardDefinitions = useMemo((): Record<KpiCardId, CardDefinition> => ({
    totalSales: {
      title: t('cards.totalSales'),
      value: isBasicLoading ? null : Currency(totalAmount),
      icon: <DollarIcon />,
      percentage: compareType ? amountChangePercentage : null,
    },
    fiveStarReviews: {
      title: t('cards.fiveStars'),
      value: isBasicLoading ? null : fiveStarReviews,
      icon: <StarIcon />,
      percentage: compareType ? reviewsChangePercentage : null,
    },
    totalTips: {
      title: t('cards.totalTips'),
      value: isBasicLoading ? null : Currency(tipStats.totalTips, false),
      icon: <TipIcon />,
      percentage: compareType ? tipsChangePercentage : null,
    },
    avgTipPercentage: {
      title: t('cards.avgTipPercentage'),
      value: isBasicLoading ? null : `${tipStats.avgTipPercentage}%`,
      icon: <PercentIcon />,
      percentage: compareType ? tipAvgChangePercentage : null,
    },
    totalTransactions: {
      title: t('cards.totalTransactions'),
      value: isBasicLoading ? null : totalTransactions,
      icon: <TransactionsIcon />,
      percentage: compareType ? transactionsChangePercentage : null,
    },
    avgTicket: {
      title: t('cards.avgTicket'),
      value: isBasicLoading ? null : Currency(avgTicket),
      icon: <TicketIcon />,
      percentage: compareType ? avgTicketChangePercentage : null,
    },
  }), [
    t,
    isBasicLoading,
    totalAmount,
    compareType,
    amountChangePercentage,
    fiveStarReviews,
    reviewsChangePercentage,
    tipStats,
    tipsChangePercentage,
    tipAvgChangePercentage,
    totalTransactions,
    transactionsChangePercentage,
    avgTicket,
    avgTicketChangePercentage,
  ])

  // Default cards if no kpiCards prop
  const activeCards: KpiCardId[] = kpiCards || ['totalSales', 'fiveStarReviews', 'totalTips', 'avgTipPercentage']

  // Dynamic grid columns based on card count
  const gridCols = activeCards.length <= 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'

  return (
    <div className={`grid grid-cols-2 ${gridCols} gap-4`}>
      {activeCards.map(cardId => {
        const card = cardDefinitions[cardId]
        if (!card) return null
        return (
          <MetricCard
            key={cardId}
            title={card.title}
            value={card.value}
            isLoading={isBasicLoading}
            icon={card.icon}
            percentage={card.percentage}
            comparisonLabel={comparisonLabel}
            isPercentageLoading={compareType ? isCompareLoading : false}
          />
        )
      })}
    </div>
  )
}
