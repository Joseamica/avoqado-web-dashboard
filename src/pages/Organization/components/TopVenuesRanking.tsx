import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '@/components/ui/glass-card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
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
        return <Trophy className="h-4 w-4 text-yellow-500" />
      case 2:
        return <Medal className="h-4 w-4 text-muted-foreground" />
      case 3:
        return <Award className="h-4 w-4 text-amber-600" />
      default:
        return (
          <span className="h-4 w-4 flex items-center justify-center text-xs font-bold text-muted-foreground">
            {rank}
          </span>
        )
    }
  }

  const getTrendInfo = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return { icon: TrendingUp, color: 'text-green-600 dark:text-green-400', label: t('dashboard.trending.up') }
      case 'down':
        return { icon: TrendingDown, color: 'text-red-600 dark:text-red-400', label: t('dashboard.trending.down') }
      default:
        return { icon: Minus, color: 'text-muted-foreground', label: t('dashboard.trending.stable') }
    }
  }

  if (isLoading) {
    return (
      <GlassCard className="p-5 h-full">
        <Skeleton className="h-5 w-40 mb-1" />
        <Skeleton className="h-4 w-56 mb-5" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      </GlassCard>
    )
  }

  return (
    <GlassCard className="p-5 h-full flex flex-col">
      <div className="mb-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Trophy className="h-4 w-4" />
          {t('dashboard.topPerformers')}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">{t('dashboard.topPerformersDesc')}</p>
      </div>

      {!venues || venues.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          {t('dashboard.noVenues')}
        </div>
      ) : (
        <div className="space-y-1.5 flex-1">
          {venues.map(venue => {
            const trend = getTrendInfo(venue.trend)
            const TrendIcon = trend.icon

            return (
              <div
                key={venue.id}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => navigate(`/venues/${venue.slug}/home`)}
              >
                <div className="w-6 flex justify-center shrink-0">
                  {getRankIcon(venue.rank)}
                </div>
                <Avatar className="h-8 w-8 rounded-lg shrink-0">
                  <AvatarImage src={venue.logo || undefined} alt={venue.name} />
                  <AvatarFallback className="rounded-lg text-xs font-semibold bg-primary/10 text-primary">
                    {venue.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{venue.name}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(venue.revenue)}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <TrendIcon className={cn('h-3 w-3', trend.color)} />
                  <span className={cn('text-[10px] font-medium', trend.color)}>{trend.label}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </GlassCard>
  )
}
