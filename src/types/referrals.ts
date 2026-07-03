/**
 * Referral program types - mirror of backend ReferralProgramConfig / Referral models.
 * Used by referrals.service.ts and Referrals UI pages.
 */

export type ReferralStatus = 'PENDING' | 'QUALIFIED' | 'VOID'
export type ReferralTier = 'TIER_1' | 'TIER_2' | 'TIER_3'

// ==================== EXTENSION (Configurable tier rewards — avoqado-server develop) ====================
// Mirror of Prisma enums `ReferralRewardType` / `ReferralRewardRecurrence` / `ReferralGrantStatus`
// (avoqado-server prisma/schema.prisma:10644-10661).

/** Reward kind for a tier. PERMANENT_DISCOUNT is UI-disabled (TPV can't auto-apply it yet) but the type exists server-side. */
export type ReferralRewardType = 'PERCENT_COUPON' | 'PERMANENT_DISCOUNT' | 'FREE_PRODUCT'
export type ReferralRewardRecurrence = 'ONE_TIME' | 'MONTHLY'
export type ReferralGrantStatus = 'ISSUED' | 'REDEEMED' | 'REVOKED' | 'MANUAL_PENDING' | 'MANUAL_FULFILLED'

/**
 * A single per-tier reward row, as returned inside `ReferralProgramConfig.tierRewards`
 * (`GET /referrals/config` — only `active: true` rows, ordered by `tierLevel` asc).
 * `rewardPercent` arrives as a string when present — Prisma `Decimal` serializes to
 * a numeric string over JSON, never assume it's already a `number`.
 */
export interface TierReward {
  id: string
  configId: string
  tierLevel: number // 1 | 2 | 3
  rewardType: ReferralRewardType
  recurrence: ReferralRewardRecurrence
  rewardPercent: string | number | null
  rewardProductId: string | null
  rewardQuantity: number
  active: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Write payload for one tier's reward(s) — sent inside `tiers[]` on
 * `PATCH /referrals/config` and `POST /referrals/activate`. Mirrors
 * `TierRewardInput` (avoqado-server `referralProgram.service.ts`).
 */
export interface TierRewardInput {
  tierLevel: 1 | 2 | 3
  rewardType: ReferralRewardType
  recurrence?: ReferralRewardRecurrence
  rewardPercent?: number
  rewardProductId?: string
  rewardQuantity?: number
}

/**
 * Slim reward-grant view embedded per referral row in
 * `GET /referrals/customers/:customerId/referrals` (`ReferralRecord.rewards[]`).
 */
export interface ReferralRewardGrantView {
  id: string
  rewardType: ReferralRewardType
  rewardPercent: string | number | null
  rewardProductId: string | null
  rewardQuantity: number
  status: ReferralGrantStatus
  couponCode: string | null
}

/**
 * Full `ReferralRewardGrant` row — returned by
 * `POST /referrals/grants/:grantId/fulfill` (the updated grant after marking
 * a MANUAL_PENDING FREE_PRODUCT courtesy as MANUAL_FULFILLED).
 */
export interface ReferralRewardGrant {
  id: string
  venueId: string
  customerId: string
  tierLevel: number
  referralId: string | null
  tierRewardId: string
  rewardType: ReferralRewardType
  rewardPercent: string | number | null
  rewardProductId: string | null
  rewardQuantity: number
  discountId: string | null
  couponCodeId: string | null
  status: ReferralGrantStatus
  revokedAt: string | null
  revokeReason: string | null
  fulfilledAt: string | null
  fulfilledByStaffVenueId: string | null
  createdAt: string
  updatedAt: string
}

export interface ReferralProgramConfig {
  id?: string
  venueId?: string
  active: boolean
  activatedAt?: string | null
  newCustomerDiscountPercent?: number
  tier1ReferralsRequired?: number
  tier1RewardPercent?: number
  tier2ReferralsRequired?: number
  tier2RewardPercent?: number
  tier3ReferralsRequired?: number
  tier3RewardPercent?: number
  rewardCouponExpiryDays?: number
  codePrefix?: string | null
  welcomeMessageTemplate?: string | null
  tierUpMessageTemplate?: string | null
  /**
   * Per-tier reward configuration (only `active: true` rows). Source of truth
   * going forward — the flat `tier{N}RewardPercent` fields above are DEPRECATED
   * but still present for callers not yet migrated. OPTIONAL: a venue on an
   * older backend deploy won't send this field at all — always fall back to
   * the legacy flat fields when `tierRewards` is missing/empty.
   */
  tierRewards?: TierReward[]
}

export interface ActivateReferralProgramRequest {
  newCustomerDiscountPercent: number
  tier1ReferralsRequired: number
  tier2ReferralsRequired: number
  tier3ReferralsRequired: number
  rewardCouponExpiryDays: number
  codePrefix?: string
  /**
   * @deprecated The backend's activate Zod schema never required these flat
   * per-tier percent fields (only the TS interface used to carry them) — it
   * strips any unrecognized keys. Per-tier rewards are configured via `tiers`
   * below. Kept optional here only so old call sites that still pass them
   * don't break; new code should omit them and send `tiers` instead.
   */
  tier1RewardPercent?: number
  /** @deprecated see `tier1RewardPercent` */
  tier2RewardPercent?: number
  /** @deprecated see `tier1RewardPercent` */
  tier3RewardPercent?: number
  /** Per-tier reward config — same shape accepted by PATCH /config. Omit/empty leaves defaults. */
  tiers?: TierRewardInput[]
}

/**
 * Partial body for `PATCH /referrals/config` — every scalar field is optional
 * (partial update); `tiers`, when present, versions ONLY the tier levels it lists.
 */
export type UpdateReferralConfigRequest = Partial<ActivateReferralProgramRequest>

export interface ReferralSummary {
  referralsThisMonth: number
  referralsPrevMonth: number
  conversionRate: number
  qualifiedThisMonth: number
  pendingThisMonth: number
  couponsEmittedThisMonth: number
  topReferrer: {
    id: string
    firstName: string | null
    lastName: string | null
    referralCount: number
    referralTier: ReferralTier | null
  } | null
}

// ==================== EXTENSION (Plan 2 — Dashboard UI) ====================

export interface HallOfFameEntry {
  id: string
  firstName: string | null
  lastName: string | null
  referralCount: number
  referralTier: ReferralTier | null
  tierUnlockedAt: string | null
}

export interface ReferralRecord {
  id: string
  status: ReferralStatus
  createdAt: string
  qualifiedAt: string | null
  voidedAt: string | null
  forcedOverride: boolean
  referrerCustomer: {
    id: string
    firstName: string | null
    lastName: string | null
    referralTier: ReferralTier | null
  }
  referredCustomer: {
    id: string
    firstName: string | null
    lastName: string | null
  }
  /** @deprecated Superseded by `rewards[]` below. Still present for backward compat. */
  rewardDiscount: { id: string; value: number; active: boolean } | null
  /**
   * OPTIONAL — a venue on an older backend deploy won't send this field.
   * Fall back to `rewardDiscount` above when missing/empty. Only populated
   * on `GET /referrals/customers/:customerId/referrals` rows (not on the
   * paginated `GET /referrals` list).
   */
  rewards?: ReferralRewardGrantView[]
}

export interface ListReferralsParams {
  status?: ReferralStatus
  tier?: ReferralTier
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
}

export interface PaginatedReferrals {
  items: ReferralRecord[]
  total: number
  page: number
  pageSize: number
}
