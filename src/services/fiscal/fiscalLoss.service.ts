/**
 * Pérdidas fiscales de ejercicios anteriores (Capa B fiscal) service. Gated PREMIUM (CFDI).
 * Saldo pendiente de amortizar por contribuyente; el ISR general lo resta a la utilidad (topado). Centavos.
 *   GET /api/v1/dashboard/venues/:venueId/accounting/fiscal-loss
 *   PUT /api/v1/dashboard/venues/:venueId/accounting/fiscal-loss   (accounting:manage)
 */
import api from '@/api'

export interface FiscalLossResponse {
  needsFiscalSetup: boolean
  organizationId: string | null
  rfc: string | null
  pendingCents: number
  note: string | null
  hasEntry: boolean
}

export async function getFiscalLoss(venueId: string): Promise<FiscalLossResponse> {
  const res = await api.get<FiscalLossResponse>(`/api/v1/dashboard/venues/${venueId}/accounting/fiscal-loss`)
  return res.data
}

export async function setFiscalLoss(venueId: string, input: { pendingCents: number; note?: string | null }): Promise<FiscalLossResponse> {
  const res = await api.put<FiscalLossResponse>(`/api/v1/dashboard/venues/${venueId}/accounting/fiscal-loss`, input)
  return res.data
}

export const fiscalLossKeys = {
  all: ['fiscalLoss'] as const,
  byVenue: (venueId: string | null) => [...fiscalLossKeys.all, venueId] as const,
}
