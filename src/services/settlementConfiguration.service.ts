import api from '@/api'

// ===== TYPES =====

export type TransactionCardType = 'DEBIT' | 'CREDIT' | 'AMEX' | 'INTERNATIONAL' | 'OTHER'

export type SettlementDayType = 'BUSINESS_DAYS' | 'CALENDAR_DAYS'

export interface SettlementConfiguration {
  id: string
  merchantAccountId: string
  cardType: TransactionCardType
  settlementDays: number
  settlementDayType: SettlementDayType
  cutoffTime: string
  cutoffTimezone: string
  effectiveFrom: string
  effectiveTo: string | null
  notes: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
  merchantAccount?: {
    id: string
    displayName: string | null
    accountId: string
    provider?: {
      id: string
      code: string
      name: string
    }
  }
}

export interface CreateSettlementConfigInput {
  merchantAccountId: string
  cardType: TransactionCardType
  settlementDays: number
  settlementDayType: SettlementDayType
  cutoffTime: string
  cutoffTimezone: string
  effectiveFrom: string
  notes?: string
}

export interface UpdateSettlementConfigInput {
  settlementDays?: number
  settlementDayType?: SettlementDayType
  cutoffTime?: string
  cutoffTimezone?: string
  effectiveFrom?: string
  effectiveTo?: string | null
  notes?: string
}

export interface BulkCreateSettlementConfigInput {
  merchantAccountId: string
  configs: Array<{
    cardType: TransactionCardType
    settlementDays: number
    settlementDayType?: SettlementDayType
    cutoffTime?: string
    cutoffTimezone?: string
  }>
  effectiveFrom: string
}

// ===== API FUNCTIONS =====

/**
 * Get all settlement configurations with optional filters
 */
export async function getSettlementConfigurations(filters?: {
  merchantAccountId?: string
  cardType?: TransactionCardType
  includeExpired?: boolean
}): Promise<SettlementConfiguration[]> {
  const params = new URLSearchParams()
  if (filters?.merchantAccountId) params.append('merchantAccountId', filters.merchantAccountId)
  if (filters?.cardType) params.append('cardType', filters.cardType)
  if (filters?.includeExpired) params.append('includeExpired', 'true')

  const response = await api.get(`/api/v1/superadmin/settlement-configurations?${params.toString()}`)
  return response.data.data
}

/**
 * Get a single settlement configuration by ID
 */
export async function getSettlementConfigurationById(id: string): Promise<SettlementConfiguration> {
  const response = await api.get(`/api/v1/superadmin/settlement-configurations/${id}`)
  return response.data.data
}

/**
 * Get active configuration for a merchant account and card type
 */
export async function getActiveConfiguration(
  merchantAccountId: string,
  cardType: TransactionCardType,
): Promise<SettlementConfiguration | null> {
  const response = await api.get(`/api/v1/superadmin/settlement-configurations/active/${merchantAccountId}/${cardType}`)
  return response.data.data
}

/**
 * Create a new settlement configuration
 */
export async function createSettlementConfiguration(
  input: CreateSettlementConfigInput,
): Promise<SettlementConfiguration> {
  const response = await api.post('/api/v1/superadmin/settlement-configurations', input)
  return response.data.data
}

/**
 * Update a settlement configuration
 */
export async function updateSettlementConfiguration(
  id: string,
  input: UpdateSettlementConfigInput,
): Promise<SettlementConfiguration> {
  const response = await api.put(`/api/v1/superadmin/settlement-configurations/${id}`, input)
  return response.data.data
}

/**
 * Delete a settlement configuration
 */
export async function deleteSettlementConfiguration(id: string): Promise<void> {
  await api.delete(`/api/v1/superadmin/settlement-configurations/${id}`)
}

/**
 * Bulk create settlement configurations for a merchant account
 */
export async function bulkCreateSettlementConfigurations(
  input: BulkCreateSettlementConfigInput,
): Promise<SettlementConfiguration[]> {
  const response = await api.post('/api/v1/superadmin/settlement-configurations/bulk', input)
  return response.data.data
}

// ===== CONSTANTS =====

export const CARD_TYPE_LABELS: Record<TransactionCardType, string> = {
  DEBIT: 'Debito',
  CREDIT: 'Credito',
  AMEX: 'American Express',
  INTERNATIONAL: 'Internacional',
  OTHER: 'Otros',
}

export const CARD_TYPES: TransactionCardType[] = ['DEBIT', 'CREDIT', 'AMEX', 'INTERNATIONAL', 'OTHER']

export const DEFAULT_SETTLEMENT_DAYS: Record<TransactionCardType, number> = {
  DEBIT: 1,
  CREDIT: 2,
  AMEX: 3,
  INTERNATIONAL: 5,
  OTHER: 2,
}

export const SETTLEMENT_DAY_TYPE_LABELS: Record<SettlementDayType, string> = {
  BUSINESS_DAYS: 'Dias habiles',
  CALENDAR_DAYS: 'Dias calendario',
}
