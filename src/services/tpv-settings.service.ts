import api from '@/api'

/**
 * TPV Settings - Configuration for terminal payment flow screens
 */
export interface TpvSettings {
  showReviewScreen: boolean      // Show reviews screen after payment
  showTipScreen: boolean         // Show tip selection screen before payment
  showReceiptScreen: boolean     // Show receipt options (email/print/skip)
  defaultTipPercentage: number | null  // Pre-selected tip percentage (0-100)
  tipSuggestions: number[]       // Available tip percentages (default: [10, 15, 20])
  requirePinLogin: boolean       // Require PIN for staff login on terminal
  // Step 4: Sale Verification (for retail/telecomunicaciones venues)
  showVerificationScreen: boolean  // Show verification screen after payment success
  requireVerificationPhoto: boolean  // Require at least one photo in verification
  requireVerificationBarcode: boolean  // Require at least one barcode scan in verification
  // Attendance verification (clock-in/out with photo + GPS)
  requireClockInPhoto: boolean   // Require selfie + GPS at clock-in
  requireClockOutPhoto: boolean  // Require selfie + GPS at clock-out
  requireClockInToLogin: boolean // Require active clock-in to log into TPV
  // Kiosk Mode
  kioskModeEnabled: boolean      // Allow terminal to enter self-service kiosk mode
  kioskDefaultMerchantId: string | null  // Pre-selected merchant for kiosk payments (skip merchant selection)
  // Home screen button visibility
  showQuickPayment: boolean      // Show "Pago rápido" button on home screen
  showOrderManagement: boolean   // Show "Órdenes" button on home screen
}

/**
 * Default TPV settings - used as fallback when backend doesn't return all fields
 */
const DEFAULT_TPV_SETTINGS: TpvSettings = {
  showReviewScreen: true,
  showTipScreen: true,
  showReceiptScreen: true,
  defaultTipPercentage: null,
  tipSuggestions: [10, 15, 20],
  requirePinLogin: true,
  showVerificationScreen: false,
  requireVerificationPhoto: false,
  requireVerificationBarcode: false,
  // Attendance verification disabled by default
  requireClockInPhoto: false,
  requireClockOutPhoto: false,
  requireClockInToLogin: false,
  // Kiosk Mode disabled by default
  kioskModeEnabled: false,
  kioskDefaultMerchantId: null,
  // Home screen buttons enabled by default
  showQuickPayment: true,
  showOrderManagement: true,
}

/**
 * Partial update for TPV settings - all fields optional
 */
export type TpvSettingsUpdate = Partial<TpvSettings>

/**
 * Merchant account assigned to a terminal
 */
export interface TerminalMerchant {
  id: string
  displayName: string
  active: boolean
}

/**
 * Service for managing TPV (Terminal Point of Sale) settings
 * These settings control the payment flow screens on individual Android terminals
 * Each terminal can have its own configuration
 */
export const tpvSettingsService = {
  /**
   * Get TPV settings for a specific terminal
   * Applies defaults for any missing fields to prevent undefined values
   * @permission tpv-settings:read (MANAGER+)
   */
  async getSettings(tpvId: string): Promise<TpvSettings> {
    const response = await api.get(`/api/v1/dashboard/tpv/${tpvId}/settings`)
    // Merge with defaults to ensure all fields have values (prevents undefined in Switch components)
    return { ...DEFAULT_TPV_SETTINGS, ...response.data }
  },

  /**
   * Update TPV settings for a specific terminal (partial update)
   * @permission tpv-settings:update (ADMIN+)
   */
  async updateSettings(tpvId: string, settings: TpvSettingsUpdate): Promise<TpvSettings> {
    const response = await api.put(`/api/v1/dashboard/tpv/${tpvId}/settings`, settings)
    return response.data
  },

  /**
   * Get merchants assigned to a specific terminal
   * Used for kiosk default merchant dropdown
   * @permission tpv-settings:read (MANAGER+)
   */
  async getTerminalMerchants(tpvId: string): Promise<TerminalMerchant[]> {
    const response = await api.get(`/api/v1/dashboard/tpv/${tpvId}/merchants`)
    return response.data.data || []
  },
}

export default tpvSettingsService
