/**
 * «Activar cobros» — lo que el alta corta dejó de pedir y ahora se captura desde el dashboard
 * (§4.2 del spec). Datos fiscales, identidad, DIRECCIÓN DEL LOCAL y cuenta para depósitos.
 *
 * 🔴 La respuesta viene ENMASCARADA a propósito (RFC y CLABE nunca completos): esta pantalla
 * enseña el estado del trámite, no los datos personales que ya se guardaron.
 */
import api from '@/api'

export interface PaymentActivationProfile {
  entityType: string | null
  legalName: string | null
  rfcMasked: string | null
  curpPresent: boolean
  legalAddressPresent: boolean
  venueAddressPresent?: boolean
  clabeLast4: string | null
  bankName: string | null
  complete: boolean
}

export interface PaymentActivationStatus {
  kycStatus: 'NOT_SUBMITTED' | 'PENDING_REVIEW' | 'IN_REVIEW' | 'VERIFIED' | 'REJECTED' | null
  entityType: string | null
  profile: PaymentActivationProfile
  documents: { required: string[]; uploaded: string[] }
  terminalsCount: number
  onlinePaymentsConnected: boolean
}

export interface PaymentActivationProfileBody {
  entity?: { entityType: string; entitySubType?: string; commercialName?: string }
  identity?: {
    legalFirstName: string
    legalLastName: string
    rfc?: string
    curp?: string
    birthdate?: string
    personalPhone?: string
    legalAddress?: string
    legalCity?: string
    legalState?: string
    legalCountry?: string
    legalZipCode?: string
  }
  /** Dirección del LOCAL. Es la ÚNICA captura que queda tras el alta corta (§4.1). */
  venueAddress?: { address: string; city: string; state: string; zipCode: string; country?: string }
  bank?: { clabe: string; accountHolder: string; accountType: string }
}

export const paymentActivationService = {
  get: (venueId: string) => api.get(`/api/v1/dashboard/venues/${venueId}/payment-activation`),
  updateProfile: (venueId: string, body: PaymentActivationProfileBody) =>
    api.put(`/api/v1/dashboard/venues/${venueId}/payment-activation/profile`, body),
}
