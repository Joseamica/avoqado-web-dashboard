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
  acceptTerms: (orgId: string, data: TermsAcceptance) =>
    api.post(`/api/v1/onboarding/organizations/${orgId}/v2/accept-terms`, data),

  /** Finalize setup and create venue */
  completeSetup: (orgId: string) =>
    api.post(`/api/v1/onboarding/organizations/${orgId}/v2/complete`),

  /** Get current onboarding progress (shared with v1) */
  getProgress: (orgId: string) =>
    api.get(`/api/v1/onboarding/organizations/${orgId}/progress`),

  /** Start/initialize onboarding progress */
  startOnboarding: (orgId: string) =>
    api.post(`/api/v1/onboarding/organizations/${orgId}/start`),
}
