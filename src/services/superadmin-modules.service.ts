import api from '@/api'

/**
 * Module Types & Interfaces
 */
export interface Module {
  id: string
  code: string
  name: string
  description: string | null
  defaultConfig: Record<string, any> | null
  presets: Record<string, any> | null
  enabledVenueCount: number
  createdAt: string
  updatedAt: string
}

export interface VenueModuleStatus {
  id: string
  name: string
  slug: string
  moduleEnabled: boolean
  moduleConfig: Record<string, any> | null
  enabledAt: string | null
}

export interface VenueModule {
  id: string
  venueId: string
  moduleId: string
  enabled: boolean
  config: Record<string, any> | null
  enabledAt: string | null
  enabledBy: string | null
}

export interface ModuleForVenue {
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

export interface Venue {
  id: string
  name: string
  slug: string
}

export interface VenueModuleInOrg {
  id: string
  name: string
  slug: string
  moduleEnabled: boolean
  hasExplicitOverride: boolean
  isInherited: boolean
  venueModuleConfig: Record<string, any> | null
  enabledAt: string | null
}

export interface OrganizationModuleGroup {
  id: string
  name: string
  slug: string | null
  venueCount: number
  orgModuleEnabled: boolean
  orgModuleConfig: Record<string, any> | null
  orgModuleEnabledAt: string | null
  venues: VenueModuleInOrg[]
}

/**
 * Get all global modules with stats
 *
 * @returns List of modules with enabled venue counts
 */
export async function getAllModules(): Promise<Module[]> {
  const response = await api.get('/api/v1/dashboard/superadmin/modules')
  return response.data.modules
}

/**
 * Get all venues with their enablement status for a specific module
 *
 * @param moduleCode Module code (e.g., 'SERIALIZED_INVENTORY')
 * @returns Module info and list of venues with status
 */
export async function getVenuesForModule(moduleCode: string): Promise<{
  module: Module
  venues: VenueModuleStatus[]
}> {
  const response = await api.get(`/api/v1/dashboard/superadmin/modules/${moduleCode}/venues`)
  return response.data
}

/**
 * Get all modules with their enablement status for a specific venue
 *
 * @param venueId Venue ID
 * @returns Venue info and list of modules with status
 */
export async function getModulesForVenue(venueId: string): Promise<{
  venue: Venue
  modules: ModuleForVenue[]
}> {
  const response = await api.get(`/api/v1/dashboard/superadmin/modules/venues/${venueId}`)
  return response.data
}

/**
 * Enable a module for a venue
 *
 * @param venueId Venue ID
 * @param moduleCode Module code
 * @param preset Optional preset name (e.g., 'telecom', 'jewelry')
 * @returns Success response with venueModule
 */
export async function enableModule(
  venueId: string,
  moduleCode: string,
  preset?: string,
): Promise<{
  success: boolean
  message: string
  venueModule: VenueModule
}> {
  const response = await api.post('/api/v1/dashboard/superadmin/modules/enable', {
    venueId,
    moduleCode,
    preset,
  })
  return response.data
}

/**
 * Disable a module for a venue
 *
 * @param venueId Venue ID
 * @param moduleCode Module code
 * @returns Success response with venueModule
 */
export async function disableModule(
  venueId: string,
  moduleCode: string,
): Promise<{
  success: boolean
  message: string
  venueModule: VenueModule
}> {
  const response = await api.post('/api/v1/dashboard/superadmin/modules/disable', {
    venueId,
    moduleCode,
  })
  return response.data
}

/**
 * Update module configuration for a venue
 *
 * @param venueId Venue ID
 * @param moduleCode Module code (e.g., 'WHITE_LABEL_DASHBOARD')
 * @param config Configuration object to merge
 * @returns Success response with updated venueModule
 */
export async function updateModuleConfig(
  venueId: string,
  moduleCode: string,
  config: Record<string, any>,
): Promise<{
  success: boolean
  message: string
  venueModule: VenueModule
}> {
  const response = await api.patch('/api/v1/dashboard/superadmin/modules/config', {
    venueId,
    moduleCode,
    config,
  })
  return response.data
}

/**
 * Create a new global module
 *
 * @param data Module data
 * @returns Created module
 */
export interface CreateModuleData {
  code: string
  name: string
  description?: string
  defaultConfig?: Record<string, any>
  presets?: Record<string, any>
}

export async function createModule(data: CreateModuleData): Promise<{ module: Module }> {
  const response = await api.post('/api/v1/dashboard/superadmin/modules', data)
  return response.data
}

/**
 * Update a global module
 *
 * @param moduleId Module ID
 * @param data Module data to update
 * @returns Updated module
 */
export interface UpdateModuleData {
  name?: string
  description?: string | null
  defaultConfig?: Record<string, any>
  presets?: Record<string, any>
}

export async function updateModule(moduleId: string, data: UpdateModuleData): Promise<{ module: Module }> {
  const response = await api.patch(`/api/v1/dashboard/superadmin/modules/${moduleId}`, data)
  return response.data
}

/**
 * Delete a global module
 *
 * @param moduleId Module ID
 * @returns Success response
 */
export async function deleteModule(moduleId: string): Promise<{
  success: boolean
  message: string
}> {
  const response = await api.delete(`/api/v1/dashboard/superadmin/modules/${moduleId}`)
  return response.data
}

/**
 * Get all venues grouped by organization with org-level module status
 *
 * @param moduleCode Module code (e.g., 'WHITE_LABEL_DASHBOARD')
 * @returns Module info and organizations with grouped venues
 */
export async function getVenuesForModuleGrouped(moduleCode: string): Promise<{
  module: Module
  organizations: OrganizationModuleGroup[]
}> {
  const response = await api.get(`/api/v1/dashboard/superadmin/modules/${moduleCode}/venues?grouped=true`)
  return response.data
}

/**
 * Delete a VenueModule override so venue falls back to org-level inheritance
 *
 * @param venueId Venue ID
 * @param moduleCode Module code
 * @returns Success response
 */
export async function deleteVenueModuleOverride(
  venueId: string,
  moduleCode: string,
): Promise<{
  success: boolean
  message: string
}> {
  const response = await api.delete('/api/v1/dashboard/superadmin/modules/venue-override', {
    data: { venueId, moduleCode },
  })
  return response.data
}

/**
 * Convenience export
 */
export const moduleAPI = {
  getAllModules,
  getVenuesForModule,
  getVenuesForModuleGrouped,
  getModulesForVenue,
  enableModule,
  disableModule,
  updateModuleConfig,
  deleteVenueModuleOverride,
  createModule,
  updateModule,
  deleteModule,
}
