import { useQuery } from '@tanstack/react-query'
import { Star } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { GlassCard } from '@/components/ui/glass-card'
import referralsService from '@/services/referrals.service'
import type { ReferralTier } from '@/types/referrals'

interface HallOfFameProps {
  venueId: string
  limit?: number
}

const TIER_BADGES: Record<ReferralTier, { stars: string; color: string }> = {
  TIER_1: { stars: '⭐', color: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200' },
  TIER_2: { stars: '⭐⭐', color: 'bg-purple-100 text-purple-900 dark:bg-purple-900/40 dark:text-purple-200' },
  TIER_3: { stars: '⭐⭐⭐', color: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200' },
}

export function HallOfFame({ venueId, limit = 10 }: HallOfFameProps) {
  const { t } = useTranslation('referrals')
  const { data, isLoading } = useQuery({
    queryKey: ['referrals', 'hall-of-fame', venueId, limit],
    queryFn: () => referralsService.getHallOfFame(venueId, limit),
    enabled: !!venueId,
  })

  if (isLoading) {
    return (
      <div className="space-y-2" data-testid="hall-of-fame-loading">
        <div className="flex items-center gap-2 mb-3">
          <Star className="h-4 w-4" />
          <h3 className="text-sm font-semibold">{t('hallOfFame.title')}</h3>
        </div>
        <p className="text-sm text-muted-foreground">{t('hallOfFame.loading')}</p>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div data-testid="hall-of-fame-empty">
        <div className="flex items-center gap-2 mb-3">
          <Star className="h-4 w-4" />
          <h3 className="text-sm font-semibold">{t('hallOfFame.title')}</h3>
        </div>
        <GlassCard className="p-6 text-center border-input">
          <p className="text-sm text-muted-foreground">{t('hallOfFame.empty')}</p>
        </GlassCard>
      </div>
    )
  }

  return (
    <div data-testid="hall-of-fame">
      <div className="flex items-center gap-2 mb-3">
        <Star className="h-4 w-4" />
        <h3 className="text-sm font-semibold">{t('hallOfFame.title')}</h3>
      </div>
      <div
        className="flex gap-3 overflow-x-auto pb-2"
        data-testid="hall-of-fame-grid"
      >
        {data.map(entry => {
          const initials =
            [entry.firstName?.[0], entry.lastName?.[0]].filter(Boolean).join('').toUpperCase() || '?'
          const displayName =
            [entry.firstName, entry.lastName].filter(Boolean).join(' ').trim() ||
            t('hallOfFame.unknown')
          const tier = entry.referralTier ? TIER_BADGES[entry.referralTier] : null
          return (
            <GlassCard
              key={entry.id}
              className="flex flex-col items-center gap-2 p-3 min-w-[110px] border-input shrink-0"
              data-testid="hall-of-fame-entry"
            >
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-muted text-foreground font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <p
                className="text-xs font-medium truncate max-w-[90px] text-center"
                title={displayName}
              >
                {displayName}
              </p>
              <p className="text-lg font-bold tabular-nums">{entry.referralCount}</p>
              {tier && (
                <Badge className={tier.color} aria-label={`Tier ${entry.referralTier}`}>
                  <span aria-hidden="true">{tier.stars}</span>
                </Badge>
              )}
            </GlassCard>
          )
        })}
      </div>
    </div>
  )
}

export default HallOfFame
