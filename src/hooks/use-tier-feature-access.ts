import { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAccess } from '@/hooks/use-access'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { getTierForFeature, TIER_ORDER, type TierId } from '@/config/plan-catalog'
import { getVenuePlan } from '@/services/features.service'

/** Maps backend PlanState.planTier values to the catalog TierId values. */
function mapPlanTier(planTier: string | null | undefined): TierId {
  if (!planTier) return 'FREE'
  if (planTier === 'GRATIS') return 'FREE'
  if (TIER_ORDER.includes(planTier as TierId)) return planTier as TierId
  return 'FREE'
}

export interface TierFeatureAccess {
  /** True when the venue may use the feature (tier covers it, or superadmin / white-label grant). */
  hasAccess: boolean
  /** The minimum tier that unlocks the feature (for upsell UI). */
  requiredTier: TierId
  /** True while the plan tier is still loading (callers may render optimistically). */
  isLoading: boolean
}

/**
 * Tier-aware feature access for the CURRENT venue.
 *
 * Why this exists: `useAccess().canFeature(code)` / `useAuth().checkFeatureAccess(code)`
 * SHORT-CIRCUIT to `true` for every non-white-label (normal) venue — they were built for
 * white-label feature toggles, NOT the plan-tier model. So they can't gate normal venues by
 * tier. This hook does: a feature is accessible iff the venue's plan tier rank >= the feature's
 * required tier rank. Superadmin always has access; white-label venues still defer to canFeature.
 *
 * Use this (not checkFeatureAccess) wherever a page/sidebar must reflect tier gating for normal
 * venues — e.g. the `<FeatureGate>` decision and a page's "show sample data behind the paywall".
 */
export function useTierFeatureAccess(feature: string, requiredTierOverride?: TierId): TierFeatureAccess {
  const { canFeature, role, isWhiteLabelEnabled } = useAccess()
  const { venueId } = useCurrentVenue()

  const requiredTier = useMemo(
    () => requiredTierOverride ?? getTierForFeature(feature) ?? 'PRO',
    [requiredTierOverride, feature],
  )

  const isSuperadmin = role === 'SUPERADMIN'
  const { data: planState, isLoading: isPlanLoading } = useQuery({
    queryKey: ['venuePlan', venueId],
    queryFn: () => getVenuePlan(venueId!),
    enabled: !!venueId && !isSuperadmin && !isWhiteLabelEnabled,
    staleTime: 5 * 60 * 1000,
  })

  const hasAccess = useMemo(() => {
    if (isSuperadmin) return true
    if (isWhiteLabelEnabled) return canFeature(feature)
    // While the plan is still loading (no cached data), be optimistic to avoid a paywall flash.
    if (isPlanLoading && planState === undefined) return true
    const venueTier = mapPlanTier(planState?.planTier)
    return TIER_ORDER.indexOf(venueTier) >= TIER_ORDER.indexOf(requiredTier)
  }, [isSuperadmin, isWhiteLabelEnabled, canFeature, feature, isPlanLoading, planState, requiredTier])

  return { hasAccess, requiredTier, isLoading: isPlanLoading }
}

/**
 * Same tier-aware access as {@link useTierFeatureAccess} but for checking MANY features from one
 * component (e.g. the sidebar, which decides `premiumLocked` per nav item). Fetches the venue plan
 * ONCE and returns a `hasFeatureAccess(code)` checker. Use this for tier-gated BADGE decisions —
 * NOT for hiding nav items (a normal venue should still SEE a gated item, badged, for discoverability).
 */
export function useVenueTier(): { venueTier: TierId; hasFeatureAccess: (feature: string) => boolean; isLoading: boolean } {
  const { canFeature, role, isWhiteLabelEnabled } = useAccess()
  const { venueId } = useCurrentVenue()

  const isSuperadmin = role === 'SUPERADMIN'
  const { data: planState, isLoading } = useQuery({
    queryKey: ['venuePlan', venueId],
    queryFn: () => getVenuePlan(venueId!),
    enabled: !!venueId && !isSuperadmin && !isWhiteLabelEnabled,
    staleTime: 5 * 60 * 1000,
  })

  const venueTier = mapPlanTier(planState?.planTier)

  const hasFeatureAccess = useCallback(
    (feature: string): boolean => {
      if (isSuperadmin) return true
      if (isWhiteLabelEnabled) return canFeature(feature)
      if (isLoading && planState === undefined) return true // optimistic during load
      const required = getTierForFeature(feature) ?? 'PRO'
      return TIER_ORDER.indexOf(venueTier) >= TIER_ORDER.indexOf(required)
    },
    [isSuperadmin, isWhiteLabelEnabled, canFeature, isLoading, planState, venueTier],
  )

  return { venueTier, hasFeatureAccess, isLoading }
}
