/**
 * Organization Config Service
 * API calls for org-level configuration using orgId directly.
 * Used by the Organization Dashboard (/organizations/:orgId) pages.
 */
import api from '@/api'

// ===== ORG GOALS =====

export interface OrgGoal {
  id: string
  organizationId: string
  goal: number
  goalType: 'AMOUNT' | 'QUANTITY'
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY'
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateOrgGoalInput {
  goal: number
  goalType: 'AMOUNT' | 'QUANTITY'
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY'
}

export interface UpdateOrgGoalInput {
  goal?: number
  goalType?: 'AMOUNT' | 'QUANTITY'
  period?: 'DAILY' | 'WEEKLY' | 'MONTHLY'
  active?: boolean
}

export const getOrgGoals = async (orgId: string): Promise<OrgGoal[]> => {
  const response = await api.get(`/api/v1/dashboard/organizations/${orgId}/org-goals`)
  return response.data.data
}

export const createOrgGoal = async (orgId: string, data: CreateOrgGoalInput): Promise<OrgGoal> => {
  const response = await api.post(`/api/v1/dashboard/organizations/${orgId}/org-goals`, data)
  return response.data.data
}

export const updateOrgGoal = async (orgId: string, goalId: string, data: UpdateOrgGoalInput): Promise<OrgGoal> => {
  const response = await api.patch(`/api/v1/dashboard/organizations/${orgId}/org-goals/${goalId}`, data)
  return response.data.data
}

export const deleteOrgGoal = async (orgId: string, goalId: string): Promise<void> => {
  await api.delete(`/api/v1/dashboard/organizations/${orgId}/org-goals/${goalId}`)
}

// ===== ORG ATTENDANCE / TPV CONFIG =====

export interface OrgAttendanceConfig {
  id: string
  organizationId: string
  expectedCheckInTime: string
  latenessThresholdMinutes: number
  geofenceRadiusMeters: number
  attendanceTracking: boolean
  requireFacadePhoto: boolean
  requireDepositPhoto: boolean
  enableCashPayments: boolean
  enableCardPayments: boolean
  enableBarcodeScanner: boolean
  settings: Record<string, unknown> | null
}

export const getOrgAttendanceConfig = async (orgId: string): Promise<OrgAttendanceConfig | null> => {
  const response = await api.get(`/api/v1/dashboard/organizations/${orgId}/org-attendance-config`)
  return response.data.data
}

export const upsertOrgAttendanceConfig = async (orgId: string, data: Partial<OrgAttendanceConfig>): Promise<OrgAttendanceConfig> => {
  const response = await api.put(`/api/v1/dashboard/organizations/${orgId}/org-attendance-config`, data)
  return response.data.data
}

export const deleteOrgAttendanceConfig = async (orgId: string): Promise<void> => {
  await api.delete(`/api/v1/dashboard/organizations/${orgId}/org-attendance-config`)
}

export const getOrgTpvDefaults = async (orgId: string): Promise<Record<string, unknown> | null> => {
  const response = await api.get(`/api/v1/dashboard/organizations/${orgId}/org-tpv-defaults`)
  return response.data.data
}

export const upsertOrgTpvDefaults = async (orgId: string, settings: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const response = await api.put(`/api/v1/dashboard/organizations/${orgId}/org-tpv-defaults`, { settings })
  return response.data.data
}

export const getOrgTpvStats = async (orgId: string): Promise<Record<string, unknown>> => {
  const response = await api.get(`/api/v1/dashboard/organizations/${orgId}/org-tpv-defaults/stats`)
  return response.data.data
}

// ===== ORG ITEM CATEGORIES =====

export interface ItemCategory {
  id: string
  name: string
  description: string | null
  color: string | null
  sortOrder: number
  requiresPreRegistration: boolean
  suggestedPrice: number | null
  barcodePattern: string | null
  active: boolean
  createdAt: string
  updatedAt: string
  source?: 'venue' | 'organization'
  organizationId?: string
  totalItems?: number
  availableItems?: number
  soldItems?: number
}

export interface CreateItemCategoryDto {
  name: string
  description?: string
  color?: string
  sortOrder?: number
  requiresPreRegistration?: boolean
  suggestedPrice?: number
  barcodePattern?: string
}

export interface UpdateItemCategoryDto {
  name?: string
  description?: string
  color?: string
  sortOrder?: number
  requiresPreRegistration?: boolean
  suggestedPrice?: number
  barcodePattern?: string
  active?: boolean
}

export const getOrgCategories = async (orgId: string): Promise<ItemCategory[]> => {
  const response = await api.get(`/api/v1/dashboard/organizations/${orgId}/org-categories`)
  return response.data.data.categories
}

export const createOrgCategory = async (orgId: string, data: CreateItemCategoryDto): Promise<ItemCategory> => {
  const response = await api.post(`/api/v1/dashboard/organizations/${orgId}/org-categories`, data)
  return response.data.data
}

export const updateOrgCategory = async (orgId: string, categoryId: string, data: UpdateItemCategoryDto): Promise<ItemCategory> => {
  const response = await api.put(`/api/v1/dashboard/organizations/${orgId}/org-categories/${categoryId}`, data)
  return response.data.data
}

export const deleteOrgCategory = async (orgId: string, categoryId: string): Promise<{ deleted: boolean; message: string }> => {
  const response = await api.delete(`/api/v1/dashboard/organizations/${orgId}/org-categories/${categoryId}`)
  return response.data.data
}
