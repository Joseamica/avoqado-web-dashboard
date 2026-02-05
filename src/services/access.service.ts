import api from '@/api'
import type { StaffRole } from '@/types'

/**
 * Feature access result from backend
 */
export interface FeatureAccessResult {
  allowed: boolean
  reason?: 'FEATURE_NOT_ENABLED' | 'ROLE_NOT_ALLOWED' | 'MODULE_DISABLED'
  dataScope: 'venue' | 'user-venues' | 'organization'
}

/**
 * Complete user access information for a specific venue
 * Matches the backend UserAccess interface from access.service.ts
 */
export interface UserAccess {
  userId: string
  venueId: string
  organizationId: string
  role: StaffRole
  /** Resolved core permissions (merged defaults + custom from VenueRolePermission) */
  corePermissions: string[]
  /** Whether WHITE_LABEL_DASHBOARD module is enabled for this venue */
  whiteLabelEnabled: boolean
  /** List of enabled feature codes (if white-label is enabled) */
  enabledFeatures: string[]
  /** Access status for each enabled feature */
  featureAccess: Record<string, FeatureAccessResult>
}

/**
 * Venue info from /me/venues endpoint
 */
export interface UserVenue {
  id: string
  name: string
  slug: string
  role: StaffRole
  organizationId: string
  organizationName: string
}

/**
 * Service for fetching user access information from the backend.
 * This is the frontend's connection to the unified access system.
 */
export const accessService = {
  /**
   * Get the current user's access information for a specific venue.
   * Returns resolved permissions, white-label status, and feature access.
   *
   * @param venueId - Target venue ID (optional, uses JWT venue if not provided)
   */
  async getAccess(venueId?: string): Promise<UserAccess> {
    const params = venueId ? { venueId } : {}
    const response = await api.get('/api/v1/me/access', { params })
    return response.data
  },

  /**
   * Get all venues the current user has access to.
   */
  async getVenues(): Promise<{ venues: UserVenue[] }> {
    const response = await api.get('/api/v1/me/venues')
    return response.data
  },
}

export default accessService
