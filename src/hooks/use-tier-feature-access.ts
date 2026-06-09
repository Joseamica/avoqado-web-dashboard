import { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAccess } from '@/hooks/use-access'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { getTierForFeature, TIER_ORDER, type TierId } from '@/config/plan-catalog'
import { getVenuePlan, getVenueFeatures } from '@/services/features.service'

/** Maps backend PlanState.planTier values to the catalog TierId values. */
function mapPlanTier(planTier: string | null | undefined): TierId {
  if (!planTier) return 'FREE'
  if (planTier === 'GRATIS') return 'FREE'
  if (TIER_ORDER.includes(planTier as TierId)) return planTier as TierId
  return 'FREE'
}

export interface TierFeatureAccess {
  /** True when the venue may use the feature (explicit grant, tier covers it, or superadmin / white-label). */
  hasAccess: boolean
  /** The minimum tier that unlocks the feature (for upsell UI). */
  requiredTier: TierId
  /** True while plan/feature data is still loading (callers may render optimistically). */
  isLoading: boolean
}

/**
 * Tier + grant aware feature access for the CURRENT venue. Fetches the plan tier AND the venue's
 * active features once, and returns a `hasFeatureAccess(code)` checker. Mirrors the backend
 * `venueHasFeatureAccess`:
 *   access = superadmin
 *          OR white-label feature toggle (canFeature)
 *          OR the venue has an EXPLICIT active grant for the feature (à-la-carte / grandfathered)
 *          OR the venue's plan tier rank >= the feature's required tier rank.
 *
 * Why this exists: `useAccess().canFeature` / `useAuth().checkFeatureAccess` short-circuit to `true`
 * for every non-white-label venue, so they can't gate normal venues by tier — and a pure tier check
 * would wrongly paywall grandfathered à-la-carte grants. This hook handles both.
 */
export function useVenueTier(): { venueTier: TierId; hasFeatureAccess: (feature: string) => boolean; isLoading: boolean } {
  const { canFeature, role, isWhiteLabelEnabled } = useAccess()
  const { venueId } = useCurrentVenue()

  const isSuperadmin = role === 'SUPERADMIN'
  const gateEnabled = !!venueId && !isSuperadmin && !isWhiteLabelEnabled

  const { data: planState, isLoading: planLoading } = useQuery({
    queryKey: ['venuePlan', venueId],
    queryFn: () => getVenuePlan(venueId!),
    enabled: gateEnabled,
    staleTime: 5 * 60 * 1000,
  })

  // Explicit grants: a venue's OWN active feature (à-la-carte or grandfathered) always unlocks it,
  // regardless of base plan tier — matches the backend's "explicit grant wins" rule.
  const { data: featureStatus, isLoading: featLoading } = useQuery({
    queryKey: ['venueFeatures', venueId],
    queryFn: () => getVenueFeatures(venueId!),
    enabled: gateEnabled,
    staleTime: 5 * 60 * 1000,
  })

  const grantedCodes = useMemo(
    () => new Set((featureStatus?.activeFeatures ?? []).map(f => f.feature.code)),
    [featureStatus],
  )

  const venueTier = mapPlanTier(planState?.planTier)
  const isLoading = planLoading || featLoading

  const hasFeatureAccess = useCallback(
    (feature: string): boolean => {
      if (isSuperadmin) return true
      if (isWhiteLabelEnabled) return canFeature(feature)
      // Optimistic while the first load is in flight (avoid a paywall flash on entitled venues).
      if (isLoading && planState === undefined && featureStatus === undefined) return true
      if (grantedCodes.has(feature)) return true // explicit / grandfathered grant wins
      const required = getTierForFeature(feature) ?? 'PRO'
      return TIER_ORDER.indexOf(venueTier) >= TIER_ORDER.indexOf(required)
    },
    [isSuperadmin, isWhiteLabelEnabled, canFeature, isLoading, planState, featureStatus, grantedCodes, venueTier],
  )

  return { venueTier, hasFeatureAccess, isLoading }
}

/** Single-feature convenience wrapper around {@link useVenueTier}. */
export function useTierFeatureAccess(feature: string, requiredTierOverride?: TierId): TierFeatureAccess {
  const { hasFeatureAccess, isLoading } = useVenueTier()
  const requiredTier = useMemo(
    () => requiredTierOverride ?? getTierForFeature(feature) ?? 'PRO',
    [requiredTierOverride, feature],
  )
  return { hasAccess: hasFeatureAccess(feature), requiredTier, isLoading }
}
