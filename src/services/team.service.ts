import api from '@/api'
import { StaffRole } from '@/types'

// Team Member interfaces
export interface TeamMember {
  id: string
  staffId: string // The Staff table ID (for order references like servedById, createdById)
  firstName: string
  lastName: string
  email: string
  role: StaffRole
  active: boolean
  startDate: string
  endDate: string | null
  pin: string | null
  totalSales: number
  totalTips: number
  totalOrders: number
  averageRating: number
}

export interface TeamMemberDetails extends TeamMember {
  venue: {
    id: string
    name: string
    organization: {
      name: string
    }
  }
}

export interface PaginatedTeamResponse {
  data: TeamMember[]
  meta: {
    totalCount: number
    pageSize: number
    currentPage: number
    totalPages: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
}

export interface Invitation {
  id: string
  email: string
  role: StaffRole
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'REVOKED'
  expiresAt: string
  createdAt: string
  message?: string
  isExpired?: boolean
  invitedBy: {
    name: string
  }
}

// Request DTOs
export interface InviteTeamMemberRequest {
  email: string
  firstName: string
  lastName: string
  role: StaffRole
  message?: string
}

export interface UpdateTeamMemberRequest {
  role?: StaffRole
  active?: boolean
  pin?: string | null
}

export interface InviteTeamMemberResponse {
  message: string
  invitation: {
    id: string
    email: string
    role: StaffRole
    status: string
    expiresAt: string
    createdAt: string
  }
  emailSent: boolean
}

// Team Management Service
export const teamService = {
  // Get team members with pagination and search
  async getTeamMembers(
    venueId: string,
    page: number = 1,
    pageSize: number = 10,
    search?: string,
  ): Promise<PaginatedTeamResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    })
    
    if (search) {
      params.append('search', search)
    }

    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/team?${params}`)
    return response.data
  },

  // Get specific team member details
  async getTeamMember(venueId: string, teamMemberId: string): Promise<TeamMemberDetails> {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/team/${teamMemberId}`)
    return response.data
  },

  // Invite new team member
  async inviteTeamMember(
    venueId: string,
    invitation: InviteTeamMemberRequest,
  ): Promise<InviteTeamMemberResponse> {
    const response = await api.post(`/api/v1/dashboard/venues/${venueId}/team`, invitation)
    return response.data
  },

  // Update team member
  async updateTeamMember(
    venueId: string,
    teamMemberId: string,
    updates: UpdateTeamMemberRequest,
  ): Promise<{ message: string; data: TeamMember }> {
    const response = await api.patch(`/api/v1/dashboard/venues/${venueId}/team/${teamMemberId}`, updates)
    return response.data
  },

  // Remove team member (soft delete - deactivate)
  async removeTeamMember(venueId: string, teamMemberId: string): Promise<{ message: string }> {
    const response = await api.delete(`/api/v1/dashboard/venues/${venueId}/team/${teamMemberId}`)
    return response.data
  },

  // Hard delete team member (SUPERADMIN only - permanently deletes all data)
  async hardDeleteTeamMember(
    venueId: string,
    teamMemberId: string,
  ): Promise<{ message: string; deletedRecords: Record<string, number> }> {
    const response = await api.delete(`/api/v1/dashboard/venues/${venueId}/team/${teamMemberId}/hard-delete`, {
      data: { confirmDeletion: true },
    })
    return response.data
  },

  // Get pending invitations
  async getPendingInvitations(venueId: string): Promise<{ data: Invitation[] }> {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/team/invitations`)
    return response.data
  },

  // Cancel invitation
  async cancelInvitation(venueId: string, invitationId: string): Promise<{ message: string }> {
    const response = await api.delete(`/api/v1/dashboard/venues/${venueId}/team/invitations/${invitationId}`)
    return response.data
  },

  // Resend invitation
  async resendInvitation(venueId: string, invitationId: string): Promise<{ message: string }> {
    const response = await api.post(`/api/v1/dashboard/venues/${venueId}/team/invitations/${invitationId}/resend`)
    return response.data
  },
}

export default teamService