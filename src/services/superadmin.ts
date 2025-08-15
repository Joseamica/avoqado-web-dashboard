import api from '@/api'
import type {
  SuperadminDashboardData,
  PlatformFeature,
  SuperadminVenue
} from '@/types/superadmin'

// Dashboard API
export const superadminAPI = {
  // Dashboard data
  getDashboardData: async (): Promise<SuperadminDashboardData> => {
    const response = await api.get('/api/v2/dashboard/superadmin/dashboard')
    return response.data.data
  },

  // Venue management
  getAllVenues: async (): Promise<SuperadminVenue[]> => {
    const response = await api.get('/api/v2/dashboard/superadmin/venues')
    return response.data.data
  },

  getVenueDetails: async (venueId: string): Promise<SuperadminVenue> => {
    const response = await api.get(`/api/v2/dashboard/superadmin/venues/${venueId}`)
    return response.data.data
  },

  approveVenue: async (venueId: string, reason?: string): Promise<void> => {
    await api.post(`/api/v2/dashboard/superadmin/venues/${venueId}/approve`, { reason })
  },

  suspendVenue: async (venueId: string, reason: string): Promise<void> => {
    await api.post(`/api/v2/dashboard/superadmin/venues/${venueId}/suspend`, { reason })
  },

  // Feature management
  getAllFeatures: async (): Promise<PlatformFeature[]> => {
    const response = await api.get('/api/v2/dashboard/superadmin/features')
    return response.data.data
  },

  createFeature: async (featureData: {
    name: string
    code: string
    description: string
    category: string
    pricingModel: string
    basePrice?: number
    usagePrice?: number
    usageUnit?: string
    isCore?: boolean
  }): Promise<PlatformFeature> => {
    const response = await api.post('/api/v2/dashboard/superadmin/features', featureData)
    return response.data.data
  },

  enableFeatureForVenue: async (venueId: string, featureCode: string): Promise<void> => {
    await api.post(`/api/v2/dashboard/superadmin/venues/${venueId}/features/${featureCode}/enable`)
  },

  disableFeatureForVenue: async (venueId: string, featureCode: string): Promise<void> => {
    await api.delete(`/api/v2/dashboard/superadmin/venues/${venueId}/features/${featureCode}/disable`)
  },
}

// React Query hooks
export const useSuperadminAPI = () => superadminAPI