/**
 * Catálogo de cuentas (Capa B fiscal) service — gated PREMIUM (bundle con CFDI).
 *
 * Wraps the venue-scoped chart-of-accounts endpoints:
 *   GET   /api/v1/dashboard/venues/:venueId/accounting/chart-of-accounts
 *   POST  /api/v1/dashboard/venues/:venueId/accounting/chart-of-accounts/seed
 *   POST  /api/v1/dashboard/venues/:venueId/accounting/chart-of-accounts
 *   PATCH /api/v1/dashboard/venues/:venueId/accounting/chart-of-accounts/:accountId
 *
 * Scope is (organization, rfc) = el contribuyente. No money on these rows — it's the
 * structure (SAT código agrupador), not the ledger.
 */
import api from '@/api'

export type LedgerAccountType = 'ACTIVO' | 'PASIVO' | 'CAPITAL' | 'INGRESO' | 'COSTO' | 'GASTO' | 'ORDEN'
export type LedgerAccountNature = 'DEUDORA' | 'ACREEDORA'

export interface LedgerAccount {
  id: string
  code: string
  satGroupingCode: string
  name: string
  type: LedgerAccountType
  nature: LedgerAccountNature
  level: number
  parentId: string | null
  isPostable: boolean
  isActive: boolean
}

export interface ChartOfAccountsResponse {
  needsFiscalSetup: boolean
  organizationId: string | null
  rfc: string | null
  seeded: boolean
  accounts: LedgerAccount[]
}

export interface CreateAccountInput {
  code: string
  name: string
  satGroupingCode: string
  type: LedgerAccountType
  nature?: LedgerAccountNature
  parentCode?: string | null
}

export interface UpdateAccountInput {
  name?: string
  satGroupingCode?: string
  nature?: LedgerAccountNature
  isActive?: boolean
}

const base = (venueId: string) => `/api/v1/dashboard/venues/${venueId}/accounting/chart-of-accounts`

export async function getChartOfAccounts(venueId: string): Promise<ChartOfAccountsResponse> {
  const res = await api.get<ChartOfAccountsResponse>(base(venueId))
  return res.data
}

export async function seedChartOfAccounts(venueId: string): Promise<ChartOfAccountsResponse> {
  const res = await api.post<ChartOfAccountsResponse>(`${base(venueId)}/seed`)
  return res.data
}

export async function createLedgerAccount(venueId: string, input: CreateAccountInput): Promise<LedgerAccount> {
  const res = await api.post<LedgerAccount>(base(venueId), input)
  return res.data
}

export async function updateLedgerAccount(venueId: string, accountId: string, input: UpdateAccountInput): Promise<LedgerAccount> {
  const res = await api.patch<LedgerAccount>(`${base(venueId)}/${accountId}`, input)
  return res.data
}

export const chartOfAccountsKeys = {
  all: ['chartOfAccounts'] as const,
  catalog: (venueId: string | null) => [...chartOfAccountsKeys.all, venueId] as const,
}
