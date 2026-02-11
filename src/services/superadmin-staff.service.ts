import api from '@/api'

// ===========================================
// TYPES
// ===========================================

export interface StaffListItem {
  id: string
  email: string
  firstName: string
  lastName: string
  phone: string | null
  active: boolean
  emailVerified: boolean
  createdAt: string
  organizations: Array<{
    organizationId: string
    role: string
    isPrimary: boolean
    organization: { id: string; name: string }
  }>
  venues: Array<{
    venueId: string
    role: string
    pin: string | null
    venue: { id: string; name: string; slug: string }
  }>
}

export interface StaffDetail {
  id: string
  email: string
  firstName: string
  lastName: string
  phone: string | null
  active: boolean
  emailVerified: boolean
  createdAt: string
  updatedAt: string
  organizations: Array<{
    id: string
    organizationId: string
    role: string
    isPrimary: boolean
    isActive: boolean
    joinedAt: string
    organization: { id: string; name: string; slug: string | null }
  }>
  venues: Array<{
    id: string
    venueId: string
    role: string
    pin: string | null
    active: boolean
    startDate: string
    venue: {
      id: string
      name: string
      slug: string
      organizationId: string
      organization: { name: string }
    }
  }>
}

export interface StaffPagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface ListStaffParams {
  page?: number
  pageSize?: number
  search?: string
  active?: 'true' | 'false' | 'all'
  organizationId?: string
  venueId?: string
}

export interface CreateStaffData {
  email: string
  firstName: string
  lastName: string
  phone?: string
  password?: string
  organizationId: string
  orgRole: string
  venueId?: string
  venueRole?: string
  pin?: string
}

export interface UpdateStaffData {
  firstName?: string
  lastName?: string
  phone?: string | null
  active?: boolean
  emailVerified?: boolean
}

// ===========================================
// API FUNCTIONS
// ===========================================

const BASE = '/api/v1/dashboard/superadmin/staff'

export async function listStaff(params: ListStaffParams = {}): Promise<{
  staff: StaffListItem[]
  pagination: StaffPagination
}> {
  const response = await api.get(BASE, { params })
  return response.data
}

export async function getStaffById(staffId: string): Promise<StaffDetail> {
  const response = await api.get(`${BASE}/${staffId}`)
  return response.data.staff
}

export async function createStaff(data: CreateStaffData): Promise<StaffDetail> {
  const response = await api.post(BASE, data)
  return response.data.staff
}

export async function updateStaff(staffId: string, data: UpdateStaffData): Promise<StaffDetail> {
  const response = await api.patch(`${BASE}/${staffId}`, data)
  return response.data.staff
}

export async function assignToOrganization(
  staffId: string,
  organizationId: string,
  role: string,
): Promise<StaffDetail> {
  const response = await api.post(`${BASE}/${staffId}/organizations`, { organizationId, role })
  return response.data.staff
}

export async function removeFromOrganization(staffId: string, organizationId: string): Promise<StaffDetail> {
  const response = await api.delete(`${BASE}/${staffId}/organizations/${organizationId}`)
  return response.data.staff
}

export async function assignToVenue(
  staffId: string,
  venueId: string,
  role: string,
  pin?: string,
): Promise<StaffDetail> {
  const response = await api.post(`${BASE}/${staffId}/venues`, { venueId, role, pin })
  return response.data.staff
}

export async function updateVenueAssignment(
  staffId: string,
  venueId: string,
  data: { role?: string; pin?: string | null; active?: boolean },
): Promise<StaffDetail> {
  const response = await api.patch(`${BASE}/${staffId}/venues/${venueId}`, data)
  return response.data.staff
}

export async function removeFromVenue(staffId: string, venueId: string): Promise<StaffDetail> {
  const response = await api.delete(`${BASE}/${staffId}/venues/${venueId}`)
  return response.data.staff
}

export async function resetPassword(staffId: string, newPassword: string): Promise<{ success: boolean; message: string }> {
  const response = await api.post(`${BASE}/${staffId}/reset-password`, { newPassword })
  return response.data
}

export async function deleteStaff(staffId: string): Promise<{ success: boolean }> {
  const response = await api.delete(`${BASE}/${staffId}`)
  return response.data
}

export const staffAPI = {
  listStaff,
  getStaffById,
  createStaff,
  updateStaff,
  assignToOrganization,
  removeFromOrganization,
  assignToVenue,
  updateVenueAssignment,
  removeFromVenue,
  resetPassword,
  deleteStaff,
}
