import api from '@/api'

// ===== TYPES =====

export interface Aggregator {
  id: string
  name: string
  venueId: string | null
  baseFees: Record<string, number>
  ivaRate: string // Decimal comes as string from API
  reportToken: string | null
  active: boolean
  createdAt: string
  updatedAt: string
  _count?: { merchants: number; venueCommissions: number }
  merchants?: AggregatorMerchant[]
  venueCommissions?: VenueCommissionWithVenue[]
}

export interface AggregatorMerchant {
  id: string
  displayName: string | null
  externalMerchantId: string
  active: boolean
}

export interface VenueCommission {
  id: string
  venueId: string
  aggregatorId: string
  rate: string // Decimal comes as string from API
  referredBy: 'EXTERNAL' | 'AGGREGATOR'
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface VenueCommissionWithVenue extends VenueCommission {
  venue: { id: string; name: string; slug: string }
  aggregator?: { id: string; name: string; baseFees?: Record<string, number> }
}

export interface CreateAggregatorInput {
  name: string
  venueId?: string
  baseFees: Record<string, number>
  ivaRate?: number
  active?: boolean
}

export interface UpdateAggregatorInput {
  name?: string
  venueId?: string
  baseFees?: Record<string, number>
  ivaRate?: number
  active?: boolean
}

export interface CreateVenueCommissionInput {
  venueId: string
  aggregatorId: string
  rate: number
  referredBy: 'EXTERNAL' | 'AGGREGATOR'
  active?: boolean
}

export interface UpdateVenueCommissionInput {
  rate?: number
  referredBy?: 'EXTERNAL' | 'AGGREGATOR'
  active?: boolean
}

// ===== API =====

const BASE = '/api/v1/dashboard/superadmin'

export const aggregatorAPI = {
  // Aggregators
  getAll: async (filters?: { active?: boolean }): Promise<Aggregator[]> => {
    const params = new URLSearchParams()
    if (filters?.active !== undefined) params.set('active', String(filters.active))
    const { data } = await api.get(`${BASE}/aggregators?${params}`)
    return data.data
  },

  getById: async (id: string): Promise<Aggregator> => {
    const { data } = await api.get(`${BASE}/aggregators/${id}`)
    return data.data
  },

  create: async (input: CreateAggregatorInput): Promise<Aggregator> => {
    const { data } = await api.post(`${BASE}/aggregators`, input)
    return data.data
  },

  update: async (id: string, input: UpdateAggregatorInput): Promise<Aggregator> => {
    const { data } = await api.put(`${BASE}/aggregators/${id}`, input)
    return data.data
  },

  toggle: async (id: string): Promise<Aggregator> => {
    const { data } = await api.patch(`${BASE}/aggregators/${id}/toggle`)
    return data.data
  },

  // Venue Commissions
  getCommissions: async (filters?: { aggregatorId?: string; active?: boolean }): Promise<VenueCommissionWithVenue[]> => {
    const params = new URLSearchParams()
    if (filters?.aggregatorId) params.set('aggregatorId', filters.aggregatorId)
    if (filters?.active !== undefined) params.set('active', String(filters.active))
    const { data } = await api.get(`${BASE}/venue-commissions?${params}`)
    return data.data
  },

  getCommissionById: async (id: string): Promise<VenueCommissionWithVenue> => {
    const { data } = await api.get(`${BASE}/venue-commissions/${id}`)
    return data.data
  },

  createCommission: async (input: CreateVenueCommissionInput): Promise<VenueCommissionWithVenue> => {
    const { data } = await api.post(`${BASE}/venue-commissions`, input)
    return data.data
  },

  updateCommission: async (id: string, input: UpdateVenueCommissionInput): Promise<VenueCommissionWithVenue> => {
    const { data } = await api.put(`${BASE}/venue-commissions/${id}`, input)
    return data.data
  },

  deleteCommission: async (id: string): Promise<void> => {
    await api.delete(`${BASE}/venue-commissions/${id}`)
  },

  // Report Token
  generateToken: async (aggregatorId: string): Promise<string> => {
    const { data } = await api.post(`${BASE}/aggregators/${aggregatorId}/generate-token`)
    return data.data.token
  },

  revokeToken: async (aggregatorId: string): Promise<void> => {
    await api.delete(`${BASE}/aggregators/${aggregatorId}/revoke-token`)
  },
}
