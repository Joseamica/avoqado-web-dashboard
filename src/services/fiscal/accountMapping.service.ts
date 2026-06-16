/**
 * Configuración contable (AccountMapping) service — gated PREMIUM (bundle con CFDI).
 *
 *   GET   /api/v1/dashboard/venues/:venueId/accounting/account-mapping
 *   POST  …/account-mapping/seed
 *   PATCH …/account-mapping/:movementType   body: { ledgerAccountId: string|null }
 *
 * Mapa "tipo de movimiento → cuenta del catálogo". Scope (org, rfc) = contribuyente.
 */
import api from '@/api'

export type MovementSide = 'DEBIT' | 'CREDIT' | 'BOTH'
export type MovementGroup = 'INGRESOS' | 'TESORERIA' | 'CARTERA' | 'INVENTARIO' | 'COSTOS_GASTOS' | 'RESULTADO'

export interface MappedAccount {
  id: string
  code: string
  name: string
  satGroupingCode: string
  isActive: boolean
}

export interface MappingRow {
  movementType: string
  label: string
  side: MovementSide
  group: MovementGroup
  defaultCode: string
  account: MappedAccount | null
}

export interface AccountMappingResponse {
  needsFiscalSetup: boolean
  catalogSeeded: boolean
  organizationId: string | null
  rfc: string | null
  mappings: MappingRow[]
}

const base = (venueId: string) => `/api/v1/dashboard/venues/${venueId}/accounting/account-mapping`

export async function getAccountMapping(venueId: string): Promise<AccountMappingResponse> {
  const res = await api.get<AccountMappingResponse>(base(venueId))
  return res.data
}

export async function seedAccountMapping(venueId: string): Promise<AccountMappingResponse> {
  const res = await api.post<AccountMappingResponse>(`${base(venueId)}/seed`)
  return res.data
}

export async function setAccountMapping(venueId: string, movementType: string, ledgerAccountId: string | null): Promise<MappingRow> {
  const res = await api.patch<MappingRow>(`${base(venueId)}/${movementType}`, { ledgerAccountId })
  return res.data
}

export const accountMappingKeys = {
  all: ['accountMapping'] as const,
  byVenue: (venueId: string | null) => [...accountMappingKeys.all, venueId] as const,
}
