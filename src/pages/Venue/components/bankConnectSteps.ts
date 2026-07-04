import type { FinancialConnectionStatus } from '@/services/financialConnection.service'

export type WizardStep =
  | { step: 'providers' }
  | { step: 'credentials' }
  | { step: 'code'; variant: 'twoFactor' | 'device' }
  | { step: 'selectAccount' }
  | { step: 'done' }
  /** Proveedor con connectionType OAuth/agregador — el seam existe, el flujo real no todavía. */
  | { step: 'unsupported' }

/** Traduce el status que devuelve el backend al paso de UI que sigue. */
export function stepForStatus(status: FinancialConnectionStatus): WizardStep {
  switch (status) {
    case 'PENDING_TWO_FACTOR_AUTH':
      return { step: 'code', variant: 'twoFactor' }
    case 'PENDING_DEVICE_VALIDATION':
      return { step: 'code', variant: 'device' }
    case 'PENDING_ACCOUNT_SELECTION':
      return { step: 'selectAccount' }
    case 'CONNECTED':
      return { step: 'done' }
    default:
      // NEEDS_REAUTH / REVOKED / ERROR: la única salida es volver a dar credenciales.
      return { step: 'credentials' }
  }
}
