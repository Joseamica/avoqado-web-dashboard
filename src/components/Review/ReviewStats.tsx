import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3, Clock, MessageSquare, Star, TrendingUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useMemo } from 'react'

interface Review {
  id: string
  overallRating: number
  source: string
  createdAt: string
  responseText?: string
  respondedAt?: string
}

interface ReviewStatsProps {
  reviews: Review[]
}

export function ReviewStats({ reviews }: ReviewStatsProps) {
  const { t } = useTranslation('reviews')

  const stats = useMemo(() => {
    if (reviews.length === 0) {
      return {
        totalReviews: 0,
        averageRating: 0,
        responseRate: 0,
        avgResponseTime: 0,
        sentimentDistribution: { positive: 0, neutral: 0, negative: 0 },
        sourceDistribution: {},
        trend: 0,
      }
    }

    // Calculate average rating
    const averageRating = reviews.reduce((sum, r) => sum + r.overallRating, 0) / reviews.length

    // Calculate response rate
    const respondedCount = reviews.filter(r => r.responseText).length
    const responseRate = (respondedCount / reviews.length) * 100

    // Calculate average response time (in hours)
    const responseTimes = reviews
      .filter(r => r.respondedAt)
      .map(r => {
        const created = new Date(r.createdAt).getTime()
        const responded = new Date(r.respondedAt!).getTime()
        return (responded - created) / (1000 * 60 * 60) // Convert to hours
      })

    const avgResponseTime = responseTimes.length > 0 ? responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length : 0

    // Sentiment distribution
    const sentimentDistribution = {
      positive: reviews.filter(r => r.overallRating >= 4).length,
      neutral: reviews.filter(r => r.overallRating === 3).length,
      negative: reviews.filter(r => r.overallRating < 3).length,
    }

    // Source distribution
    const sourceDistribution = reviews.reduce(
      (acc, r) => {
        acc[r.source] = (acc[r.source] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    // Calculate trend (last 7 days vs previous 7 days)
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

    const lastWeekReviews = reviews.filter(r => new Date(r.createdAt) >= sevenDaysAgo)
    const previousWeekReviews = reviews.filter(r => {
      const date = new Date(r.createdAt)
      return date >= fourteenDaysAgo && date < sevenDaysAgo
    })

    const lastWeekAvg = lastWeekReviews.length > 0 ? lastWeekReviews.reduce((sum, r) => sum + r.overallRating, 0) / lastWeekReviews.length : 0

    const previousWeekAvg =
      previousWeekReviews.length > 0 ? previousWeekReviews.reduce((sum, r) => sum + r.overallRating, 0) / previousWeekReviews.length : 0

    const trend = previousWeekAvg > 0 ? ((lastWeekAvg - previousWeekAvg) / previousWeekAvg) * 100 : 0

    return {
      totalReviews: reviews.length,
      averageRating,
      responseRate,
      avgResponseTime,
      sentimentDistribution,
      sourceDistribution,
      trend,
    }
  }, [reviews])

  const formatResponseTime = (hours: number) => {
    if (hours < 1) {
      return t('stats.avgResponseTime.minutes', { minutes: Math.round(hours * 60) })
    } else if (hours < 24) {
      return t('stats.avgResponseTime.hours', { hours: Math.round(hours) })
    } else {
      return t('stats.avgResponseTime.days', { days: Math.round(hours / 24) })
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Reviews */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium">{t('stats.totalReviews')}</CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalReviews}</div>
          <p className="text-xs text-muted-foreground mt-1">{t('stats.allTime')}</p>
        </CardContent>
      </Card>

      {/* Average Rating */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium">{t('stats.averageRating')}</CardTitle>
          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.averageRating.toFixed(1)}</div>
          {stats.trend !== 0 && (
            <div className={`flex items-center text-xs mt-1 ${stats.trend > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              <TrendingUp className={`h-3 w-3 mr-1 ${stats.trend < 0 ? 'rotate-180' : ''}`} />
              {Math.abs(stats.trend).toFixed(1)}% {t('stats.vsLastWeek')}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Response Rate */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium">{t('stats.responseRate')}</CardTitle>
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.responseRate.toFixed(0)}%</div>
          <p className="text-xs text-muted-foreground mt-1">
            {reviews.filter(r => r.responseText).length} / {stats.totalReviews} {t('stats.responded')}
          </p>
        </CardContent>
      </Card>

      {/* Average Response Time */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium">{t('stats.avgResponseTimeLabel')}</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.avgResponseTime > 0 ? formatResponseTime(stats.avgResponseTime) : 'N/A'}</div>
          <p className="text-xs text-muted-foreground mt-1">{t('stats.averageTime')}</p>
        </CardContent>
      </Card>
    </div>
  )
}
