/**
 * Retención en ventas (Capa B fiscal) service. Gated PREMIUM (CFDI).
 * Captura manual por periodo de lo que los clientes MORALES nos retuvieron (ISR/IVA) — así el IVA en flujo
 * y el ISR provisional no quedan inflados. Money en CENTAVOS enteros.
 *   GET /api/v1/dashboard/venues/:venueId/accounting/sales-retention?period=YYYY-MM
 *   PUT /api/v1/dashboard/venues/:venueId/accounting/sales-retention   (accounting:manage)
 */
import api from '@/api'

export interface SalesRetentionResponse {
  needsFiscalSetup: boolean
  organizationId: string | null
  rfc: string | null
  period: string
  isrRetenidoCents: number
  ivaRetenidoCents: number
  note: string | null
  /** Si ya se capturó el renglón del periodo (aunque sea en ceros). */
  hasEntry: boolean
}

export interface SetSalesRetentionInput {
  period: string
  isrRetenidoCents: number
  ivaRetenidoCents: number
  note?: string | null
}

export async function getSalesRetention(venueId: string, period: string): Promise<SalesRetentionResponse> {
  const res = await api.get<SalesRetentionResponse>(`/api/v1/dashboard/venues/${venueId}/accounting/sales-retention`, {
    params: { period },
  })
  return res.data
}

export async function setSalesRetention(venueId: string, input: SetSalesRetentionInput): Promise<SalesRetentionResponse> {
  const res = await api.put<SalesRetentionResponse>(`/api/v1/dashboard/venues/${venueId}/accounting/sales-retention`, input)
  return res.data
}

export const salesRetentionKeys = {
  all: ['salesRetention'] as const,
  byPeriod: (venueId: string | null, period: string) => [...salesRetentionKeys.all, venueId, period] as const,
}
