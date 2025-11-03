import { Badge } from '@/components/ui/badge'
import { Frown, Meh, Smile } from 'lucide-react'
import { useTranslation } from 'react-i18next'

type Sentiment = 'positive' | 'neutral' | 'negative'

interface SentimentBadgeProps {
  sentiment: Sentiment
  className?: string
}

const sentimentConfig = {
  positive: {
    icon: Smile,
    colorClass: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
    labelKey: 'sentiment.positive',
  },
  neutral: {
    icon: Meh,
    colorClass: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800',
    labelKey: 'sentiment.neutral',
  },
  negative: {
    icon: Frown,
    colorClass: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
    labelKey: 'sentiment.negative',
  },
}

export function SentimentBadge({ sentiment, className = '' }: SentimentBadgeProps) {
  const { t } = useTranslation('reviews')
  const config = sentimentConfig[sentiment]
  const Icon = config.icon

  return (
    <Badge variant="outline" className={`flex items-center gap-1 px-2 py-0.5 ${config.colorClass} ${className}`}>
      <Icon className="h-3 w-3" />
      <span className="text-xs font-medium">{t(config.labelKey)}</span>
    </Badge>
  )
}

// Helper function to determine sentiment from rating
export function getSentimentFromRating(rating: number): Sentiment {
  if (rating >= 4) return 'positive'
  if (rating >= 3) return 'neutral'
  return 'negative'
}
