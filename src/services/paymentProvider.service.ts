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
  // Blumon-specific fields
  blumonSerialNumber?: string
  blumonPosId?: string
  blumonEnvironment?: string
  blumonMerchantId?: string
  // Bank account fields
  clabeNumber?: string
  bankName?: string
  accountHolder?: string
  _count?: {
    costStructures: number
    venueConfigs: number
    terminals: number
  }
}

export interface MerchantAccountCredentials {
  merchantId: string
  apiKey: string
  customerId?: string
  terminalId?: string
  [key: string]: any
}

// Simplified type for dropdown lists
export interface MerchantAccountListItem {
  id: string
  externalMerchantId: string
  displayName: string | null
  alias: string | null
  providerId: string
  providerName: string
  active: boolean
  environment: 'SANDBOX' | 'PRODUCTION' | null // Blumon environment
  hasCredentials?: boolean
  _count?: {
    costStructures: number
    venueConfigs: number
  }
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
export async function getAllPaymentProviders(filters?: { type?: string; active?: boolean }): Promise<PaymentProvider[]> {
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
  data: Partial<Omit<PaymentProvider, 'id' | 'createdAt' | 'updatedAt'>>,
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
export async function getAllMerchantAccounts(filters?: { providerId?: string; active?: boolean }): Promise<MerchantAccount[]> {
  const response = await api.get('/api/v1/dashboard/superadmin/merchant-accounts', { params: filters })
  return response.data.data
}

/**
 * Get merchant accounts list (simplified for dropdowns)
 * Includes providerName and environment for better UX
 */
export async function getMerchantAccountsList(filters?: {
  providerId?: string
  active?: boolean
}): Promise<MerchantAccountListItem[]> {
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
 *
 * For Blumon providers: credentials are optional if blumonSerialNumber is provided.
 * This allows creating "pending" accounts before Blumon affiliation is complete.
 */
export async function createMerchantAccount(data: {
  providerId: string
  externalMerchantId: string
  alias?: string
  displayName?: string
  active?: boolean
  displayOrder?: number
  // Credentials are optional for Blumon pending accounts (serial number required instead)
  credentials?: MerchantAccountCredentials
  providerConfig?: any
  // Blumon-specific fields (for creating pending accounts before affiliation)
  blumonSerialNumber?: string
  blumonEnvironment?: 'SANDBOX' | 'PRODUCTION'
  blumonMerchantId?: string
}): Promise<MerchantAccount> {
  const response = await api.post('/api/v1/dashboard/superadmin/merchant-accounts', data)
  return response.data.data
}

/**
 * Auto-fetch Blumon credentials via OAuth flow
 *
 * Simplified merchant account creation for Blumon:
 * - Only requires: serialNumber, brand, model
 * - Backend automatically fetches: OAuth tokens, RSA keys, DUKPT keys
 * - Credentials are encrypted before storage
 *
 * MCC Lookup Priority for auto-creating ProviderCostStructure:
 * 1. PRIORITY: venue.type (automatically fetched from terminal's venue)
 * 2. FALLBACK: businessCategory (manual giro input)
 *
 * @param data Blumon device information
 * @returns Created merchant account with auto-fetched credentials
 */
export async function autoFetchBlumonCredentials(data: {
  serialNumber: string
  brand: string
  model: string
  displayName?: string
  environment?: 'SANDBOX' | 'PRODUCTION'
  businessCategory?: string // FALLBACK: Manual giro for MCC lookup (venue.type is auto-detected)
  skipCostStructure?: boolean // If true, skip automatic cost structure creation (user will configure later)
}): Promise<{
  id: string
  serialNumber: string
  posId: string
  displayName: string
  blumonEnvironment: string
  dukptKeysAvailable: boolean
  alreadyExists?: boolean // True if account already existed
  autoAttached?: {
    terminalIds: string[]
    terminals: Array<{ id: string; name: string | null }>
    count: number
  }
  costStructure?: {
    id: string
    debitRate: string
    creditRate: string
    amexRate: string
    internationalRate: string
  } | null
  mccLookup?: {
    found: boolean
    mcc: string | null
    familia: string | null
    rates: {
      credito: number
      debito: number
      internacional: number
      amex: number
    } | null
    confidence: number
  } | null
}> {
  const response = await api.post('/api/v1/superadmin/merchant-accounts/blumon/auto-fetch', data)
  return response.data.data
}

/**
 * Batch auto-fetch Blumon credentials for multiple terminals
 *
 * This is a SEPARATE endpoint that processes multiple serials in parallel.
 * Each serial gets its own MerchantAccount with unique OAuth/DUKPT credentials.
 *
 * Use case: 10 terminals shipped to Cancún, all need MerchantAccounts created at once.
 *
 * @param data Batch of terminals to process
 * @returns Results for each terminal (success/failure)
 */
export async function batchAutoFetchBlumonCredentials(data: {
  terminals: Array<{
    serialNumber: string
    brand: string
    model: string
  }>
  environment?: 'SANDBOX' | 'PRODUCTION'
  displayNamePrefix?: string
  skipCostStructure?: boolean
  settlementConfig?: {
    enabled: boolean
    dayType: 'BUSINESS_DAYS' | 'CALENDAR_DAYS'
    cutoffTime: string
    cutoffTimezone: string
    debitDays: number
    creditDays: number
    amexDays: number
    internationalDays: number
    otherDays: number
  }
}): Promise<{
  total: number
  successful: number
  failed: number
  alreadyExisted: number
  results: Array<{
    serialNumber: string
    success: boolean
    accountId?: string
    displayName?: string | null
    posId?: string | null
    terminalsAttached?: number
    settlementConfigsCreated?: number
    alreadyExists?: boolean
    error?: string
  }>
}> {
  const response = await api.post('/api/v1/superadmin/merchant-accounts/blumon/batch-auto-fetch', data)
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
  },
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

/**
 * Get terminals that have a merchant account assigned
 */
export interface TerminalWithVenue {
  id: string
  name: string
  serialNumber: string
  venue: {
    id: string
    name: string
    slug: string
  }
}

export async function getTerminalsByMerchantAccount(merchantAccountId: string): Promise<TerminalWithVenue[]> {
  const response = await api.get(`/api/v1/dashboard/superadmin/merchant-accounts/${merchantAccountId}/terminals`)
  return response.data.data
}

/**
 * Remove merchant account from a terminal
 */
export async function removeMerchantFromTerminal(merchantAccountId: string, terminalId: string): Promise<void> {
  await api.delete(`/api/v1/dashboard/superadmin/merchant-accounts/${merchantAccountId}/terminals/${terminalId}`)
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
 * Get provider cost structures by merchant account ID
 * Convenience wrapper for getProviderCostStructures with merchantAccountId filter
 */
export async function getProviderCostStructuresByMerchantAccount(
  merchantAccountId: string,
): Promise<ProviderCostStructure[]> {
  return getProviderCostStructures({ merchantAccountId })
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
  data: Partial<Omit<ProviderCostStructure, 'id' | 'createdAt' | 'updatedAt' | 'merchantAccount'>>,
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
/**
 * Get venue payment config by venue ID
 * Backend endpoint: GET /api/v1/dashboard/superadmin/venue-pricing/config/:venueId
 */
export async function getVenuePaymentConfig(venueId: string): Promise<VenuePaymentConfig | null> {
  try {
    const response = await api.get(`/api/v1/dashboard/superadmin/venue-pricing/config/${venueId}`)
    return response.data.data
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null // No config exists yet
    }
    throw error
  }
}

/**
 * Create venue payment config
 * Backend endpoint: POST /api/v1/dashboard/superadmin/venue-pricing/config
 */
export async function createVenuePaymentConfig(data: {
  venueId: string
  primaryAccountId: string
  secondaryAccountId?: string
  tertiaryAccountId?: string
  routingRules?: any
  preferredProcessor?: string
}): Promise<VenuePaymentConfig> {
  const response = await api.post('/api/v1/dashboard/superadmin/venue-pricing/config', data)
  return response.data.data
}

/**
 * Update venue payment config
 * Backend endpoint: PUT /api/v1/dashboard/superadmin/venue-pricing/config/:venueId
 */
export async function updateVenuePaymentConfig(
  venueId: string,
  data: {
    primaryAccountId?: string
    secondaryAccountId?: string | null
    tertiaryAccountId?: string | null
    routingRules?: any
    preferredProcessor?: string
  },
): Promise<VenuePaymentConfig> {
  const response = await api.put(`/api/v1/dashboard/superadmin/venue-pricing/config/${venueId}`, data)
  return response.data.data
}

/**
 * Delete venue payment config (not implemented in backend yet)
 */
export async function deleteVenuePaymentConfig(venueId: string): Promise<void> {
  await api.delete(`/api/v1/dashboard/superadmin/venue-pricing/config/${venueId}`)
}

/**
 * Legacy function - kept for compatibility
 * Use getVenuePaymentConfig(venueId) instead
 */
export async function getVenuePaymentConfigs(filters?: { venueId?: string }): Promise<VenuePaymentConfig[]> {
  if (filters?.venueId) {
    const config = await getVenuePaymentConfig(filters.venueId)
    return config ? [config] : []
  }
  // Backend doesn't support listing all configs, return empty array
  return []
}

/**
 * Get all venue payment configs that reference a specific merchant account
 * This is useful for dependency checking before deleting a merchant account
 * Note: This requires a backend endpoint that supports this query
 */
export async function getVenueConfigsByMerchantAccount(
  merchantAccountId: string,
): Promise<(VenuePaymentConfig & { accountType: string })[]> {
  try {
    const response = await api.get(`/api/v1/dashboard/superadmin/venue-pricing/configs-by-merchant/${merchantAccountId}`)
    return response.data.data
  } catch (error: any) {
    // If endpoint doesn't exist yet, return empty array
    if (error.response?.status === 404) {
      console.warn('getVenueConfigsByMerchantAccount endpoint not implemented yet')
      return []
    }
    throw error
  }
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
  accountType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY',
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
  data: Partial<Omit<VenuePricingStructure, 'id' | 'venueId' | 'createdAt' | 'updatedAt'>>,
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
  },
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
  },
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
  venueId: string,
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
export async function getVenueCostStructuresByVenueId(venueId: string): Promise<
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

// ===== MCC LOOKUP API FUNCTIONS =====

export interface MccLookupResult {
  found: boolean
  mcc: string | null
  familia: string | null
  rates: {
    credito: number
    debito: number
    internacional: number
    amex: number
  } | null
  confidence: number
  matchType?: string
  matchedTerm?: string
  nota?: string
}

/**
 * Get MCC rate suggestion for a business name
 * Uses Blumon MCC lookup service to find rates based on business category
 *
 * @param businessName - Business name or category (e.g., "Restaurante", "Gimnasio")
 * @returns MCC lookup result with rates
 */
export async function getMccRateSuggestion(businessName: string): Promise<MccLookupResult> {
  const response = await api.get('/api/v1/superadmin/merchant-accounts/mcc-lookup', {
    params: { businessName },
  })
  return response.data.data
}

// ===== PAYMENT ANALYTICS API FUNCTIONS =====

/**
 * Get profit metrics
 */
export async function getProfitMetrics(params?: { startDate?: string; endDate?: string }): Promise<ProfitMetrics> {
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
  },
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
export async function getProviderComparison(params?: { startDate?: string; endDate?: string }): Promise<ProviderComparison> {
  const response = await api.get('/api/v1/dashboard/superadmin/payment-analytics/provider-comparison', { params })
  return response.data.data
}

/**
 * Export profit data
 */
export async function exportProfitData(params?: { startDate?: string; endDate?: string; format?: 'json' | 'csv' }): Promise<any> {
  const response = await api.get('/api/v1/dashboard/superadmin/payment-analytics/export', { params })
  return response.data.data
}

// ===== PAYMENT READINESS TYPES & API =====

export interface PaymentReadinessChecklistItem {
  status: 'ok' | 'pending' | 'missing' | 'default'
  details?: string
}

export interface TerminalInfo {
  id: string
  serialNumber: string | null
  name: string
  brand: string | null
  model: string | null
  assignedMerchantIds: string[]
}

export interface MerchantAccountInfo {
  id: string
  displayName: string | null
  providerId: string
  blumonSerialNumber: string | null
  clabeNumber: string | null
}

export interface PaymentReadinessResponse {
  ready: boolean
  venueId: string
  venueSlug: string
  venueName: string
  venueType: string

  checklist: {
    kycApproved: PaymentReadinessChecklistItem
    terminalRegistered: PaymentReadinessChecklistItem & { terminals?: TerminalInfo[] }
    merchantAccountCreated: PaymentReadinessChecklistItem & { account?: MerchantAccountInfo }
    terminalMerchantLinked: PaymentReadinessChecklistItem
    venuePaymentConfigured: PaymentReadinessChecklistItem
    pricingStructureSet: PaymentReadinessChecklistItem & { isDefault?: boolean }
    providerCostStructureSet: PaymentReadinessChecklistItem
    clabeProvided: PaymentReadinessChecklistItem & { masked?: string }
  }

  blockingItems: string[]
  nextAction: string
  canProcessPayments: boolean
}

export interface MultipleVenuesPaymentReadinessResponse {
  ready: PaymentReadinessResponse[]
  pending: PaymentReadinessResponse[]
  summary: {
    total: number
    ready: number
    pending: number
  }
}

/**
 * Get payment readiness status for a specific venue
 * Backend endpoint: GET /api/v1/dashboard/venues/:venueId/payment-config/readiness
 */
export async function getVenuePaymentReadiness(venueId: string): Promise<PaymentReadinessResponse> {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/payment-config/readiness`)
  return response.data.data
}

/**
 * Get payment readiness status for multiple venues (superadmin)
 * Backend endpoint: GET /api/v1/dashboard/superadmin/payment-readiness
 */
export async function getMultipleVenuesPaymentReadiness(
  venueIds?: string[],
): Promise<MultipleVenuesPaymentReadinessResponse> {
  const params = venueIds ? { venueIds: venueIds.join(',') } : undefined
  const response = await api.get('/api/v1/dashboard/superadmin/payment-readiness', { params })
  return response.data.data
}

// ===== PAYMENT SETUP WIZARD =====

export interface FullSetupRequest {
  serialNumber: string
  brand: string
  model: string
  displayName?: string
  environment: 'SANDBOX' | 'PRODUCTION'
  businessCategory?: string
  additionalTerminalIds?: string[]
  costStructureOverrides?: {
    debitRate: number
    creditRate: number
    amexRate: number
    internationalRate: number
    fixedCostPerTransaction?: number
    monthlyFee?: number
  }
  target: { type: 'venue'; id: string } | { type: 'organization'; id: string }
  accountSlot: 'PRIMARY' | 'SECONDARY' | 'TERTIARY'
  venuePricing?: {
    debitRate: number
    creditRate: number
    amexRate: number
    internationalRate: number
    fixedFeePerTransaction?: number
    monthlyServiceFee?: number
  }
  settlementConfig?: {
    dayType: 'BUSINESS_DAYS' | 'CALENDAR_DAYS'
    cutoffTime: string
    cutoffTimezone: string
    debitDays: number
    creditDays: number
    amexDays: number
    internationalDays: number
    otherDays: number
  }
}

export interface FullSetupResponse {
  merchantAccount: {
    id: string
    displayName: string | null
    created: boolean
    alreadyExisted: boolean
  }
  terminals: {
    autoAttached: number
    batchAttached: number
    total: number
  }
  costStructure: { id: string } | null
  paymentConfig: { id: string; slot: string } | null
  pricingStructure: { id: string } | null
  settlements: { created: number }
}

export interface PaymentSetupSummary {
  targetType: 'venue' | 'organization'
  targetId: string
  config: any
  terminals: any[]
  pricingStructures: any[]
  venues?: any[]
}

/**
 * Complete payment setup wizard — orchestrates everything in one call
 * Backend endpoint: POST /api/v1/superadmin/merchant-accounts/blumon/full-setup
 */
export async function fullSetupBlumonMerchant(data: FullSetupRequest): Promise<FullSetupResponse> {
  const response = await api.post('/api/v1/superadmin/merchant-accounts/blumon/full-setup', data)
  return response.data.data
}

/**
 * Batch assign terminals to a merchant account
 * Backend endpoint: POST /api/v1/superadmin/merchant-accounts/:id/batch-assign-terminals
 */
export async function batchAssignTerminals(
  merchantAccountId: string,
  terminalIds: string[],
): Promise<{ attached: number; alreadyAttached: number; errors: string[] }> {
  const response = await api.post(`/api/v1/superadmin/merchant-accounts/${merchantAccountId}/batch-assign-terminals`, {
    terminalIds,
  })
  return response.data.data
}

/**
 * Get full payment setup summary for wizard pre-fill
 * Backend endpoint: GET /api/v1/superadmin/merchant-accounts/payment-setup/summary
 */
export async function getPaymentSetupSummary(
  targetType: 'venue' | 'organization',
  targetId: string,
): Promise<PaymentSetupSummary> {
  const response = await api.get('/api/v1/superadmin/merchant-accounts/payment-setup/summary', {
    params: { targetType, targetId },
  })
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
  autoFetchBlumonCredentials, // Blumon-specific auto-fetch (single terminal)
  batchAutoFetchBlumonCredentials, // Blumon batch auto-fetch (multiple terminals)
  updateMerchantAccount,
  toggleMerchantAccountStatus,
  deleteMerchantAccount,
  getTerminalsByMerchantAccount,
  removeMerchantFromTerminal,

  // Provider Cost Structures
  getProviderCostStructures,
  getProviderCostStructuresByMerchantAccount,
  getProviderCostStructure,
  getActiveCostStructure,
  createProviderCostStructure,
  updateProviderCostStructure,
  deactivateProviderCostStructure,
  deleteProviderCostStructure,

  // Venue Pricing (Superadmin Global)
  getVenuePaymentConfigs,
  getVenuePaymentConfig,
  getVenueConfigsByMerchantAccount,
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

  // Payment Readiness
  getVenuePaymentReadiness,
  getMultipleVenuesPaymentReadiness,

  // MCC Lookup
  getMccRateSuggestion,

  // Payment Setup Wizard
  fullSetupBlumonMerchant,
  batchAssignTerminals,
  getPaymentSetupSummary,
}
