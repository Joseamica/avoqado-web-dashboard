import { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAccess } from '@/hooks/use-access'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { getTierForFeature, TIER_ORDER, type TierId } from '@/config/plan-catalog'
import { getVenueFeatures, getVenuePlanTierInfo } from '@/services/features.service'
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
 *   3. fail-open: plan-tier signal not yet/ever determinable (loading OR request failed) → true
 *      (a UX-only gate must never hard-block on unknowable entitlement; backend is source of truth)
 *   4. exempt venue (grandfathered legacy OR demo) → true for EVERY feature — exempt from ALL tier
 *      monetization (no paywalls, no badges, no seat cap)
 *   5. EXPLICIT active grant for the feature (à-la-carte) → true
 *   6. venue's plan tier rank >= the feature's required tier rank.
 *
 * The tier + exempt signal comes from the all-roles `features:read` endpoint (GET /venues/:id/plan-tier),
 * NOT GET /plan (ADMIN/OWNER-only via billing:subscriptions:read) — so sub-ADMIN staff gate correctly.
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

  // Plan-tier gating signal (tier + grandfathered/exempt), readable by EVERY venue role via
  // `features:read`. This is the gate's source of truth: GET /plan is ADMIN/OWNER-only
  // (`billing:subscriptions:read`, returns price + Stripe ids), so sub-ADMIN staff
  // (MANAGER/CASHIER/WAITER/…) couldn't read grandfathered/tier and were wrongly paywalled.
  const { data: planTierInfo, isLoading: planLoading } = useQuery({
    queryKey: ['venuePlanTier', venueId],
    queryFn: () => getVenuePlanTierInfo(venueId!),
    enabled: gateEnabled,
    staleTime: 5 * 60 * 1000,
  })

  // Explicit à-la-carte grants: a venue's OWN active feature always unlocks it, regardless of base
  // plan tier — matches the backend's "explicit grant wins" rule. NOTE: this endpoint is still
  // ADMIN/OWNER-only, so for sub-ADMIN roles it 403s and grantedCodes is empty — they rely on the
  // tier/exempt signal above (à-la-carte-only grants are rare and being folded into tiers).
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

  const venueTier: TierId = planTierInfo?.tier ?? 'FREE'
  const isLoading = planLoading || featLoading

  const hasFeatureAccess = useCallback(
    (feature: string): boolean => {
      if (isSuperadmin) return true
      if (isDemoVenue) return true // demo venue: todo abierto (espejo del backend)
      if (isWhiteLabelEnabled) return canFeature(feature)
      // Fail-open when the plan-tier signal can't be POSITIVELY determined — it is undefined while
      // the first load is in flight AND if the request ever failed. A UX-only gate must NEVER
      // hard-block on unknowable entitlement (the backend is the source of truth and enforces the
      // genuinely-gated routes). planTierInfo comes from the all-roles `features:read` endpoint, so
      // sub-ADMIN staff (MANAGER/CASHIER/…) now read it too — fixing the prior bug where they were
      // wrongly paywalled (e.g. a Mindform MANAGER blocked from editing inventory) because the
      // grandfathered/tier signal lived behind a billing-only endpoint. Paywall ONLY on a positive
      // denial below (signal loaded, not exempt, tier insufficient, no explicit grant).
      if (planTierInfo === undefined) return true
      // Grandfathered legacy venue OR demo (exempt covers both) → exempt from ALL tier monetization.
      if (planTierInfo.exempt) return true
      if (grantedCodes.has(feature)) return true // explicit / à-la-carte grant wins
      const required = getTierForFeature(feature) ?? 'PRO'
      return TIER_ORDER.indexOf(venueTier) >= TIER_ORDER.indexOf(required)
    },
    [isSuperadmin, isDemoVenue, isWhiteLabelEnabled, canFeature, planTierInfo, grantedCodes, venueTier],
  )

  return { venueTier, hasFeatureAccess, isLoading }
}

/**
 * Display-only plan tier for ANY venue (not just the current one) — for badges in the venue switcher.
 * Unlike {@link useVenueTier} (which is gating-oriented and reports FREE for superadmin/white-label
 * because they bypass gates), this always reflects the venue's actual subscription tier.
 * Sources from the all-roles GET /plan-tier endpoint (features:read), NOT GET /plan
 * (billing:subscriptions:read — ADMIN/OWNER only) — otherwise the switcher tier badges 403 and
 * vanish for sub-ADMIN staff (MANAGER/CASHIER/…). Shares the `['venuePlanTier', venueId]` query
 * cache, so the active venue's badge reuses the gate's fetch.
 *
 * @param enabled gate the network call (e.g. only fetch list rows while the switcher popover is open).
 */
export function useVenuePlanTier(venueId: string | undefined, enabled = true): { tier: TierId | null; isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ['venuePlanTier', venueId],
    queryFn: () => getVenuePlanTierInfo(venueId!),
    enabled: enabled && !!venueId,
    staleTime: 5 * 60 * 1000,
  })
  return { tier: data ? data.tier : null, isLoading }
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
