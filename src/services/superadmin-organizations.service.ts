import api from '@/api'

/**
 * Organization Types & Interfaces
 */
export type BusinessType = 'RESTAURANT' | 'RETAIL' | 'SERVICE' | 'ENTERTAINMENT' | 'HOSPITALITY' | 'HEALTHCARE' | 'OTHER'

export interface Organization {
  id: string
  name: string
  slug: string | null
  email: string
  phone: string
  taxId: string | null
  type: BusinessType
  createdAt: string
  updatedAt: string
  venueCount: number
  staffCount: number
  enabledModules: Array<{ code: string; name: string }>
}

export interface OrganizationDetail extends Omit<Organization, 'venueCount' | 'staffCount' | 'enabledModules'> {
  venues: Array<{
    id: string
    name: string
    slug: string
    status: string
    createdAt: string
  }>
  organizationModules: Array<{
    id: string
    moduleId: string
    enabled: boolean
    config: Record<string, any> | null
    enabledAt: string | null
    enabledBy: string | null
    module: {
      id: string
      code: string
      name: string
      description: string | null
      defaultConfig: Record<string, any> | null
      presets: Record<string, any> | null
    }
  }>
  _count: {
    venues: number
    staff: number
  }
}

export interface OrganizationSimple {
  id: string
  name: string
  slug: string | null
  venueCount: number
}

export interface ModuleForOrganization {
  id: string
  code: string
  name: string
  description: string | null
  defaultConfig: Record<string, any> | null
  presets: Record<string, any> | null
  enabled: boolean
  config: Record<string, any> | null
  enabledAt: string | null
}

export interface OrganizationModule {
  id: string
  organizationId: string
  moduleId: string
  enabled: boolean
  config: Record<string, any> | null
  enabledAt: string | null
  enabledBy: string | null
}

// ===========================================
// ORGANIZATION CRUD
// ===========================================

/**
 * Get all organizations with venue counts and module stats
 */
export async function getAllOrganizations(): Promise<Organization[]> {
  const response = await api.get('/api/v1/dashboard/superadmin/organizations')
  return response.data.organizations
}

/**
 * Get simplified list of organizations for dropdowns
 */
export async function getOrganizationsList(): Promise<OrganizationSimple[]> {
  const response = await api.get('/api/v1/dashboard/superadmin/organizations/list')
  return response.data.organizations
}

/**
 * Get organization by ID with full details
 */
export async function getOrganizationById(organizationId: string): Promise<OrganizationDetail> {
  const response = await api.get(`/api/v1/dashboard/superadmin/organizations/${organizationId}`)
  return response.data.organization
}

/**
 * Create a new organization
 */
export interface CreateOrganizationData {
  name: string
  slug?: string
  email: string
  phone: string
  taxId?: string
  type?: BusinessType
}

export async function createOrganization(data: CreateOrganizationData): Promise<{ organization: OrganizationDetail }> {
  const response = await api.post('/api/v1/dashboard/superadmin/organizations', data)
  return response.data
}

/**
 * Update an organization
 */
export interface UpdateOrganizationData {
  name?: string
  slug?: string | null
  email?: string
  phone?: string
  taxId?: string | null
  type?: BusinessType
}

export async function updateOrganization(
  organizationId: string,
  data: UpdateOrganizationData,
): Promise<{ organization: OrganizationDetail }> {
  const response = await api.patch(`/api/v1/dashboard/superadmin/organizations/${organizationId}`, data)
  return response.data
}

/**
 * Delete an organization (only if no venues exist)
 */
export async function deleteOrganization(organizationId: string): Promise<{
  success: boolean
  message: string
}> {
  const response = await api.delete(`/api/v1/dashboard/superadmin/organizations/${organizationId}`)
  return response.data
}

// ===========================================
// ORGANIZATION MODULE MANAGEMENT
// ===========================================

/**
 * Get all modules with their enablement status for an organization
 */
export async function getModulesForOrganization(organizationId: string): Promise<{
  organization: { id: string; name: string; slug: string | null }
  modules: ModuleForOrganization[]
}> {
  const response = await api.get(`/api/v1/dashboard/superadmin/organizations/${organizationId}/modules`)
  return response.data
}

/**
 * Enable a module for an organization (applies to all venues)
 */
export async function enableModuleForOrganization(
  organizationId: string,
  moduleCode: string,
  preset?: string,
  config?: Record<string, any>,
): Promise<{
  success: boolean
  message: string
  organizationModule: OrganizationModule
}> {
  const response = await api.post(`/api/v1/dashboard/superadmin/organizations/${organizationId}/modules/enable`, {
    moduleCode,
    preset,
    config,
  })
  return response.data
}

/**
 * Disable a module for an organization
 */
export async function disableModuleForOrganization(
  organizationId: string,
  moduleCode: string,
): Promise<{
  success: boolean
  message: string
  organizationModule: OrganizationModule
}> {
  const response = await api.post(`/api/v1/dashboard/superadmin/organizations/${organizationId}/modules/disable`, {
    moduleCode,
  })
  return response.data
}

/**
 * Update module configuration for an organization
 */
export async function updateOrganizationModuleConfig(
  organizationId: string,
  moduleCode: string,
  config: Record<string, any>,
): Promise<{
  success: boolean
  message: string
  organizationModule: OrganizationModule
}> {
  const response = await api.patch(`/api/v1/dashboard/superadmin/organizations/${organizationId}/modules/config`, {
    moduleCode,
    config,
  })
  return response.data
}

// ===========================================
// ORGANIZATION PAYMENT CONFIG
// ===========================================

export type AccountType = 'PRIMARY' | 'SECONDARY' | 'TERTIARY'
export type PaymentProcessor = 'LEGACY' | 'MENTA' | 'CLIP' | 'BANK_DIRECT' | 'AUTO'

export interface OrgPaymentConfigResponse {
  paymentConfig: {
    id: string
    organizationId: string
    primaryAccountId: string
    secondaryAccountId: string | null
    tertiaryAccountId: string | null
    routingRules: any
    preferredProcessor: PaymentProcessor
    primaryAccount: { id: string; displayName: string | null; provider: { code: string; name: string } }
    secondaryAccount: { id: string; displayName: string | null; provider: { code: string; name: string } } | null
    tertiaryAccount: { id: string; displayName: string | null; provider: { code: string; name: string } } | null
  } | null
  pricingStructures: OrgPricingStructure[]
  venueInheritance: VenueInheritanceItem[]
}

export interface OrgPricingStructure {
  id: string
  organizationId: string
  accountType: AccountType
  debitRate: number
  creditRate: number
  amexRate: number
  internationalRate: number
  fixedFeePerTransaction: number | null
  monthlyServiceFee: number | null
  effectiveFrom: string
  effectiveTo: string | null
  active: boolean
  contractReference: string | null
  notes: string | null
}

export interface VenueInheritanceItem {
  venueId: string
  venueName: string
  venueSlug: string
  paymentConfig: { source: 'venue' | 'organization' | 'none'; hasVenueOverride: boolean }
  pricing: { source: 'venue' | 'organization' | 'none'; hasVenueOverride: boolean }
}

export interface SetOrgPaymentConfigData {
  primaryAccountId: string
  secondaryAccountId?: string | null
  tertiaryAccountId?: string | null
  routingRules?: any
  preferredProcessor?: PaymentProcessor
}

export interface SetOrgPricingData {
  accountType: AccountType
  debitRate: number
  creditRate: number
  amexRate: number
  internationalRate: number
  fixedFeePerTransaction?: number | null
  monthlyServiceFee?: number | null
  minimumMonthlyVolume?: number | null
  volumePenalty?: number | null
  effectiveFrom: string
  effectiveTo?: string | null
  contractReference?: string | null
  notes?: string | null
}

/**
 * Get org payment config, pricing, and venue inheritance
 */
export async function getOrganizationPaymentConfig(organizationId: string): Promise<OrgPaymentConfigResponse> {
  const response = await api.get(`/api/v1/dashboard/superadmin/organizations/${organizationId}/payment-config`)
  return response.data
}

/**
 * Set/update org payment config (merchant accounts)
 */
export async function setOrganizationPaymentConfig(organizationId: string, data: SetOrgPaymentConfigData) {
  const response = await api.put(`/api/v1/dashboard/superadmin/organizations/${organizationId}/payment-config`, data)
  return response.data
}

/**
 * Delete org payment config
 */
export async function deleteOrganizationPaymentConfig(organizationId: string) {
  const response = await api.delete(`/api/v1/dashboard/superadmin/organizations/${organizationId}/payment-config`)
  return response.data
}

/**
 * Set/update org pricing structure
 */
export async function setOrganizationPricing(organizationId: string, data: SetOrgPricingData) {
  const response = await api.put(`/api/v1/dashboard/superadmin/organizations/${organizationId}/payment-config/pricing`, data)
  return response.data
}

/**
 * Delete (deactivate) a pricing structure
 */
export async function deleteOrganizationPricing(organizationId: string, pricingId: string) {
  const response = await api.delete(
    `/api/v1/dashboard/superadmin/organizations/${organizationId}/payment-config/pricing/${pricingId}`,
  )
  return response.data
}

/**
 * Get venue inheritance status list
 */
export async function getVenueInheritanceStatus(organizationId: string): Promise<VenueInheritanceItem[]> {
  const response = await api.get(`/api/v1/dashboard/superadmin/organizations/${organizationId}/payment-config/venues`)
  return response.data
}

/**
 * Convenience export
 */
export const organizationAPI = {
  // CRUD
  getAllOrganizations,
  getOrganizationsList,
  getOrganizationById,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  // Module Management
  getModulesForOrganization,
  enableModuleForOrganization,
  disableModuleForOrganization,
  updateOrganizationModuleConfig,
  // Payment Config
  getOrganizationPaymentConfig,
  setOrganizationPaymentConfig,
  deleteOrganizationPaymentConfig,
  setOrganizationPricing,
  deleteOrganizationPricing,
  getVenueInheritanceStatus,
}
