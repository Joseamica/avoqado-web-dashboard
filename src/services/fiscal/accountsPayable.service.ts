/**
 * Cuentas por pagar (antigüedad de saldos a proveedores, Capa B) service — read-only.
 *   GET /api/v1/dashboard/venues/:venueId/accounting/accounts-payable?asOf=YYYY-MM-DD
 * Money en CENTAVOS enteros. Gated PREMIUM (CFDI).
 */
import api from '@/api'

export interface SupplierAgingRow {
  proveedorRfc: string
  proveedorNombre: string
  comprobantes: number
  pendienteCents: number
  corrienteCents: number
  d31_60Cents: number
  d61_90Cents: number
  mas90Cents: number
  maxDiasVencido: number
}

export interface AccountsPayableResponse {
  needsFiscalSetup: boolean
  organizationId: string | null
  rfc: string | null
  asOf: string
  suppliers: SupplierAgingRow[]
  totals: {
    proveedores: number
    comprobantes: number
    pendienteCents: number
    corrienteCents: number
    d31_60Cents: number
    d61_90Cents: number
    mas90Cents: number
  }
}

export async function getAccountsPayable(venueId: string, asOf?: string): Promise<AccountsPayableResponse> {
  const { data } = await api.get<AccountsPayableResponse>(`/api/v1/dashboard/venues/${venueId}/accounting/accounts-payable`, {
    params: asOf ? { asOf } : undefined,
  })
  return data
}
