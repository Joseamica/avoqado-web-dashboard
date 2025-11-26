import { useTranslation } from 'react-i18next'
import { DollarSign, Gift, Percent, Star } from 'lucide-react'
import { MetricCard } from '@/components/home/metrics'
import { Currency } from '@/utils/currency'

// Simple icon components
const DollarIcon = () => <DollarSign className="h-5 w-5 text-blue-500" />
const StarIcon = () => <Star className="h-5 w-5 text-yellow-500" />
const TipIcon = () => <Gift className="h-5 w-5 text-green-500" />
const PercentIcon = () => <Percent className="h-5 w-5 text-purple-500" />

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
}: DashboardMetricsProps) => {
  const { t } = useTranslation('home')

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title={t('cards.totalSales')}
        value={isBasicLoading ? null : Currency(totalAmount)}
        isLoading={isBasicLoading}
        icon={<DollarIcon />}
        percentage={compareType ? amountChangePercentage : null}
        comparisonLabel={comparisonLabel}
        isPercentageLoading={compareType ? isCompareLoading : false}
      />
      <MetricCard
        title={t('cards.fiveStars')}
        value={isBasicLoading ? null : fiveStarReviews}
        isLoading={isBasicLoading}
        icon={<StarIcon />}
        percentage={compareType ? reviewsChangePercentage : null}
        comparisonLabel={comparisonLabel}
        isPercentageLoading={compareType ? isCompareLoading : false}
      />
      <MetricCard
        title={t('cards.totalTips')}
        value={isBasicLoading ? null : Currency(tipStats.totalTips, false)}
        isLoading={isBasicLoading}
        icon={<TipIcon />}
        percentage={compareType ? tipsChangePercentage : null}
        comparisonLabel={comparisonLabel}
        isPercentageLoading={compareType ? isCompareLoading : false}
      />
      <MetricCard
        title={t('cards.avgTipPercentage')}
        value={isBasicLoading ? null : `${tipStats.avgTipPercentage}%`}
        isLoading={isBasicLoading}
        icon={<PercentIcon />}
        percentage={compareType ? tipAvgChangePercentage : null}
        comparisonLabel={comparisonLabel}
        isPercentageLoading={compareType ? isCompareLoading : false}
      />
    </div>
  )
}
