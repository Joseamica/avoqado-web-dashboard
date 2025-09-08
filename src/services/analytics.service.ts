import api from '@/api'

export type TimePreset = '7d' | '30d' | '90d' | 'qtd' | 'ytd' | '12m'
export type CompareTo = 'previous_period' | 'previous_year'

export interface RevenueStep { label: string; value: number }
export interface Timeseries {
  mrr: number[]
  nrr: number[]
  churnRate: number[]
  dau: number[]
  stickiness: number[]
}

export interface OverviewPayload {
  period: string
  compareTo: string
  segments: string[]
  kpiDeck: {
    financials: { arr: number | null; mrr: number | null; netNewArr: number | null; nrr: number; churnRate: number }
    growth: { signups: number; activationRate: number; winRate: number; salesCycleDays: number }
    engagement: { dau: number; mau: number; stickiness: number; uptime: number }
  }
  visuals: {
    revenueBridge: RevenueStep[] | null
    cohorts: { retention: number[][] }
    funnels: { activation: { stage: string; value: number }[] }
    timeseries: Timeseries
  }
  insights: { severity: 'info' | 'warn' | 'error'; message: string; code: string }[]
  definitions: { metric: string; formula: string }[]
}

export interface AnalyticsOverviewResponse {
  success: boolean
  meta: { correlationId: string; orgId: string; venueId: string; refreshedAt: string }
  overview: OverviewPayload
}

export async function fetchAnalyticsOverview(query: {
  timeRange?: TimePreset
  from?: string
  to?: string
  compareTo?: CompareTo
  orgId?: string
  venueId?: string
  segments?: string[]
}): Promise<AnalyticsOverviewResponse> {
  const res = await api.get<AnalyticsOverviewResponse>('/api/v1/analytics/overview', {
    params: query,
    withCredentials: true,
  })
  return res.data
}

