/**
 * Financial Connections — API client (dashboard OWNER).
 *
 * Un OWNER conecta la cuenta bancaria de su sucursal con sus propias
 * credenciales (self-connect), resuelve retos 2FA/dispositivo, elige qué
 * negocio ligar y consulta saldo en vivo. Backend: avoqado-server
 * `/api/v1/dashboard/venues/:venueId/financial-connections`.
 */
import api from '@/api'

export type FinancialConnectionStatus =
  | 'PENDING_DEVICE_VALIDATION'
  | 'PENDING_TWO_FACTOR_AUTH'
  | 'PENDING_ACCOUNT_SELECTION'
  | 'CONNECTED'
  | 'NEEDS_REAUTH'
  | 'REVOKED'
  | 'ERROR'

export type BalanceState = 'OK' | 'ERROR' | 'UNKNOWN'

export interface FinancialProvider {
  id: string
  code: string
  name: string
  active: boolean
  connectionType: string
}

export interface ProviderAccountOption {
  externalId: string
  label?: string | null
  clabe?: string | null
  active?: boolean | null
  balance?: number | null
}

export interface ConnectionStepResult {
  connectionId: string
  status: FinancialConnectionStatus
  accountOptions?: ProviderAccountOption[]
}

export interface FinancialAccountSummary {
  id: string
  externalId: string
  label: string | null
  clabe: string | null
  currency: string
  lastBalance: number | null
  lastSyncedAt: string | null
  balanceState: BalanceState
  merchantAccounts: Array<{ id: string }>
}

export interface FinancialConnectionSummary {
  id: string
  status: FinancialConnectionStatus
  mode: string
  lastError: string | null
  provider: { code: string; name: string }
  accounts: FinancialAccountSummary[]
}

export interface AccountBalance {
  amount: number | null
  currency: string
  syncedAt: string | null
  state: 'OK' | 'ERROR'
}

export interface AccountMovement {
  id: string | null
  type: string | null
  operationType: string | null
  concept: string | null
  date: string | null
  amount: number | null
  status: string | null
  statusId: number | null
  beneficiary: string | null
  originator: string | null
  reference: string | null
}

export interface MovementsPage {
  movements: AccountMovement[]
  total: number
}

export interface MovementCategoryStats {
  amount: number | null
  fee: number | null
  count: number | null
}

export interface AccountMovementStats {
  accountName: string | null
  clabe: string | null
  speiIn: MovementCategoryStats
  speiOut: MovementCategoryStats
  internalTransfers: MovementCategoryStats
  dispersions: MovementCategoryStats
}

const BASE = '/api/v1/dashboard'

export const financialConnectionAPI = {
  async listProviders(): Promise<FinancialProvider[]> {
    const { data } = await api.get(`${BASE}/financial-providers`)
    return data.data
  },

  async listConnections(venueId: string): Promise<FinancialConnectionSummary[]> {
    const { data } = await api.get(`${BASE}/venues/${venueId}/financial-connections`)
    return data.data
  },

  async createConnection(
    venueId: string,
    body: { providerId: string; email: string; password: string },
  ): Promise<ConnectionStepResult> {
    const { data } = await api.post(`${BASE}/venues/${venueId}/financial-connections`, body)
    return data.data
  },

  async validateTwoFactor(venueId: string, connectionId: string, code: string): Promise<ConnectionStepResult> {
    const { data } = await api.post(`${BASE}/venues/${venueId}/financial-connections/${connectionId}/validate-2fa`, { code })
    return data.data
  },

  async validateDevice(venueId: string, connectionId: string, code: string): Promise<ConnectionStepResult> {
    const { data } = await api.post(`${BASE}/venues/${venueId}/financial-connections/${connectionId}/validate-device`, { code })
    return data.data
  },

  async selectAccount(venueId: string, connectionId: string, externalId: string): Promise<{ status: 'CONNECTED' }> {
    const { data } = await api.post(`${BASE}/venues/${venueId}/financial-connections/${connectionId}/select-account`, { externalId })
    return data.data
  },

  async getBalance(venueId: string, financialAccountId: string): Promise<AccountBalance> {
    const { data } = await api.get(`${BASE}/venues/${venueId}/financial-accounts/${financialAccountId}/balance`)
    return data.data
  },

  async disconnect(venueId: string, connectionId: string): Promise<void> {
    await api.delete(`${BASE}/venues/${venueId}/financial-connections/${connectionId}`)
  },

  async getMovements(
    venueId: string,
    financialAccountId: string,
    opts: { page: number; size: number; from?: string; to?: string },
  ): Promise<MovementsPage> {
    const params: Record<string, unknown> = { page: opts.page, size: opts.size }
    if (opts.from) params.from = opts.from
    if (opts.to) params.to = opts.to
    const { data } = await api.get(`${BASE}/venues/${venueId}/financial-accounts/${financialAccountId}/movements`, { params })
    return data.data
  },

  async getMovementStats(
    venueId: string,
    financialAccountId: string,
    range: { from?: string; to?: string },
  ): Promise<AccountMovementStats> {
    const params: Record<string, unknown> = {}
    if (range.from) params.from = range.from
    if (range.to) params.to = range.to
    const { data } = await api.get(`${BASE}/venues/${venueId}/financial-accounts/${financialAccountId}/movements/stats`, { params })
    return data.data
  },
}
