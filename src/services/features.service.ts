import api from '@/api'
import { VenueFeature } from '@/types'

/**
 * Venue feature status response from backend
 */
export interface VenueFeatureStatus {
  venueId: string
  venueName: string
  hasStripeCustomer: boolean
  hasPaymentMethod: boolean
  paymentMethod: {
    brand: string
    last4: string
    expMonth: number
    expYear: number
  } | null
  activeFeatures: Array<{
    id: string
    venueId: string
    featureId: string
    feature: {
      id: string
      code: string
      name: string
      description: string
    }
    active: boolean
    monthlyPrice: number
    startDate: string
    endDate: string | null
    stripeSubscriptionId: string
    stripePriceId: string
    // Backend synthesizes premium features granted by the venue's base plan into
    // activeFeatures with this flag set and NO real VenueFeature row. The UI must NOT
    // offer "Cancel" on these — there's nothing to cancel, and removeVenueFeature would 404.
    grantedByBasePlan?: boolean
  }>
  availableFeatures: Array<{
    id: string
    code: string
    name: string
    description: string
    monthlyPrice: number
    stripeProductId: string
    stripePriceId: string
    hadPreviously: boolean // NEW: Indicates if feature was previously used (no trial for returning users)
  }>
}

/**
 * Stripe invoice object
 */
export interface StripeInvoice {
  id: string
  number: string
  created: number
  amount_due: number
  currency: string
  status: 'paid' | 'open' | 'draft' | 'uncollectible' | 'void'
  description: string | null
  invoice_pdf: string
  hosted_invoice_url: string | null
}

/**
 * Get all features for a venue (returns full status including available features)
 */
export const getVenueFeatures = async (venueId: string): Promise<VenueFeatureStatus> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/features`)
  // Backend wraps in { success: true, data: { venueId, activeFeatures, availableFeatures } }
  return response.data.data
}

/**
 * Get billing portal URL for a venue
 */
export const getBillingPortalUrl = async (venueId: string): Promise<{ url: string }> => {
  const response = await api.post(`/api/v1/dashboard/venues/${venueId}/billing-portal`, {
    returnUrl: window.location.href, // Return to current page after managing billing
  })
  return response.data
}

/**
 * Add features to a venue with trial period
 */
export interface AddFeaturesRequest {
  featureCodes: string[]
  trialPeriodDays?: number
}

export const addVenueFeatures = async (venueId: string, data: AddFeaturesRequest): Promise<VenueFeature[]> => {
  const response = await api.post(`/api/v1/dashboard/venues/${venueId}/features`, data)
  return response.data
}

/**
 * Remove a feature from a venue
 */
export const removeVenueFeature = async (venueId: string, featureId: string): Promise<void> => {
  await api.delete(`/api/v1/dashboard/venues/${venueId}/features/${featureId}`)
}

/**
 * Get Stripe invoices for a venue
 */
export const getVenueInvoices = async (venueId: string): Promise<StripeInvoice[]> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/invoices`)
  return response.data.data.invoices || []
}

/**
 * Download a Stripe invoice PDF
 * Opens Stripe's hosted PDF in a new window/tab
 */
export const downloadInvoice = async (venueId: string, invoiceId: string): Promise<void> => {
  // Open download URL in new window - backend will redirect to Stripe's hosted PDF
  const downloadUrl = `${api.defaults.baseURL}/api/v1/dashboard/venues/${venueId}/invoices/${invoiceId}/download`
  window.open(downloadUrl, '_blank')
}

/**
 * Base-plan (PLAN_PRO) lifecycle state — GET /dashboard/venues/:venueId/plan.
 * Mirrors the backend PlanState shape exactly (planState.service.ts).
 */
export interface PlanState {
  hasPlan: boolean
  state: 'none' | 'trial' | 'active' | 'canceling' | 'past_due' | 'suspended' | 'canceled'
  planTier: 'GRATIS' | 'PRO' | 'PREMIUM' | 'ENTERPRISE' | null
  planName: string | null
  interval: 'month' | 'year' | null
  price: { base: number; gross: number; currency: 'MXN' } | null
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  suspendedAt: string | null
  gracePeriodEndsAt: string | null
  paymentMethod: { brand: string; last4: string; expMonth: number; expYear: number } | null
  stripeSubscriptionId: string | null
  /**
   * Whether the venue is eligible to be shown the retention discount/pause OFFER
   * during cancellation. True only when the subscription has ≥30-day tenure and
   * no active discount (anti-abuse: a brand-new subscriber can't buy → cancel →
   * farm the discount). When false, the cancel dialog skips the offer step.
   */
  retentionOfferEligible: boolean
  /**
   * Legacy venue exempt from ALL tier monetization (no paywalls, no seat cap).
   * A grandfathered venue operates exactly as it did before plan tiers existed.
   */
  grandfathered: boolean
}

/** Get the venue's base-plan state. */
export const getVenuePlan = async (venueId: string): Promise<PlanState> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/plan`)
  return response.data.data
}

/** Schedule cancellation of the base plan at period end. Returns the updated state. */
export const cancelVenuePlan = async (venueId: string): Promise<PlanState> => {
  const response = await api.post(`/api/v1/dashboard/venues/${venueId}/plan/cancel`)
  return response.data.data
}

/** Undo a scheduled base-plan cancellation. Returns the updated state. */
export const reactivateVenuePlan = async (venueId: string): Promise<PlanState> => {
  const response = await api.post(`/api/v1/dashboard/venues/${venueId}/plan/reactivate`)
  return response.data.data
}

/** Apply a retention offer (discount or pause) to prevent cancellation. */
export const applyRetentionOffer = async (venueId: string, offer: 'discount' | 'pause'): Promise<void> => {
  await api.post(`/api/v1/dashboard/venues/${venueId}/plan/retention-offer`, { offer })
}

/**
 * Create a Stripe hosted checkout session for upgrading to a base plan.
 * Returns the Stripe checkout URL to redirect the browser to.
 * The endpoint returns flat { success: true, url: <stripe-checkout-url> }.
 */
export const createPlanCheckoutSession = async (
  venueId: string,
  tier: 'PRO' | 'PREMIUM',
  interval: 'monthly' | 'annual',
): Promise<string> => {
  const res = await api.post(`/api/v1/dashboard/venues/${venueId}/plan/checkout`, { tier, interval })
  return res.data.url as string
}

// ─── Free-plan seat cap ──────────────────────────────────────────────────────

/**
 * Seat-cap status for a venue. Drives the proactive "Invite teammate" paywall.
 * - `cap = null` → unlimited seats (paid or exempt venue).
 * - `allowed = false` → Free venue at the seat cap (and NOT exempt) → invites must
 *   be blocked and the user upsold to Pro.
 */
export interface SeatStatus {
  cap: number | null
  current: number
  allowed: boolean
  exempt: boolean
}

/**
 * A cap-counting StaffVenue row in the Pro→Free downgrade "choose who stays" roster.
 * `isOwner = true` is the venue owner — must always be kept (pre-selected + locked).
 */
export interface DowngradeStaffRow {
  staffVenueId: string
  staffId: string
  name: string
  email: string
  role: string
  isOwner: boolean
  lastActiveAt: string | null
}

/**
 * Preview of what a downgrade to Free implies. `required = true` means the venue has
 * more active users than Free allows → the owner MUST pick who stays before downgrading.
 */
export interface DowngradePreview {
  required: boolean
  cap: number
  currentActive: number
  keepMax: number
  staff: DowngradeStaffRow[]
}

/** Get the venue's seat-cap status (drives the invite paywall). */
export const getVenueSeatStatus = async (venueId: string): Promise<SeatStatus> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/plan/seat-status`)
  return response.data.data
}

/** Get the Pro→Free downgrade preview (who stays / who gets deactivated). */
export const getDowngradePreview = async (venueId: string): Promise<DowngradePreview> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/plan/downgrade-preview`)
  return response.data.data
}

/**
 * Schedule a downgrade to the Free plan at period end. `keepStaffVenueIds` is the set
 * of active cap-counting StaffVenue ids to keep — must include the OWNER and be ≤ keepMax.
 * Pass an empty array when already under cap. Returns the updated PlanState.
 */
export const downgradeVenueToFree = async (venueId: string, keepStaffVenueIds: string[]): Promise<PlanState> => {
  const response = await api.post(`/api/v1/dashboard/venues/${venueId}/plan/downgrade`, { keepStaffVenueIds })
  return response.data.data
}
