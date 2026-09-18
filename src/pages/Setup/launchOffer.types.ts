/**
 * Formas del contrato de campañas ligeras (§3.3, §3.6 y §4.5 del spec). Se copian TAL CUAL del
 * contrato congelado del servidor.
 *
 * 🔴 Regla dura de este archivo: el dinero viaja en CENTAVOS ENTEROS con IVA incluido, y el
 * dashboard NUNCA lo calcula. Todo lo que se pinta sale de aquí; lo único que hace el dashboard
 * es formatear. Por eso no hay ninguna constante de precio en el dashboard.
 */

export type LaunchOfferUnavailableReason = 'NOT_STARTED' | 'EXPIRED' | 'PAUSED' | 'ENDED' | 'SOLD_OUT' | 'NOT_PUBLISHED'

export interface LaunchOfferView {
  code: string
  slug: string
  offerVersion: number
  vertical: 'ALL' | 'FOOD_SERVICE' | 'RETAIL' | 'SERVICES' | 'HOSPITALITY' | 'ENTERTAINMENT'
  planTier: 'PRO' | 'PREMIUM'
  planName: string
  available: true
  currency: 'MXN'
  ivaIncluded: true
  requiresCard: true
  promo: { monthlyCents: number; months: number; subtotalCents: number; ivaCents: number; periodTotalCents: number }
  renewal: { monthlyCents: number; subtotalCents: number; ivaCents: number }
  firstChargeCents: number
  validUntil: string
  limited: true
  copy: { headline: string | null; subheadline: string | null; bullets: string[] }
}

export interface LaunchOfferUnavailableView {
  code: string
  slug: string
  available: false
  unavailableReason: LaunchOfferUnavailableReason
}

export type LaunchOfferState = LaunchOfferView | LaunchOfferUnavailableView

export function isOfferAvailable(offer: LaunchOfferState | null | undefined): offer is LaunchOfferView {
  return !!offer && offer.available === true
}

/** Precios estándar que publica el servidor en `GET progress` (§4.5). Todos con IVA. */
export interface PlanQuoteTier {
  monthlyCents: number
  annualCents: number
  intro: { monthlyCents: number; months: number; interval: 'monthly'; requiresPayNow: boolean } | null
}

export interface PlanQuote {
  currency: 'MXN'
  ivaIncluded: true
  trialDays: number
  tiers: { PRO: PlanQuoteTier; PREMIUM: PlanQuoteTier }
}

export interface PlanActivationState {
  status: 'NONE' | 'IN_PROGRESS' | 'ACTIVE' | 'DECLINED'
  attempt: number
  activatedAt: string | null
}

export interface LegalState {
  currentVersion: string
  acceptedVersion: string | null
  consentRequired: boolean
}

export interface OnboardingFeatureFlags {
  requiresBaseSubscriptionPlan?: boolean
  shortOnboarding?: boolean
}

/** Cuerpo de `POST …/v2/activate-plan` (§3.6). Discriminado por `offer.kind`. */
export type ActivatePlanOffer =
  | { kind: 'LAUNCH'; code: string; offerVersion: number; expectedFirstChargeCents: number }
  | { kind: 'STANDARD'; expectedFirstChargeCents: number }

export interface ActivatePlanBody {
  tier: 'PRO' | 'PREMIUM'
  interval: 'monthly' | 'annual'
  payNow: boolean
  paymentMethodId: string
  offer: ActivatePlanOffer
  language?: 'es' | 'en'
}

export interface ActivatePlanResult {
  status: 'ACTIVE'
  alreadyActive: boolean
  tier: 'PRO' | 'PREMIUM'
  interval: 'monthly' | 'annual'
  firstChargeCents: number
  nextChargeAt: string
  launchOffer?: { code: string; offerVersion: number; months: number; renewalMonthlyCents: number }
}

/** Códigos de error de `activate-plan` que la pantalla trata de forma distinta (§4.5). */
export type ActivatePlanErrorCode =
  | 'PLAN_PAYMENT_DECLINED'
  | 'PLAN_ALREADY_ACTIVATED'
  | 'PLAN_ACTIVE_WITHOUT_OFFER'
  | 'LAUNCH_OFFER_UNAVAILABLE'
  | 'OFFER_CHANGED'
  | 'PLAN_ACTIVATION_IN_PROGRESS'
  | 'PLAN_ACTIVATION_PENDING'
  | 'PLAN_PRICE_MISMATCH'
  | 'PAYMENT_METHOD_MISMATCH'
  | 'LAUNCH_OFFER_NOT_APPLICABLE'
  | 'PLAN_VENUE_NOT_READY'
