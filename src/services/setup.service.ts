/**
 * Setup Service
 *
 * API client for the V2 setup wizard (Square-style onboarding).
 */

import api from '@/api'

export interface TermsAcceptance {
  termsAccepted: boolean
  privacyAccepted: boolean
  termsVersion: string
}

export const setupService = {
  /** Get current user's onboarding status (includes org ID + v2 setup data) */
  getStatus: () => api.get('/api/v1/onboarding/status'),

  /** Save a single setup step */
  saveStep: (orgId: string, step: number, data: Record<string, any>) =>
    api.put(`/api/v1/onboarding/organizations/${orgId}/v2/step/${step}`, data),

  /** Record terms & privacy acceptance */
  acceptTerms: (orgId: string, data: TermsAcceptance) => api.post(`/api/v1/onboarding/organizations/${orgId}/v2/accept-terms`, data),

  /** Finalize setup and create venue. `language` is the wizard locale, persisted onto the venue for transactional emails. */
  completeSetup: (orgId: string, language?: 'es' | 'en') => api.post(`/api/v1/onboarding/organizations/${orgId}/v2/complete`, { language }),

  /** Get current onboarding progress (shared with v1) */
  getProgress: (orgId: string) => api.get(`/api/v1/onboarding/organizations/${orgId}/progress`),

  /** Start/initialize onboarding progress */
  startOnboarding: (orgId: string) => api.post(`/api/v1/onboarding/organizations/${orgId}/start`),

  /**
   * Generate a real test payment link via the venue's connected MP/Stripe merchant.
   * Wizard-only — backend route returns 404 when the env flag is off.
   */
  testPaymentLink: (venueId: string, body: { amount: number; providerCode: 'MERCADO_PAGO' | 'STRIPE' }) =>
    api.post(`/api/v1/onboarding/venues/${venueId}/test-payment-link`, body),

  /** Get a customer-scoped Stripe SetupIntent client_secret for the plan step. */
  planSetupIntent: (venueId: string) => api.post(`/api/v1/onboarding/venues/${venueId}/plan-setup-intent`),
}
