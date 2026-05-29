import api from '@/api'
import type {
  ReferralProgramConfig,
  ActivateReferralProgramRequest,
  ReferralSummary,
  HallOfFameEntry,
  ListReferralsParams,
  PaginatedReferrals,
  ReferralRecord,
} from '@/types/referrals'

/**
 * Referrals service — thin axios wrapper over /api/v1/dashboard/venues/:venueId/referrals/*.
 *
 * Backend permissions are enforced at the API; this client only mirrors UX gating.
 * See Plan 1 (backend) for endpoint contracts.
 */
export const referralsService = {
  // ==================== CONFIG ====================

  /**
   * GET /config — returns `{ active: false }` if no config exists yet,
   * or the full ReferralProgramConfig if it does. Never 404s.
   */
  async getConfig(venueId: string): Promise<ReferralProgramConfig> {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/referrals/config`)
    return response.data
  },

  /**
   * POST /activate — create config + flip active=true.
   */
  async activate(venueId: string, data: ActivateReferralProgramRequest): Promise<{ ok: true }> {
    const response = await api.post(`/api/v1/dashboard/venues/${venueId}/referrals/activate`, data)
    return response.data
  },

  /**
   * POST /deactivate — pause the program. Existing codes/coupons are preserved.
   */
  async deactivate(venueId: string, reason: string): Promise<{ ok: true }> {
    const response = await api.post(`/api/v1/dashboard/venues/${venueId}/referrals/deactivate`, { reason })
    return response.data
  },

  // ==================== SUMMARY ====================

  /**
   * GET /summary — monthly metrics + top referrer.
   */
  async getSummary(venueId: string): Promise<ReferralSummary> {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/referrals/summary`)
    return response.data
  },

  // ==================== READS (Plan 1 Phase C / Plan 2 UI) ====================

  /**
   * GET /hall-of-fame — top referrers (default 10).
   */
  async getHallOfFame(venueId: string, limit = 10): Promise<HallOfFameEntry[]> {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/referrals/hall-of-fame`, {
      params: { limit },
    })
    return response.data
  },

  /**
   * GET / — paginated list of referrals with optional filters.
   */
  async listReferrals(
    venueId: string,
    params: ListReferralsParams = {},
  ): Promise<PaginatedReferrals> {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/referrals`, { params })
    return response.data
  },

  /**
   * GET /customers/:customerId/referrals — full referrer history for one customer.
   */
  async getCustomerReferrals(venueId: string, customerId: string): Promise<ReferralRecord[]> {
    const response = await api.get(
      `/api/v1/dashboard/venues/${venueId}/referrals/customers/${customerId}/referrals`,
    )
    return response.data
  },

  /**
   * POST /customers/:customerId/generate-code — retroactively activate a code for a legacy customer.
   */
  async generateCustomerCode(
    venueId: string,
    customerId: string,
  ): Promise<{ referralCode: string }> {
    const response = await api.post(
      `/api/v1/dashboard/venues/${venueId}/referrals/customers/${customerId}/generate-code`,
    )
    return response.data
  },
}

export default referralsService
