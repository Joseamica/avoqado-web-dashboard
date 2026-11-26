/**
 * Setup Service
 *
 * API client for the V2 setup wizard (Square-style onboarding).
 */

import api from '@/api'
import type { ActivatePlanBody, ActivatePlanSinTarjetaBody, RetomaDelPago, TarjetaDeLaPrueba } from '@/pages/Setup/launchOffer.types'

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
  startOnboarding: (orgId: string) => api.post(`/api/v1/onboarding/organizations/${orgId}/start`, undefined, { repetible: true }),

  /**
   * Generate a real test payment link via the venue's connected MP/Stripe merchant.
   * Wizard-only — backend route returns 404 when the env flag is off.
   */
  testPaymentLink: (venueId: string, body: { amount: number; providerCode: 'MERCADO_PAGO' | 'STRIPE' }) =>
    api.post(`/api/v1/onboarding/venues/${venueId}/test-payment-link`, body),

  /** Get a customer-scoped Stripe SetupIntent client_secret for the plan step. */
  planSetupIntent: (venueId: string) => api.post(`/api/v1/onboarding/venues/${venueId}/plan-setup-intent`),

  /**
   * Cobra el plan ANTES de terminar el alta (§3.6). Es la AUTORIDAD del cobro: `PUT step/10` es
   * solo un respaldo, y 🔴 solo se escribe DESPUÉS de un 200 de aquí — escribirlo tras un rechazo
   * dejaría `v2SetupData.plan` listo para que el camino legacy cobrara a precio de lista.
   *
   * El dinero que se manda (`offer.expectedFirstChargeCents`) es evidencia de lo que la persona
   * VIO y consintió; el servidor lo compara con su propia cotización y rechaza si no coincide.
   * Nunca se calcula en el navegador.
   */
  activatePlan: (orgId: string, body: ActivatePlanBody | ActivatePlanSinTarjetaBody) =>
    api.post(`/api/v1/onboarding/organizations/${orgId}/v2/activate-plan`, body),

  /**
   * Planes editables (B2, §18): qué tarjeta cobraría Stripe al terminar la prueba SIN tarjeta, leída en ESE momento (la
   * ventana la pide al abrirse, nunca de un `progress` anterior). Sólo informa: nada se compara al cobrar. `{ tarjeta: null }`
   * sólo es «no hay tarjeta»; si Stripe no contesta, el SERVIDOR responde 503 `TARJETA_NO_LEIDA`, y esa petición (como una de
   * red que falla) rechaza: la ventana dice «no se sabe», nunca «sin tarjeta».
   */
  tarjetaDeLaPrueba: (orgId: string): Promise<TarjetaDeLaPrueba> =>
    api
      .get(`/api/v1/onboarding/organizations/${orgId}/v2/tarjeta-de-la-prueba`)
      .then(res => (res.data?.data ?? res.data) as TarjetaDeLaPrueba),

  /**
   * Planes editables (B2 Task 5): «Confirmar mi pago» retoma el reto del banco del intento a medio pago aunque la oferta
   * vigente ya no tenga opciones. Sólo lee la suscripción del intento: nunca cobra ni crea nada, así que repetirla es seguro.
   */
  retomarPago: (orgId: string): Promise<RetomaDelPago> =>
    api
      .post(`/api/v1/onboarding/organizations/${orgId}/v2/retomar-pago`, undefined, { repetible: true })
      .then(res => (res.data?.data ?? res.data) as RetomaDelPago),

  /**
   * Asocia una campaña al alta en curso (§3.5). Cubre a quien ya tenía cuenta y llega por un
   * anuncio, y el respaldo del `sessionStorage` cuando el alta nació sin el código.
   */
  attachLaunchCampaign: (orgId: string, body: { slug?: string; code?: string; utm?: Record<string, string> }) =>
    api.put(`/api/v1/onboarding/organizations/${orgId}/v2/launch-campaign`, body),
}
