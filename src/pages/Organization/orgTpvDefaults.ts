import type { TpvSettings } from '@/services/tpv-settings.service'

/**
 * Defaults del editor «Ajustes de terminales» de la ORGANIZACIÓN (OrganizationSettings → pestaña TPV).
 *
 * Es una lista aparte de `DEFAULT_TPV_SETTINGS` (tpv-settings.service) a propósito: «Guardar y aplicar»
 * empuja TODOS estos valores a TODAS las terminales, así que aquí no va nada que sea sólo de una
 * terminal (p. ej. `trackPromoterLocationOverride`, que borraría la ubicación configurada por terminal).
 * Los valores deben coincidir con los del servidor: lo fija `tpv-settings.defaults.test.ts`.
 */
export const ORG_DEFAULT_TPV_SETTINGS: TpvSettings = {
  showReviewScreen: true,
  showTipScreen: true,
  showReceiptScreen: true,
  defaultTipPercentage: null,
  tipSuggestions: [10, 15, 20],
  requirePinLogin: false,
  // Card payment kill-switch: default true (legacy/safe). Per-terminal toggle only;
  // org-level editor keeps the safe default and never pushes it down.
  requireAvoqadoServerForCardPayment: true,
  showVerificationScreen: false,
  requireVerificationPhoto: false,
  requireVerificationBarcode: false,
  requireClockInPhoto: false,
  requireClockOutPhoto: false,
  requireClockInToLogin: false,
  kioskModeEnabled: false,
  kioskDefaultMerchantId: null,
  showQuickPayment: true,
  // «Órdenes» es legacy (founder, 8-oct-2026) y el servidor la guarda apagada.
  showOrderManagement: false,
  showReports: true,
  showPayments: true,
  showSupport: true,
  showGoals: true,
  showMessages: true,
  showTrainings: true,
  showCheckout: true,
  showCryptoOption: false,
  cellularFailoverMode: 'OFF',
  cellularFailoverBadReadingsThreshold: 3,
  cellularFailoverCooldownSeconds: 60,
  cellularFailoverMinCellHoldSeconds: 120,
}
