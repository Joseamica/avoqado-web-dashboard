import api from '@/api'
import { BusinessType } from '@/types'

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
    onboardingType: onboardingType === 'demo' ? 'DEMO' : 'REAL',
  })
  return response.data
}

/**
 * Update Step 3 - Business Info
 */
export interface BusinessInfoData {
  name: string
  type: BusinessType
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
 * Update Step 4 - Menu Data
 */
export interface MenuDataStepData {
  method: 'manual' | 'csv'
  categories?: Array<{ name: string; slug: string }>
  products?: Array<{
    name: string
    sku: string
    price: number
    categorySlug: string
  }>
}

export const updateStep4 = async (organizationId: string, data: MenuDataStepData) => {
  const response = await api.put(`/api/v1/onboarding/organizations/${organizationId}/step/4`, data)
  return response.data
}

/**
 * Update Step 5 - Team Invites
 */
export interface TeamInviteData {
  email: string
  firstName: string
  lastName: string
  role: string
}

export const updateStep5 = async (organizationId: string, invites: TeamInviteData[]) => {
  const response = await api.put(`/api/v1/onboarding/organizations/${organizationId}/step/5`, { teamInvites: invites })
  return response.data
}

/**
 * Update Step 6 - Selected Features
 */
export const updateStep6 = async (organizationId: string, features: string[]) => {
  const response = await api.put(`/api/v1/onboarding/organizations/${organizationId}/step/6`, {
    selectedFeatures: features, // Backend expects 'selectedFeatures', not 'features'
  })
  return response.data
}

/**
 * Update Step 7 - Payment Info
 */
export interface PaymentInfoData {
  clabe: string
  bankName?: string
  accountHolder?: string
}

export const updateStep7 = async (organizationId: string, data: PaymentInfoData) => {
  const response = await api.put(`/api/v1/onboarding/organizations/${organizationId}/step/7`, data)
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
    isOnboardingDemo: boolean
  }
  summary: {
    categoriesCreated: number
    productsCreated: number
    demoDataSeeded: boolean
  }
}

export const completeOnboarding = async (organizationId: string, stripePaymentMethodId?: string): Promise<CompleteOnboardingResponse> => {
  const response = await api.post(`/api/v1/onboarding/organizations/${organizationId}/complete`, {
    stripePaymentMethodId,
  })
  return response.data
}
