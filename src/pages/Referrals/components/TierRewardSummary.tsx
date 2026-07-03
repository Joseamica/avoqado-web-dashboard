import { useQueries } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { getProduct } from '@/services/menu.service'
import type { TierReward } from '@/types/referrals'

/**
 * Natural-language read-only summary for one referral tier level (spec D4):
 * "Nivel N · X referidos → <premios unidos por ' + '>".
 *
 * ONLY rendered by the caller when `config.tierRewards` is present/non-empty
 * (see ReferralsSettings.tsx) — legacy venues without the new backend field
 * keep the original 3-column table untouched. If this specific level has no
 * active `tierRewards` rows (partial/edge data), we still render one line,
 * falling back to the legacy flat percent as a PERCENT_COUPON-style phrase.
 */

type TFunction = (key: string, options?: Record<string, unknown>) => string

function formatPercent(value: string | number | null | undefined): string {
  if (value == null) return '0'
  const n = Number(value)
  return Number.isFinite(n) ? n.toString() : String(value)
}

/** Pure formatter for a single reward row (kept internal — tested via component render). */
function formatRewardPhrase(
  reward: TierReward,
  productNames: Record<string, string>,
  t: TFunction,
): string {
  switch (reward.rewardType) {
    case 'PERCENT_COUPON':
      return t('activate.rewardPercentCoupon', { percent: formatPercent(reward.rewardPercent) })
    case 'PERMANENT_DISCOUNT':
      return t('activate.rewardPermanentDiscount', { percent: formatPercent(reward.rewardPercent) })
    case 'FREE_PRODUCT': {
      const product =
        (reward.rewardProductId && productNames[reward.rewardProductId]) || t('activate.rewardProductFallback')
      const base = t('activate.rewardFreeProduct', { quantity: reward.rewardQuantity, product })
      return reward.recurrence === 'MONTHLY' ? `${base}${t('activate.rewardMonthlySuffix')}` : base
    }
    default:
      return ''
  }
}

/** Fetches product names for a set of product ids (deduped, cached by react-query). */
function useProductNames(venueId: string, productIds: string[]): Record<string, string> {
  const uniqueIds = Array.from(new Set(productIds.filter(Boolean)))

  const results = useQueries({
    queries: uniqueIds.map(id => ({
      queryKey: ['product-name', venueId, id],
      queryFn: () => getProduct(venueId, id),
      enabled: !!venueId && !!id,
      staleTime: 5 * 60 * 1000,
    })),
  })

  const map: Record<string, string> = {}
  uniqueIds.forEach((id, idx) => {
    const name = results[idx]?.data?.name
    if (name) map[id] = name
  })
  return map
}

interface TierRewardSummaryProps {
  venueId: string
  tierLevel: 1 | 2 | 3
  referralsRequired?: number
  /** Legacy flat percent for this level — used only as a per-level graceful fallback. */
  legacyRewardPercent?: number
  /** Full config.tierRewards array — filtered to this level + active rows inside. */
  tierRewards: TierReward[]
}

export default function TierRewardSummary({
  venueId,
  tierLevel,
  referralsRequired,
  legacyRewardPercent,
  tierRewards,
}: TierRewardSummaryProps) {
  const { t } = useTranslation('referrals')

  const activeRewards = tierRewards
    .filter(r => r.tierLevel === tierLevel && r.active)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  const productIds = activeRewards
    .filter(r => r.rewardType === 'FREE_PRODUCT' && r.rewardProductId)
    .map(r => r.rewardProductId as string)
  const productNames = useProductNames(venueId, productIds)

  const rewardsText =
    activeRewards.length > 0
      ? activeRewards.map(r => formatRewardPhrase(r, productNames, t)).join(' + ')
      : legacyRewardPercent != null
        ? t('activate.rewardPercentCoupon', { percent: formatPercent(legacyRewardPercent) })
        : '—'

  return (
    <div className="px-3 py-2.5 text-sm">
      {t('activate.tierSummaryLine', {
        level: tierLevel,
        referralsCount: referralsRequired ?? '—',
        rewards: rewardsText,
      })}
    </div>
  )
}
