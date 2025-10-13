import api from '@/api'

// ===== TYPES =====

export interface PaymentProvider {
  id: string
  code: string
  name: string
  type: 'PAYMENT_PROCESSOR' | 'GATEWAY' | 'WALLET' | 'BANK_DIRECT' | 'AGGREGATOR'
  countryCode: string[]
  active: boolean
  configSchema: any
  createdAt: string
  updatedAt: string
  _count?: {
    merchantAccounts: number
  }
}

export interface MerchantAccount {
  id: string
  providerId: string
  externalMerchantId: string
  alias?: string
  displayName?: string
  active: boolean
  displayOrder: number
  providerConfig?: any
  hasCredentials: boolean
  createdAt: string
  updatedAt: string
  provider: {
    id: string
    code: string
    name: string
    type: string
  }
  _count?: {
    costStructures: number
  }
}

export interface MerchantAccountCredentials {
  merchantId: string
  apiKey: string
  customerId?: string
  terminalId?: string
  [key: string]: any
}

export interface ProviderCostStructure {
  id: string
  providerId: string
  merchantAccountId: string
  effectiveFrom: string
  effectiveTo: string | null
  debitRate: number
  creditRate: number
  amexRate: number
  internationalRate: number
  fixedCostPerTransaction: number | null
  monthlyFee: number | null
  active: boolean
  proposalReference?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
  merchantAccount: {
    id: string
    alias?: string
    displayName?: string
    provider: {
      id: string
      code: string
      name: string
    }
  }
}

export interface VenuePaymentConfig {
  id: string
  venueId: string
  primaryAccountId: string
  secondaryAccountId?: string | null
  tertiaryAccountId?: string | null
  routingRules?: any
  preferredProcessor: string
  createdAt: string
  updatedAt: string
  venue: {
    id: string
    name: string
    slug: string
  }
  primaryAccount: MerchantAccount
  secondaryAccount?: MerchantAccount | null
  tertiaryAccount?: MerchantAccount | null
}

export interface VenuePricingStructure {
  id: string
  venueId: string
  accountType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY'
  effectiveFrom: string
  effectiveTo: string | null
  debitRate: number
  creditRate: number
  amexRate: number
  internationalRate: number
  fixedFeePerTransaction: number | null
  monthlyServiceFee: number | null
  active: boolean
  contractReference?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export interface ProfitMetrics {
  totalTransactions: number
  totalVolume: number
  averageTransactionSize: number
  byCardType: {
    type: string
    count: number
    volume: number
    avgSize: number
  }[]
  totalProviderCost: number
  totalVenueCharge: number
  totalProfit: number
  averageMargin: number
  topVenues: {
    venueId: string
    venueName: string
    transactions: number
    volume: number
    profit: number
    margin: number
  }[]
  topProviders: {
    providerId: string
    providerName: string
    transactions: number
    volume: number
    cost: number
    charge: number
    profit: number
  }[]
}

export interface VenueProfitMetrics extends ProfitMetrics {
  venue: {
    id: string
    name: string
    slug: string
  }
}

export interface ProfitTimeSeries {
  data: {
    date: string
    transactions: number
    volume: number
    providerCost: number
    venueCharge: number
    profit: number
    margin: number
  }[]
  granularity: 'daily' | 'weekly' | 'monthly'
}

export interface ProviderComparison {
  providers: {
    providerId: string
    providerName: string
    providerCode: string
    totalTransactions: number
    totalVolume: number
    averageTransactionSize: number
    totalCost: number
    totalCharge: number
    totalProfit: number
    averageMargin: number
    byCardType: {
      type: string
      count: number
      volume: number
      cost: number
      charge: number
      profit: number
    }[]
  }[]
  dateRange: {
    startDate: string
    endDate: string
  }
}

// ===== PAYMENT PROVIDER API FUNCTIONS =====

/**
 * Get all payment providers
 */
export async function getAllPaymentProviders(filters?: {
  type?: string
  active?: boolean
}): Promise<PaymentProvider[]> {
  const response = await api.get('/api/v1/dashboard/superadmin/payment-providers', { params: filters })
  return response.data.data
}

/**
 * Get payment provider by ID
 */
export async function getPaymentProvider(id: string): Promise<PaymentProvider> {
  const response = await api.get(`/api/v1/dashboard/superadmin/payment-providers/${id}`)
  return response.data.data
}

/**
 * Create payment provider
 */
export async function createPaymentProvider(data: {
  code: string
  name: string
  type: PaymentProvider['type']
  countryCode: string[]
  active?: boolean
  configSchema?: any
}): Promise<PaymentProvider> {
  const response = await api.post('/api/v1/dashboard/superadmin/payment-providers', data)
  return response.data.data
}

/**
 * Update payment provider
 */
export async function updatePaymentProvider(
  id: string,
  data: Partial<Omit<PaymentProvider, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<PaymentProvider> {
  const response = await api.put(`/api/v1/dashboard/superadmin/payment-providers/${id}`, data)
  return response.data.data
}

/**
 * Toggle payment provider active status
 */
export async function togglePaymentProviderStatus(id: string): Promise<PaymentProvider> {
  const response = await api.patch(`/api/v1/dashboard/superadmin/payment-providers/${id}/toggle`)
  return response.data.data
}

/**
 * Delete payment provider
 */
export async function deletePaymentProvider(id: string): Promise<void> {
  await api.delete(`/api/v1/dashboard/superadmin/payment-providers/${id}`)
}

// ===== MERCHANT ACCOUNT API FUNCTIONS =====

/**
 * Get all merchant accounts
 */
export async function getAllMerchantAccounts(filters?: {
  providerId?: string
  active?: boolean
}): Promise<MerchantAccount[]> {
  const response = await api.get('/api/v1/dashboard/superadmin/merchant-accounts', { params: filters })
  return response.data.data
}

/**
 * Get merchant accounts list (simplified for dropdowns)
 */
export async function getMerchantAccountsList(filters?: {
  providerId?: string
  active?: boolean
}): Promise<Pick<MerchantAccount, 'id' | 'displayName' | 'alias'>[]> {
  const response = await api.get('/api/v1/dashboard/superadmin/merchant-accounts/list', { params: filters })
  return response.data.data
}

/**
 * Get merchant account by ID
 */
export async function getMerchantAccount(id: string): Promise<MerchantAccount> {
  const response = await api.get(`/api/v1/dashboard/superadmin/merchant-accounts/${id}`)
  return response.data.data
}

/**
 * Get decrypted credentials for a merchant account (sensitive operation)
 */
export async function getMerchantAccountCredentials(id: string): Promise<MerchantAccountCredentials> {
  const response = await api.get(`/api/v1/dashboard/superadmin/merchant-accounts/${id}/credentials`)
  return response.data.data
}

/**
 * Create merchant account
 */
export async function createMerchantAccount(data: {
  providerId: string
  externalMerchantId: string
  alias?: string
  displayName?: string
  active?: boolean
  displayOrder?: number
  credentials: MerchantAccountCredentials
  providerConfig?: any
}): Promise<MerchantAccount> {
  const response = await api.post('/api/v1/dashboard/superadmin/merchant-accounts', data)
  return response.data.data
}

/**
 * Update merchant account
 */
export async function updateMerchantAccount(
  id: string,
  data: {
    externalMerchantId?: string
    alias?: string
    displayName?: string
    active?: boolean
    displayOrder?: number
    credentials?: Partial<MerchantAccountCredentials>
    providerConfig?: any
  }
): Promise<MerchantAccount> {
  const response = await api.put(`/api/v1/dashboard/superadmin/merchant-accounts/${id}`, data)
  return response.data.data
}

/**
 * Toggle merchant account status
 */
export async function toggleMerchantAccountStatus(id: string): Promise<MerchantAccount> {
  const response = await api.patch(`/api/v1/dashboard/superadmin/merchant-accounts/${id}/toggle`)
  return response.data.data
}

/**
 * Delete merchant account
 */
export async function deleteMerchantAccount(id: string): Promise<void> {
  await api.delete(`/api/v1/dashboard/superadmin/merchant-accounts/${id}`)
}

// ===== PROVIDER COST STRUCTURE API FUNCTIONS =====

/**
 * Get provider cost structures
 */
export async function getProviderCostStructures(filters?: {
  merchantAccountId?: string
  active?: boolean
}): Promise<ProviderCostStructure[]> {
  const response = await api.get('/api/v1/dashboard/superadmin/provider-cost-structures', { params: filters })
  return response.data.data
}

/**
 * Get provider cost structure by ID
 */
export async function getProviderCostStructure(id: string): Promise<ProviderCostStructure> {
  const response = await api.get(`/api/v1/dashboard/superadmin/provider-cost-structures/${id}`)
  return response.data.data
}

/**
 * Get active cost structure for a merchant account
 */
export async function getActiveCostStructure(merchantAccountId: string): Promise<ProviderCostStructure | null> {
  const response = await api.get(`/api/v1/dashboard/superadmin/provider-cost-structures/active/${merchantAccountId}`)
  return response.data.data
}

/**
 * Create provider cost structure
 */
export async function createProviderCostStructure(data: {
  merchantAccountId: string
  effectiveFrom: string
  debitRate: number
  creditRate: number
  amexRate: number
  internationalRate: number
  fixedCostPerTransaction?: number
  monthlyFee?: number
  proposalReference?: string
  notes?: string
}): Promise<ProviderCostStructure> {
  const response = await api.post('/api/v1/dashboard/superadmin/provider-cost-structures', data)
  return response.data.data
}

/**
 * Update provider cost structure
 */
export async function updateProviderCostStructure(
  id: string,
  data: Partial<Omit<ProviderCostStructure, 'id' | 'createdAt' | 'updatedAt' | 'merchantAccount'>>
): Promise<ProviderCostStructure> {
  const response = await api.put(`/api/v1/dashboard/superadmin/provider-cost-structures/${id}`, data)
  return response.data.data
}

/**
 * Deactivate provider cost structure
 */
export async function deactivateProviderCostStructure(id: string): Promise<ProviderCostStructure> {
  const response = await api.patch(`/api/v1/dashboard/superadmin/provider-cost-structures/${id}/deactivate`)
  return response.data.data
}

/**
 * Delete provider cost structure
 */
export async function deleteProviderCostStructure(id: string): Promise<void> {
  await api.delete(`/api/v1/dashboard/superadmin/provider-cost-structures/${id}`)
}

// ===== VENUE PRICING API FUNCTIONS =====

/**
 * Get venue payment configs
 */
export async function getVenuePaymentConfigs(filters?: {
  venueId?: string
}): Promise<VenuePaymentConfig[]> {
  const response = await api.get('/api/v1/dashboard/superadmin/venue-pricing/configs', { params: filters })
  return response.data.data
}

/**
 * Get venue payment config by ID
 */
export async function getVenuePaymentConfig(id: string): Promise<VenuePaymentConfig> {
  const response = await api.get(`/api/v1/dashboard/superadmin/venue-pricing/configs/${id}`)
  return response.data.data
}

/**
 * Create venue payment config
 */
export async function createVenuePaymentConfig(data: {
  venueId: string
  primaryAccountId: string
  secondaryAccountId?: string
  tertiaryAccountId?: string
  routingRules?: any
  preferredProcessor?: string
}): Promise<VenuePaymentConfig> {
  const response = await api.post('/api/v1/dashboard/superadmin/venue-pricing/configs', data)
  return response.data.data
}

/**
 * Update venue payment config
 */
export async function updateVenuePaymentConfig(
  id: string,
  data: Partial<Omit<VenuePaymentConfig, 'id' | 'venueId' | 'createdAt' | 'updatedAt' | 'venue' | 'primaryAccount' | 'secondaryAccount' | 'tertiaryAccount'>>
): Promise<VenuePaymentConfig> {
  const response = await api.put(`/api/v1/dashboard/superadmin/venue-pricing/configs/${id}`, data)
  return response.data.data
}

/**
 * Delete venue payment config
 */
export async function deleteVenuePaymentConfig(id: string): Promise<void> {
  await api.delete(`/api/v1/dashboard/superadmin/venue-pricing/configs/${id}`)
}

/**
 * Get venue pricing structures
 */
export async function getVenuePricingStructures(filters?: {
  venueId?: string
  accountType?: string
  active?: boolean
}): Promise<VenuePricingStructure[]> {
  const response = await api.get('/api/v1/dashboard/superadmin/venue-pricing/structures', { params: filters })
  return response.data.data
}

/**
 * Get venue pricing structure by ID
 */
export async function getVenuePricingStructure(id: string): Promise<VenuePricingStructure> {
  const response = await api.get(`/api/v1/dashboard/superadmin/venue-pricing/structures/${id}`)
  return response.data.data
}

/**
 * Get active pricing structure for a venue and account type
 */
export async function getActivePricingStructure(
  venueId: string,
  accountType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY'
): Promise<VenuePricingStructure | null> {
  try {
    const response = await api.get(`/api/v1/dashboard/superadmin/venue-pricing/structures/active/${venueId}/${accountType}`)
    return response.data.data
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null
    }
    throw error
  }
}

/**
 * Create venue pricing structure
 */
export async function createVenuePricingStructure(data: {
  venueId: string
  accountType: VenuePricingStructure['accountType']
  effectiveFrom: string
  debitRate: number
  creditRate: number
  amexRate: number
  internationalRate: number
  fixedFeePerTransaction?: number
  monthlyServiceFee?: number
  contractReference?: string
  notes?: string
}): Promise<VenuePricingStructure> {
  const response = await api.post('/api/v1/dashboard/superadmin/venue-pricing/structures', data)
  return response.data.data
}

/**
 * Update venue pricing structure
 */
export async function updateVenuePricingStructure(
  id: string,
  data: Partial<Omit<VenuePricingStructure, 'id' | 'venueId' | 'createdAt' | 'updatedAt'>>
): Promise<VenuePricingStructure> {
  const response = await api.put(`/api/v1/dashboard/superadmin/venue-pricing/structures/${id}`, data)
  return response.data.data
}

/**
 * Deactivate venue pricing structure
 */
export async function deactivateVenuePricingStructure(id: string): Promise<VenuePricingStructure> {
  const response = await api.patch(`/api/v1/dashboard/superadmin/venue-pricing/structures/${id}/deactivate`)
  return response.data.data
}

/**
 * Delete venue pricing structure
 */
export async function deleteVenuePricingStructure(id: string): Promise<void> {
  await api.delete(`/api/v1/dashboard/superadmin/venue-pricing/structures/${id}`)
}

// ===== VENUE-SPECIFIC PAYMENT CONFIG API FUNCTIONS =====
// These use the venue-scoped endpoints: /api/v1/dashboard/venues/:venueId/payment-config

/**
 * Get payment configuration for a specific venue (venue-scoped)
 */
export async function getVenuePaymentConfigByVenueId(venueId: string): Promise<VenuePaymentConfig | null> {
  try {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/payment-config`)
    return response.data.data
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null
    }
    throw error
  }
}

/**
 * Create payment configuration for a specific venue (venue-scoped)
 */
export async function createVenuePaymentConfigByVenueId(
  venueId: string,
  data: {
    primaryAccountId: string
    secondaryAccountId?: string
    tertiaryAccountId?: string
    routingRules?: any
    preferredProcessor?: string
  }
): Promise<VenuePaymentConfig> {
  const response = await api.post(`/api/v1/dashboard/venues/${venueId}/payment-config`, data)
  return response.data.data
}

/**
 * Update payment configuration for a specific venue (venue-scoped)
 */
export async function updateVenuePaymentConfigByVenueId(
  venueId: string,
  configId: string,
  data: {
    primaryAccountId?: string
    secondaryAccountId?: string
    tertiaryAccountId?: string
    routingRules?: any
    preferredProcessor?: string
  }
): Promise<VenuePaymentConfig> {
  const response = await api.put(`/api/v1/dashboard/venues/${venueId}/payment-config/${configId}`, data)
  return response.data.data
}

/**
 * Delete payment configuration for a specific venue (venue-scoped)
 */
export async function deleteVenuePaymentConfigByVenueId(venueId: string, configId: string): Promise<void> {
  await api.delete(`/api/v1/dashboard/venues/${venueId}/payment-config/${configId}`)
}

/**
 * Get merchant accounts for a specific venue (venue-scoped)
 */
export async function getVenueMerchantAccountsByVenueId(
  venueId: string
): Promise<(MerchantAccount & { accountType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY' })[]> {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/payment-config/merchant-accounts`)
  return response.data.data
}

/**
 * Get pricing structures for a specific venue (venue-scoped)
 */
export async function getVenuePricingStructuresByVenueId(venueId: string): Promise<VenuePricingStructure[]> {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/payment-config/pricing-structures`)
  return response.data.data
}

/**
 * Get cost structures for a specific venue's merchant accounts (venue-scoped)
 */
export async function getVenueCostStructuresByVenueId(
  venueId: string
): Promise<
  (ProviderCostStructure & {
    accountType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY'
    merchantAccount: {
      id: string
      displayName?: string
      alias?: string
    }
  })[]
> {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/payment-config/cost-structures`)
  return response.data.data
}

// ===== PAYMENT ANALYTICS API FUNCTIONS =====

/**
 * Get profit metrics
 */
export async function getProfitMetrics(params?: {
  startDate?: string
  endDate?: string
}): Promise<ProfitMetrics> {
  const response = await api.get('/api/v1/dashboard/superadmin/payment-analytics/profit-metrics', { params })
  return response.data.data
}

/**
 * Get venue profit metrics
 */
export async function getVenueProfitMetrics(
  venueId: string,
  params?: {
    startDate?: string
    endDate?: string
  }
): Promise<VenueProfitMetrics> {
  const response = await api.get(`/api/v1/dashboard/superadmin/payment-analytics/venue/${venueId}`, { params })
  return response.data.data
}

/**
 * Get profit time series
 */
export async function getProfitTimeSeries(params?: {
  startDate?: string
  endDate?: string
  granularity?: 'daily' | 'weekly' | 'monthly'
}): Promise<ProfitTimeSeries> {
  const response = await api.get('/api/v1/dashboard/superadmin/payment-analytics/time-series', { params })
  return response.data.data
}

/**
 * Get provider comparison
 */
export async function getProviderComparison(params?: {
  startDate?: string
  endDate?: string
}): Promise<ProviderComparison> {
  const response = await api.get('/api/v1/dashboard/superadmin/payment-analytics/provider-comparison', { params })
  return response.data.data
}

/**
 * Export profit data
 */
export async function exportProfitData(params?: {
  startDate?: string
  endDate?: string
  format?: 'json' | 'csv'
}): Promise<any> {
  const response = await api.get('/api/v1/dashboard/superadmin/payment-analytics/export', { params })
  return response.data.data
}

// Convenience API object for importing
export const paymentProviderAPI = {
  // Payment Providers
  getAllPaymentProviders,
  getPaymentProvider,
  createPaymentProvider,
  updatePaymentProvider,
  togglePaymentProviderStatus,
  deletePaymentProvider,

  // Merchant Accounts
  getAllMerchantAccounts,
  getMerchantAccountsList,
  getMerchantAccount,
  getMerchantAccountCredentials,
  createMerchantAccount,
  updateMerchantAccount,
  toggleMerchantAccountStatus,
  deleteMerchantAccount,

  // Provider Cost Structures
  getProviderCostStructures,
  getProviderCostStructure,
  getActiveCostStructure,
  createProviderCostStructure,
  updateProviderCostStructure,
  deactivateProviderCostStructure,
  deleteProviderCostStructure,

  // Venue Pricing (Superadmin Global)
  getVenuePaymentConfigs,
  getVenuePaymentConfig,
  createVenuePaymentConfig,
  updateVenuePaymentConfig,
  deleteVenuePaymentConfig,
  getVenuePricingStructures,
  getVenuePricingStructure,
  getActivePricingStructure,
  createVenuePricingStructure,
  updateVenuePricingStructure,
  deactivateVenuePricingStructure,
  deleteVenuePricingStructure,

  // Venue-Specific Payment Config (Venue-Scoped)
  getVenuePaymentConfigByVenueId,
  createVenuePaymentConfigByVenueId,
  updateVenuePaymentConfigByVenueId,
  deleteVenuePaymentConfigByVenueId,
  getVenueMerchantAccountsByVenueId,
  getVenuePricingStructuresByVenueId,
  getVenueCostStructuresByVenueId,

  // Payment Analytics
  getProfitMetrics,
  getVenueProfitMetrics,
  getProfitTimeSeries,
  getProviderComparison,
  exportProfitData,
}
