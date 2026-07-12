import api from '@/api'

// MERCHANT_ROUTING_RULES (PREMIUM) — reglas condicionales de visibilidad/auto-selección
// de merchants en la TPV. Montos en PESOS (unidades mayores), igual que todo el dashboard.

export interface RoutingWindow {
  start: string // "HH:mm"
  end: string // "HH:mm"
}

export interface RoutingConditions {
  /** days: 0=domingo … 6=sábado */
  schedule?: { days: number[]; windows: RoutingWindow[] }
  geofence?: { lat: number; lng: number; radiusM: number }
  volumeCap?: { period: 'DAY' | 'WEEK' | 'MONTH'; maxAmount?: number; maxTxCount?: number }
  ticketAmount?: { min?: number; max?: number }
  staff?: { staffIds?: string[]; roles?: string[] }
  circuitBreaker?: { consecutiveFailures: number; cooldownMinutes: number }
}

export interface MerchantRuleView {
  merchantAccountId: string
  displayName: string
  providerCode: string
  displayOrder: number
  rule: { active: boolean; conditions: RoutingConditions; updatedAt: string } | null
}

export interface EligibilityMerchantResult {
  merchantAccountId: string
  eligible: boolean
  reasons: string[]
  circuitBreaker?: { consecutiveFailures: number; cooldownMinutes: number }
}

export interface EligibilityPreview {
  routingFeatureActive: boolean
  merchants: EligibilityMerchantResult[]
  autoSelectMerchantAccountId: string | null
  fallbackAll: boolean
  evaluatedAt: string
}

export async function getMerchantRoutingRules(venueId: string): Promise<{ merchants: MerchantRuleView[] }> {
  const res = await api.get(`/api/v1/dashboard/venues/${venueId}/merchant-routing-rules`)
  return res.data.data
}

export async function upsertMerchantRoutingRule(
  venueId: string,
  body: { merchantAccountId: string; active: boolean; conditions: RoutingConditions },
): Promise<{ id: string; merchantAccountId: string; active: boolean; conditions: RoutingConditions; updatedAt: string }> {
  const res = await api.put(`/api/v1/dashboard/venues/${venueId}/merchant-routing-rules`, body)
  return res.data.data
}

export async function deleteMerchantRoutingRule(venueId: string, merchantAccountId: string): Promise<{ deleted: boolean }> {
  const res = await api.delete(`/api/v1/dashboard/venues/${venueId}/merchant-routing-rules/${merchantAccountId}`)
  return res.data.data
}

export async function previewMerchantEligibility(
  venueId: string,
  body: { amount: number; simulateAt?: string; lat?: number; lng?: number; staffId?: string },
): Promise<EligibilityPreview> {
  const res = await api.post(`/api/v1/dashboard/venues/${venueId}/merchant-routing-rules/preview`, body)
  return res.data.data
}
