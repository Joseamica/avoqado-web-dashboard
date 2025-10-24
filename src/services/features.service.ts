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
 */
export const downloadInvoice = async (venueId: string, invoiceId: string): Promise<void> => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/invoices/${invoiceId}/download`, {
    responseType: 'blob',
  })

  // Create download link
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `invoice-${invoiceId}.pdf`)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}
