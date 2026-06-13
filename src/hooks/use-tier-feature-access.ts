import { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAccess } from '@/hooks/use-access'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { getTierForFeature, mapPlanTier, TIER_ORDER, type TierId } from '@/config/plan-catalog'
import { getVenuePlan, getVenueFeatures } from '@/services/features.service'
import { isDemoVenueStatus } from '@/types/superadmin'

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
 * `venueHasFeatureAccess`. Path order (first match wins):
 *   1. superadmin → always true
 *   2. white-label → delegate to the feature toggle (canFeature)
 *   3. optimistic loading (first fetch in flight, no cached data) → true (no paywall flash)
 *   4. grandfathered venue (planState.grandfathered) → true for EVERY feature — legacy venues
 *      are exempt from ALL tier monetization (no paywalls, no badges, no seat cap)
 *   5. EXPLICIT active grant for the feature (à-la-carte) → true
 *   6. venue's plan tier rank >= the feature's required tier rank.
 *
 * Why this exists: `useAccess().canFeature` / `useAuth().checkFeatureAccess` short-circuit to `true`
 * for every non-white-label venue, so they can't gate normal venues by tier — and a pure tier check
 * would wrongly paywall grandfathered à-la-carte grants. This hook handles both.
 */
export function useVenueTier(): { venueTier: TierId; hasFeatureAccess: (feature: string) => boolean; isLoading: boolean } {
  const { canFeature, role, isWhiteLabelEnabled } = useAccess()
  const { venueId, venue } = useCurrentVenue()

  const isSuperadmin = role === 'SUPERADMIN'
  // Demo venues (LIVE_DEMO / TRIAL) get EVERYTHING open — mirrors the backend
  // `venueIsExemptFromPlanGating` bypass (same signal the KYC bypass uses).
  // A paywall inside the live demo kills the "pruébalo todo" promise.
  const isDemoVenue = isDemoVenueStatus(venue?.status)
  const gateEnabled = !!venueId && !isSuperadmin && !isWhiteLabelEnabled && !isDemoVenue

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

  // Only REAL own grants (à-la-carte / grandfathered) count here — NOT base-plan-granted synthetic
  // features. Those are handled by the tier check below; counting them would bypass tiering (and the
  // backend's basePlanGranted list isn't tier-aware yet, so it wrongly includes Premium-only codes).
  const grantedCodes = useMemo(
    () => new Set((featureStatus?.activeFeatures ?? []).filter(f => !f.grantedByBasePlan).map(f => f.feature.code)),
    [featureStatus],
  )

  const venueTier = mapPlanTier(planState?.planTier)
  const isLoading = planLoading || featLoading

  const hasFeatureAccess = useCallback(
    (feature: string): boolean => {
      if (isSuperadmin) return true
      if (isDemoVenue) return true // demo venue: todo abierto (espejo del backend)
      if (isWhiteLabelEnabled) return canFeature(feature)
      // Fail-open when the plan state can't be POSITIVELY determined. planState carries the
      // `grandfathered` flag + the tier, and is undefined both while the first load is in flight
      // AND when the caller's role can't read it: GET /venues/:id/plan requires
      // `billing:subscriptions:read`, which only ADMIN/OWNER hold — so for MANAGER/CASHIER/WAITER/…
      // the request 403s, planState stays undefined, and the grandfathered/tier signal is lost.
      // A UX-only gate must NEVER hard-block on unknowable entitlement (the backend is the source
      // of truth and enforces the genuinely-gated routes). Without this, every sub-ADMIN staff
      // member at a grandfathered OR paid venue is wrongly paywalled (e.g. a Mindform MANAGER
      // blocked from editing inventory). Paywall ONLY on a positive denial below (planState loaded,
      // not grandfathered, tier insufficient, no explicit grant).
      if (planState === undefined) return true
      // Grandfathered legacy venue → exempt from ALL tier monetization: every feature unlocked.
      if (planState.grandfathered) return true
      if (grantedCodes.has(feature)) return true // explicit / à-la-carte grant wins
      const required = getTierForFeature(feature) ?? 'PRO'
      return TIER_ORDER.indexOf(venueTier) >= TIER_ORDER.indexOf(required)
    },
    [isSuperadmin, isDemoVenue, isWhiteLabelEnabled, canFeature, planState, grantedCodes, venueTier],
  )

  return { venueTier, hasFeatureAccess, isLoading }
}

/**
 * Display-only plan tier for ANY venue (not just the current one) — for badges in the venue switcher.
 * Unlike {@link useVenueTier} (which is gating-oriented and reports FREE for superadmin/white-label
 * because they bypass gates), this always reflects the venue's actual subscription tier.
 * Shares the `['venuePlan', venueId]` query cache, so the active venue's badge reuses the gate's fetch.
 *
 * @param enabled gate the network call (e.g. only fetch list rows while the switcher popover is open).
 */
export function useVenuePlanTier(venueId: string | undefined, enabled = true): { tier: TierId | null; isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ['venuePlan', venueId],
    queryFn: () => getVenuePlan(venueId!),
    enabled: enabled && !!venueId,
    staleTime: 5 * 60 * 1000,
  })
  return { tier: data ? mapPlanTier(data.planTier) : null, isLoading }
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
