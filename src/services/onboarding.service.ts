import api from '@/api'
import { VenueType } from '@/types'

/**
 * Start onboarding progress for an organization
 */
export const startOnboarding = async (organizationId: string) => {
  const response = await api.post(`/api/v1/onboarding/organizations/${organizationId}/start`)
  return response.data
}

/**
 * Update Step 2 - Onboarding Type (Demo vs Manual)
 */
export const updateStep2 = async (organizationId: string, onboardingType: 'demo' | 'manual') => {
  const response = await api.put(`/api/v1/onboarding/organizations/${organizationId}/step/2`, {
    onboardingType: onboardingType.toUpperCase(), // Backend expects DEMO or REAL
  })
  return response.data
}

/**
 * Update Step 3 - Business Info
 */
export interface BusinessInfoData {
  name: string
  type: VenueType
  address: string
  city: string
  state: string
  country: string
  zipCode: string
  phone: string
  email: string
  timezone: string
  currency: string
}

export const updateStep3 = async (organizationId: string, data: BusinessInfoData) => {
  const response = await api.put(`/api/v1/onboarding/organizations/${organizationId}/step/3`, {
    name: data.name,
    venueType: data.type,
    address: data.address,
    city: data.city,
    state: data.state,
    country: data.country,
    zipCode: data.zipCode,
    phone: data.phone,
    email: data.email,
    timezone: data.timezone,
    currency: data.currency,
  })
  return response.data
}

/**
 * Complete onboarding and create venue
 */
export interface CompleteOnboardingResponse {
  message: string
  venue: {
    id: string
    slug: string
    name: string
    isDemo: boolean
  }
  summary: {
    categoriesCreated: number
    productsCreated: number
    demoDataSeeded: boolean
  }
}

export const completeOnboarding = async (organizationId: string): Promise<CompleteOnboardingResponse> => {
  const response = await api.post(`/api/v1/onboarding/organizations/${organizationId}/complete`)
  return response.data
}
