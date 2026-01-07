import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3, Clock, MessageSquare, Star, TrendingUp, ThumbsUp, ThumbsDown, Meh } from 'lucide-react'
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

    // TODO: Habilitar métricas de respuesta cuando tengamos verificado el negocio de Google Business
    /*
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
    */

    // Sentiment distribution
    const sentimentDistribution = {
      positive: reviews.filter(r => r.overallRating >= 4).length,
      neutral: reviews.filter(r => r.overallRating === 3).length,
      negative: reviews.filter(r => r.overallRating < 3).length,
    }

    // Rating count distribution (5 stars, 4 stars, etc.)
    const ratingCounts = {
      5: reviews.filter(r => Math.floor(r.overallRating) === 5).length,
      4: reviews.filter(r => Math.floor(r.overallRating) === 4).length,
      3: reviews.filter(r => Math.floor(r.overallRating) === 3).length,
      2: reviews.filter(r => Math.floor(r.overallRating) === 2).length,
      1: reviews.filter(r => Math.floor(r.overallRating) === 1).length,
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
      // responseRate,
      // avgResponseTime,
      sentimentDistribution,
      ratingCounts, // Add this new stat
      sourceDistribution,
      trend,
    }
  }, [reviews])

  /*
  const formatResponseTime = (hours: number) => {
    if (hours < 1) {
      return t('stats.avgResponseTime.minutes', { minutes: Math.round(hours * 60) })
    } else if (hours < 24) {
      return t('stats.avgResponseTime.hours', { hours: Math.round(hours) })
    } else {
      return t('stats.avgResponseTime.days', { days: Math.round(hours / 24) })
    }
  }
  */

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

      {/* 
        TODO: Habilitar tarjetas de métricas de respuesta cuando tengamos verificado el negocio
        (Response Rate & Average Response Time)
      */}

      {/* Rating Distribution (New Card) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium">{t('stats.ratingDistribution', { defaultValue: 'Distribución' })}</CardTitle>
          <Star className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-1 h-10 mt-1">
            {[1, 2, 3, 4, 5].map((star) => {
              const count = stats.ratingCounts[star as keyof typeof stats.ratingCounts] || 0
              const percentage = stats.totalReviews > 0 ? (count / stats.totalReviews) * 100 : 0
              return (
                <div key={star} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div className="w-full bg-muted rounded-sm overflow-hidden h-full flex items-end">
                    <div 
                      className={`w-full ${star >= 4 ? 'bg-green-500' : star === 3 ? 'bg-yellow-500' : 'bg-red-500'} opacity-80`} 
                      style={{ height: `${percentage}%` }} 
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{star}★</span>
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-1 bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 border border-border">
                    {count} ({percentage.toFixed(0)}%)
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Sentiment Overview (New Card) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium">{t('stats.sentimentOverview', { defaultValue: 'Sentimiento' })}</CardTitle>
          <ThumbsUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mt-2">
            <div className="flex flex-col items-center">
              <span className="text-green-600 dark:text-green-400 font-bold flex items-center gap-1">
                <ThumbsUp className="h-3 w-3" /> {stats.sentimentDistribution.positive}
              </span>
              <span className="text-[10px] text-muted-foreground">Positivas</span>
            </div>
            <div className="h-8 w-px bg-border mx-2"></div>
            <div className="flex flex-col items-center">
              <span className="text-yellow-600 dark:text-yellow-400 font-bold flex items-center gap-1">
                <Meh className="h-3 w-3" /> {stats.sentimentDistribution.neutral}
              </span>
              <span className="text-[10px] text-muted-foreground">Neutras</span>
            </div>
            <div className="h-8 w-px bg-border mx-2"></div>
            <div className="flex flex-col items-center">
              <span className="text-red-600 dark:text-red-400 font-bold flex items-center gap-1">
                <ThumbsDown className="h-3 w-3" /> {stats.sentimentDistribution.negative}
              </span>
              <span className="text-[10px] text-muted-foreground">Negativas</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
