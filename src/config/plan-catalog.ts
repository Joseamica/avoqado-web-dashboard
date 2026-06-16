// src/config/plan-catalog.ts
import type { LucideIcon } from 'lucide-react'
import { Sparkles, Star, Crown, Building2 } from 'lucide-react'

export type TierId = 'FREE' | 'PRO' | 'PREMIUM' | 'ENTERPRISE'
export const TIER_ORDER: TierId[] = ['FREE', 'PRO', 'PREMIUM', 'ENTERPRISE']

/** How the upgrade CTA behaves in Fase A. Fase B flips PREMIUM → 'self_serve'. */
export type CheckoutMode = 'current' | 'self_serve' | 'coming_soon' | 'contact'

export interface PlanTierDef {
  id: TierId
  /** i18n key suffix under billing `plan.tiers.<key>` (name, pitch). */
  key: string
  icon: LucideIcon
  /** CSS var name for the accent color (defined in component). */
  accent: 'free' | 'pro' | 'premium' | 'enterprise'
  popular?: boolean
  priceMonthly: number | null // MXN, ex-IVA. null = "a la medida"
  priceAnnual: number | null // MXN/yr, ex-IVA
  checkout: CheckoutMode
  /** i18n key suffixes under billing `plan.features.<code>` shown as the card's checklist. */
  featureKeys: string[]
  /** Feature CODES this tier unlocks (display-side tier→capability map; Fase B makes it authoritative). */
  includes: string[]
}

/**
 * Display-side tier → capability map. Mirrors the spec's section 5.
 * Source of truth for BOTH the plan cards and `getTierForFeature()` (FeatureGate CTA).
 * NOTE: backend access is still authoritative; this only drives presentation in Fase A.
 */
export const PLAN_TIERS: PlanTierDef[] = [
  {
    id: 'FREE',
    key: 'free',
    icon: Sparkles,
    accent: 'free',
    priceMonthly: 0,
    priceAnnual: 0,
    checkout: 'current',
    featureKeys: ['pos', 'menuOrders', 'inventoryBasic', 'dailyReports', 'chatbotBeta', 'seats2'],
    includes: ['AVAILABLE_BALANCE', 'CHATBOT'],
  },
  {
    id: 'PRO',
    key: 'pro',
    icon: Star,
    accent: 'pro',
    popular: true,
    priceMonthly: 999,
    priceAnnual: 9990,
    checkout: 'self_serve',
    featureKeys: ['allFree', 'reportsHistory', 'aiMcp', 'loyaltyReferrals', 'reservationsOrdering', 'seatsUnlimited'],
    includes: [
      'ADVANCED_REPORTS',
      'AI_ASSISTANT_BUBBLE',
      'LOYALTY_PROGRAM',
      'REFERRAL_PROGRAM',
      'PROMOTIONS',
      'RESERVATIONS',
      'ONLINE_ORDERING',
      'BANK_RECONCILIATION',
    ],
  },
  {
    id: 'PREMIUM',
    key: 'premium',
    icon: Crown,
    accent: 'premium',
    priceMonthly: 1699,
    priceAnnual: 16990,
    checkout: 'self_serve', // Premium purchasable — Stripe product seeded (plan_premium_*)
    featureKeys: ['allPro', 'cfdi', 'inventoryFifo', 'predictiveAnalytics', 'multiVenue', 'prioritySupport'],
    includes: ['CFDI', 'INVENTORY_TRACKING', 'ADVANCED_ANALYTICS', 'COMMISSIONS', 'ATTENDANCE_TRACKING', 'SERIALIZED_INVENTORY', 'AUTO_REORDER', 'TRANSACTION_EXPORT'],
  },
  {
    id: 'ENTERPRISE',
    key: 'enterprise',
    icon: Building2,
    accent: 'enterprise',
    priceMonthly: null,
    priceAnnual: null,
    checkout: 'contact',
    featureKeys: ['allPremium', 'whiteLabel', 'apiIntegrations', 'slaSupport'],
    includes: ['WHITE_LABEL_DASHBOARD'],
  },
]

/** Maps backend `PlanState.planTier` values (incl. legacy 'GRATIS' / null) to a catalog {@link TierId}. */
export function mapPlanTier(planTier: string | null | undefined): TierId {
  if (!planTier) return 'FREE'
  if (planTier === 'GRATIS') return 'FREE'
  if (TIER_ORDER.includes(planTier as TierId)) return planTier as TierId
  return 'FREE'
}

const tierRank = (id: TierId) => TIER_ORDER.indexOf(id)

/** Lowest tier whose `includes` contains the feature code, or null. */
export function getTierForFeature(code: string): TierId | null {
  const owners = PLAN_TIERS.filter(t => t.includes.includes(code))
  if (owners.length === 0) return null
  return owners.sort((a, b) => tierRank(a.id) - tierRank(b.id))[0].id
}

export const getTierDef = (id: TierId) => PLAN_TIERS.find(t => t.id === id)!

/**
 * Sales WhatsApp for assisted/Enterprise plans — the business number published on
 * avoqado.io (wa.me/525640070001). Single source so every "contact sales" CTA agrees.
 */
export const SALES_WHATSAPP_NUMBER = '525640070001'

/** wa.me deep link with a pre-filled message (sales conversations are in Spanish). */
export const salesWhatsAppLink = (message: string) =>
  `https://wa.me/${SALES_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
