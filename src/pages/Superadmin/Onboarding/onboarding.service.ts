import api from '@/api'
import type { WizardState, WizardResponse, OrgPaymentStatus, MerchantAccountOption, OrganizationOption } from './onboarding.types'

export async function createVenueWizard(state: WizardState): Promise<WizardResponse> {
  // The onboarding.controller.ts stores pricing rates directly via
  // `new Prisma.Decimal(payload.pricing.debitRate)` without any percent→decimal
  // conversion. The UI collects rates in PERCENT form (e.g. "2.5" for 2.5%),
  // so we must convert to decimal (0.025) on the client before sending,
  // otherwise the DB would end up with values like 2.5 (= 250%).
  // Fee fields (fixedFeePerTransaction, monthlyServiceFee) are absolute money
  // amounts, not percentages — they pass through unchanged.
  const toDecimal = (v: number | undefined | null) =>
    typeof v === 'number' && !isNaN(v) ? v / 100 : v
  const pricingPayload = state.pricing
    ? {
        ...state.pricing,
        debitRate: toDecimal(state.pricing.debitRate) as number,
        creditRate: toDecimal(state.pricing.creditRate) as number,
        amexRate: toDecimal(state.pricing.amexRate) as number,
        internationalRate: toDecimal(state.pricing.internationalRate) as number,
      }
    : state.pricing

  const payload = {
    organization: state.organization,
    venue: state.venue,
    pricing: pricingPayload,
    terminal: state.terminal || undefined,
    settlement: state.settlement,
    team: state.team.owner.email ? state.team : undefined,
    features: state.features.length > 0 ? state.features : undefined,
    modules: state.modules.length > 0 ? state.modules : undefined,
  }

  const response = await api.post('/api/v1/superadmin/onboarding/venue', payload)
  return response.data
}

export async function fetchOrganizations(): Promise<OrganizationOption[]> {
  const response = await api.get('/api/v1/superadmin/onboarding/organizations')
  return response.data.data || []
}

export async function fetchMccLookup(venueType: string): Promise<{
  familia: string
  mcc: string
  confidence: number
  rates: { credito: number; debito: number; internacional: number; amex: number }
} | null> {
  try {
    const response = await api.get('/api/v1/superadmin/merchant-accounts/mcc-lookup', {
      params: { businessName: venueType },
    })
    return response.data.data || response.data
  } catch {
    return null
  }
}

export async function fetchOrgPaymentStatus(orgId: string): Promise<OrgPaymentStatus> {
  const response = await api.get(`/api/v1/superadmin/onboarding/org-payment-status/${orgId}`)
  return response.data
}

export async function fetchMerchantAccounts(): Promise<MerchantAccountOption[]> {
  const response = await api.get('/api/v1/superadmin/onboarding/merchant-accounts')
  return response.data.data || []
}

export interface BlumonAutoFetchResult {
  id: string
  serialNumber: string
  posId: string
  displayName: string
  blumonEnvironment: string
  alreadyExists?: boolean
}

export async function blumonAutoFetch(params: {
  serialNumber: string
  brand: string
  model: string
  displayName?: string
  environment: string
  businessCategory?: string
}): Promise<BlumonAutoFetchResult> {
  const response = await api.post('/api/v1/superadmin/merchant-accounts/blumon/auto-fetch', params)
  return response.data.data
}

export async function fetchFeatures(): Promise<Array<{ id: string; code: string; name: string; description: string }>> {
  try {
    const response = await api.get('/api/v1/dashboard/superadmin/features')
    return response.data.data || response.data || []
  } catch {
    return []
  }
}

export async function fetchModules(): Promise<Array<{ id: string; code: string; name: string; description: string }>> {
  try {
    const response = await api.get('/api/v1/superadmin/modules')
    return response.data.data || response.data || []
  } catch {
    return []
  }
}
