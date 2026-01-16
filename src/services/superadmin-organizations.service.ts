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
}
