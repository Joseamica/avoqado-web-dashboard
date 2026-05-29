/**
 * Referral program types - mirror of backend ReferralProgramConfig / Referral models.
 * Used by referrals.service.ts and Referrals UI pages.
 */

export type ReferralStatus = 'PENDING' | 'QUALIFIED' | 'VOID'
export type ReferralTier = 'TIER_1' | 'TIER_2' | 'TIER_3'

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
}

export interface ActivateReferralProgramRequest {
  newCustomerDiscountPercent: number
  tier1ReferralsRequired: number
  tier1RewardPercent: number
  tier2ReferralsRequired: number
  tier2RewardPercent: number
  tier3ReferralsRequired: number
  tier3RewardPercent: number
  rewardCouponExpiryDays: number
  codePrefix?: string
}

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
  rewardDiscount: { id: string; value: number; active: boolean } | null
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
