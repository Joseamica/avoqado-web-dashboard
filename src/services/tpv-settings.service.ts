import api from '@/api'

/**
 * TPV Settings - Configuration for terminal payment flow screens
 */
export interface TpvSettings {
  showReviewScreen: boolean      // Show reviews screen after payment
  showTipScreen: boolean         // Show tip selection screen before payment
  showReceiptScreen: boolean     // Show receipt options (email/print/skip)
  defaultTipPercentage: number | null  // Pre-selected tip percentage (0-100)
  tipSuggestions: number[]       // Available tip percentages [15, 18, 20, 25]
  requirePinLogin: boolean       // Require PIN for staff login on terminal
}

/**
 * Partial update for TPV settings - all fields optional
 */
export type TpvSettingsUpdate = Partial<TpvSettings>

/**
 * Service for managing TPV (Terminal Point of Sale) settings
 * These settings control the payment flow screens on individual Android terminals
 * Each terminal can have its own configuration
 */
export const tpvSettingsService = {
  /**
   * Get TPV settings for a specific terminal
   * @permission tpv-settings:read (MANAGER+)
   */
  async getSettings(tpvId: string): Promise<TpvSettings> {
    const response = await api.get(`/api/v1/dashboard/tpv/${tpvId}/settings`)
    return response.data
  },

  /**
   * Update TPV settings for a specific terminal (partial update)
   * @permission tpv-settings:update (ADMIN+)
   */
  async updateSettings(tpvId: string, settings: TpvSettingsUpdate): Promise<TpvSettings> {
    const response = await api.put(`/api/v1/dashboard/tpv/${tpvId}/settings`, settings)
    return response.data
  },
}

export default tpvSettingsService
