/**
 * Credit Offer Service
 *
 * Client-facing service for venues to view and respond to credit offers.
 * This follows the Square Capital model: venues receive "invitations" but
 * never see their internal credit scores.
 */

import api from '@/api'

export interface CreditOffer {
  id: string
  offerAmount: number
  factorRate: number
  totalRepayment: number
  repaymentPercent: number
  estimatedTermDays: number
  expiresAt: string
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'WITHDRAWN'
  createdAt: string
}

export interface CreditOfferResponse {
  hasOffer: boolean
  offer: CreditOffer | null
}

/**
 * Get pending credit offer for a venue (if any)
 */
export async function getPendingCreditOffer(venueId: string): Promise<CreditOfferResponse> {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/credit-offer`)
  return response.data.data
}

/**
 * Express interest in a credit offer
 */
export async function expressInterestInOffer(venueId: string, offerId: string): Promise<void> {
  await api.post(`/api/v1/dashboard/venues/${venueId}/credit-offer/${offerId}/interest`)
}

/**
 * Decline a credit offer
 */
export async function declineCreditOffer(venueId: string, offerId: string, reason?: string): Promise<void> {
  await api.post(`/api/v1/dashboard/venues/${venueId}/credit-offer/${offerId}/decline`, { reason })
}
