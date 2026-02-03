import api from '@/api'

// ===== TYPES =====

export interface ProfitMetrics {
  totalGrossProfit: number
  totalProviderCosts: number
  totalVenueCharges: number
  averageProfitMargin: number
  transactionCount: number
  profitGrowth: number
  topProviders: ProviderProfitSummary[]
  topVenues: VenueProfitSummary[]
}

export interface ProviderProfitSummary {
  providerId: string
  providerName: string
  providerCode: string
  totalCosts: number
  totalTransactions: number
  averageRate: number
  share: number
}

export interface VenueProfitSummary {
  venueId: string
  venueName: string
  totalProfit: number
  profitMargin: number
  totalVolume: number
  transactionCount: number
  growth: number
}

export interface MonthlyProfitData {
  venueId: string
  venueName: string
  year: number
  month: number
  totalTransactions: number
  totalVolume: number
  debitTransactions: number
  debitVolume: number
  creditTransactions: number
  creditVolume: number
  amexTransactions: number
  amexVolume: number
  internationalTransactions: number
  internationalVolume: number
  totalProviderCosts: number
  totalVenueCharges: number
  totalGrossProfit: number
  averageProfitMargin: number
  monthlyProviderFees: number
  monthlyServiceFees: number
  status: 'CALCULATED' | 'VERIFIED' | 'DISPUTED' | 'FINALIZED'
}

export interface CostStructureAnalysis {
  providerId: string
  providerName: string
  providerCode: string
  merchantAccounts: {
    id: string
    alias: string
    externalMerchantId: string
    currentCosts: {
      debitRate: number
      creditRate: number
      amexRate: number
      internationalRate: number
      fixedCostPerTransaction: number
      monthlyFee: number
      effectiveFrom: string
      effectiveTo?: string
    }
    transactionVolume: number
    totalCosts: number
    lastUpdated: string
  }[]
}

export interface ProviderCostStructure {
  id: string
  providerId: string
  providerName: string
  merchantAccountId: string
  merchantAccountAlias: string
  debitRate: number
  creditRate: number
  amexRate: number
  internationalRate: number
  fixedCostPerTransaction?: number
  monthlyFee?: number
  minimumVolume?: number
  volumeDiscount?: number
  effectiveFrom: string
  effectiveTo?: string
  active: boolean
  proposalReference?: string
  notes?: string
}

export interface VenuePricingStructure {
  id: string
  venueId: string
  venueName: string
  accountType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY'
  debitRate: number
  creditRate: number
  amexRate: number
  internationalRate: number
  fixedFeePerTransaction?: number
  monthlyServiceFee?: number
  minimumMonthlyVolume?: number
  volumePenalty?: number
  effectiveFrom: string
  effectiveTo?: string
  active: boolean
  contractReference?: string
  notes?: string
}

export interface TransactionCostDetail {
  id: string
  paymentId: string
  orderNumber?: string
  venueId: string
  venueName: string
  merchantAccountId: string
  providerName: string
  transactionType: 'DEBIT' | 'CREDIT' | 'AMEX' | 'INTERNATIONAL' | 'OTHER'
  amount: number
  providerRate: number
  providerCostAmount: number
  providerFixedFee: number
  venueRate: number
  venueChargeAmount: number
  venueFixedFee: number
  grossProfit: number
  profitMargin: number
  createdAt: string
}

export interface PaymentProvider {
  id: string
  code: string
  name: string
  type: 'PAYMENT_PROCESSOR' | 'BANK_DIRECT' | 'WALLET' | 'GATEWAY' | 'OTHER'
  countryCode: string[]
  active: boolean
}

export interface MerchantAccount {
  id: string
  providerId: string
  providerName: string
  externalMerchantId: string
  alias?: string
  active: boolean
}

export interface VenueListItem {
  id: string
  name: string
  slug: string
  active: boolean
}

// ===== API FUNCTIONS =====

/**
 * Get profit metrics with optional filters
 */
export async function getProfitMetrics(params?: {
  startDate?: string
  endDate?: string
  venueId?: string
  providerId?: string
}): Promise<ProfitMetrics> {
  const response = await api.get('/api/v1/dashboard/superadmin/profit/metrics', { params })
  return response.data.data
}

/**
 * Get monthly profit data
 */
export async function getMonthlyProfits(params?: {
  startDate?: string
  endDate?: string
  venueId?: string
  status?: string
}): Promise<MonthlyProfitData[]> {
  const response = await api.get('/api/v1/dashboard/superadmin/profit/monthly', { params })
  return response.data.data
}

/**
 * Get cost structure analysis
 */
export async function getCostStructureAnalysis(): Promise<CostStructureAnalysis[]> {
  const response = await api.get('/api/v1/dashboard/superadmin/cost-structures/analysis')
  return response.data.data
}

/**
 * Get provider cost structures
 */
export async function getProviderCostStructures(params?: {
  providerId?: string
  merchantAccountId?: string
  active?: boolean
}): Promise<ProviderCostStructure[]> {
  const response = await api.get('/api/v1/dashboard/superadmin/cost-structures/provider', { params })
  return response.data.data
}

/**
 * Create or update provider cost structure
 */
export async function upsertProviderCostStructure(data: {
  providerId: string
  merchantAccountId: string
  debitRate: number
  creditRate: number
  amexRate: number
  internationalRate: number
  fixedCostPerTransaction?: number
  monthlyFee?: number
  minimumVolume?: number
  volumeDiscount?: number
  effectiveFrom: string
  effectiveTo?: string
  proposalReference?: string
  notes?: string
}): Promise<ProviderCostStructure> {
  const response = await api.post('/api/v1/dashboard/superadmin/cost-structures/provider', data)
  return response.data.data
}

/**
 * Get venue pricing structures
 */
export async function getVenuePricingStructures(params?: {
  venueId?: string
  accountType?: string
  active?: boolean
}): Promise<VenuePricingStructure[]> {
  const response = await api.get('/api/v1/dashboard/superadmin/pricing-structures/venue', { params })
  return response.data.data
}

/**
 * Create or update venue pricing structure
 */
export async function upsertVenuePricingStructure(data: {
  venueId: string
  accountType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY'
  debitRate: number
  creditRate: number
  amexRate: number
  internationalRate: number
  fixedFeePerTransaction?: number
  monthlyServiceFee?: number
  minimumMonthlyVolume?: number
  volumePenalty?: number
  effectiveFrom: string
  effectiveTo?: string
  contractReference?: string
  notes?: string
}): Promise<VenuePricingStructure> {
  const response = await api.post('/api/v1/dashboard/superadmin/pricing-structures/venue', data)
  return response.data.data
}

/**
 * Get detailed transaction costs
 */
export async function getTransactionCosts(params?: {
  startDate?: string
  endDate?: string
  venueId?: string
  providerId?: string
  transactionType?: string
  limit?: number
  offset?: number
}): Promise<{
  data: TransactionCostDetail[]
  total: number
  totalProfit: number
  averageMargin: number
}> {
  const response = await api.get('/api/v1/dashboard/superadmin/transaction-costs', { params })
  return response.data.data
}

/**
 * Recalculate profits for a specific period
 */
export async function recalculateProfits(params: {
  startDate: string
  endDate: string
  venueId?: string
}): Promise<{
  processedTransactions: number
  calculatedProfits: number
  errors: string[]
}> {
  const response = await api.post('/api/v1/dashboard/superadmin/profit/recalculate', params)
  return response.data.data
}

/**
 * Update monthly profit status
 */
export async function updateMonthlyProfitStatus(
  monthlyProfitId: string,
  status: 'CALCULATED' | 'VERIFIED' | 'DISPUTED' | 'FINALIZED',
  notes?: string
): Promise<void> {
  await api.patch(`/api/v1/dashboard/superadmin/profit/monthly/${monthlyProfitId}/status`, {
    status,
    notes,
  })
}

/**
 * Get payment providers list
 */
export async function getProvidersList(): Promise<PaymentProvider[]> {
  const response = await api.get('/api/v1/dashboard/superadmin/providers')
  return response.data.data
}

/**
 * Get merchant accounts list
 */
export async function getMerchantAccountsList(providerId?: string): Promise<MerchantAccount[]> {
  const response = await api.get('/api/v1/dashboard/superadmin/merchant-accounts', {
    params: { providerId }
  })
  return response.data.data
}

/**
 * Get venues list
 */
export async function getVenuesList(): Promise<VenueListItem[]> {
  const response = await api.get('/api/v1/dashboard/superadmin/venues/list')
  return response.data.data
}

/**
 * Export profit data
 */
export async function exportProfitData(params: {
  startDate: string
  endDate: string
  format: 'csv' | 'xlsx'
  includeTransactionDetails?: boolean
}): Promise<Blob> {
  const response = await api.get('/api/v1/dashboard/superadmin/profit/export', {
    params,
    responseType: 'blob'
  })
  return response.data
}

// Convenience API object for easy importing
export const costManagementAPI = {
  getProfitMetrics,
  getMonthlyProfits,
  getCostStructureAnalysis,
  getProviderCostStructures,
  upsertProviderCostStructure,
  getVenuePricingStructures,
  upsertVenuePricingStructure,
  getTransactionCosts,
  recalculateProfits,
  updateMonthlyProfitStatus,
  getProvidersList,
  getMerchantAccountsList,
  getVenuesList,
  exportProfitData,
}

export default costManagementAPI