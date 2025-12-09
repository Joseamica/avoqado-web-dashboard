import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { TrendingUp, TrendingDown, Minus, Trophy, Medal, Award } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TopVenue } from '@/services/organization.service'

interface TopVenuesRankingProps {
  venues: TopVenue[] | undefined
  isLoading?: boolean
  formatCurrency: (amount: number) => string
}

export function TopVenuesRanking({ venues, isLoading, formatCurrency }: TopVenuesRankingProps) {
  const { t } = useTranslation('organization')
  const navigate = useNavigate()

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-5 w-5 text-yellow-500" />
      case 2:
        return <Medal className="h-5 w-5 text-muted-foreground" />
      case 3:
        return <Award className="h-5 w-5 text-amber-600" />
      default:
        return (
          <span className="h-5 w-5 flex items-center justify-center text-sm font-bold text-muted-foreground">
            #{rank}
          </span>
        )
    }
  }

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-500" />
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-500" />
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getTrendLabel = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return t('dashboard.trending.up')
      case 'down':
        return t('dashboard.trending.down')
      default:
        return t('dashboard.trending.stable')
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-6 w-40 bg-muted animate-pulse rounded" />
          <div className="h-4 w-60 bg-muted animate-pulse rounded mt-1" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-5 w-5 bg-muted animate-pulse rounded" />
                <div className="h-10 w-10 bg-muted animate-pulse rounded-lg" />
                <div className="flex-1">
                  <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-24 bg-muted animate-pulse rounded mt-1" />
                </div>
                <div className="h-4 w-4 bg-muted animate-pulse rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!venues || venues.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            {t('dashboard.topPerformers')}
          </CardTitle>
          <CardDescription>{t('dashboard.topPerformersDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            {t('dashboard.noVenues')}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          {t('dashboard.topPerformers')}
        </CardTitle>
        <CardDescription>{t('dashboard.topPerformersDesc')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {venues.map((venue) => (
            <div
              key={venue.id}
              className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => navigate(`/venues/${venue.slug}/home`)}
            >
              {/* Rank */}
              <div className="flex-shrink-0 w-8 flex justify-center">
                {getRankIcon(venue.rank)}
              </div>

              {/* Avatar */}
              <Avatar className="h-10 w-10 rounded-lg flex-shrink-0">
                <AvatarImage src={venue.logo || undefined} alt={venue.name} />
                <AvatarFallback className="rounded-lg">
                  {venue.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{venue.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(venue.revenue)}
                </p>
              </div>

              {/* Trend */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {getTrendIcon(venue.trend)}
                <span
                  className={cn(
                    'text-xs',
                    venue.trend === 'up'
                      ? 'text-green-500'
                      : venue.trend === 'down'
                      ? 'text-red-500'
                      : 'text-muted-foreground'
                  )}
                >
                  {getTrendLabel(venue.trend)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
