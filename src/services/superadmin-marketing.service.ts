/**
 * Superadmin Marketing Service
 *
 * API client for marketing campaigns and email templates.
 */

import api from '@/api'

// ===== TYPES =====

export type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
export type DeliveryStatus = 'PENDING' | 'SENT' | 'FAILED' | 'BOUNCED'

export interface EmailTemplate {
  id: string
  name: string
  subject: string
  bodyHtml: string
  bodyText: string
  createdAt: string
  updatedAt: string
  creator: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
  _count?: {
    campaigns: number
  }
}

export interface MarketingCampaign {
  id: string
  name: string
  subject: string
  bodyHtml: string
  bodyText: string
  templateId: string | null
  template: { id: string; name: string } | null
  targetAllVenues: boolean
  targetVenueIds: string[]
  includeStaff: boolean
  targetStaffRoles: string[]
  status: CampaignStatus
  scheduledFor: string | null
  startedAt: string | null
  completedAt: string | null
  totalRecipients: number
  sentCount: number
  failedCount: number
  openedCount: number
  clickedCount: number
  createdAt: string
  updatedAt: string
  creator: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
}

export interface CampaignDelivery {
  id: string
  campaignId: string
  recipientEmail: string
  recipientName: string | null
  venueId: string | null
  venueName: string | null
  isStaff: boolean
  status: DeliveryStatus
  sentAt: string | null
  error: string | null
  resendId: string | null
  openedAt: string | null
  clickedAt: string | null
  clickedLinks: string[]
}

export interface RecipientPreview {
  total: number
  venueCount: number
  staffCount: number
  recipients: Array<{
    email: string
    name: string
    venueId: string | null
    isStaff: boolean
  }>
}

// ===== TEMPLATE API =====

const BASE_PATH = '/api/v1/dashboard/superadmin/marketing'

export async function listTemplates(params: { search?: string; limit?: number; offset?: number } = {}) {
  const response = await api.get<{ success: boolean; templates: EmailTemplate[]; total: number }>(
    `${BASE_PATH}/templates`,
    { params },
  )
  return response.data
}

export async function getTemplate(id: string) {
  const response = await api.get<{ success: boolean; template: EmailTemplate }>(`${BASE_PATH}/templates/${id}`)
  return response.data.template
}

export async function createTemplate(data: { name: string; subject: string; bodyHtml: string; bodyText: string }) {
  const response = await api.post<{ success: boolean; template: EmailTemplate }>(`${BASE_PATH}/templates`, data)
  return response.data.template
}

export async function updateTemplate(id: string, data: Partial<{ name: string; subject: string; bodyHtml: string; bodyText: string }>) {
  const response = await api.patch<{ success: boolean; template: EmailTemplate }>(`${BASE_PATH}/templates/${id}`, data)
  return response.data.template
}

export async function deleteTemplate(id: string) {
  await api.delete(`${BASE_PATH}/templates/${id}`)
}

// ===== CAMPAIGN API =====

export async function listCampaigns(params: { search?: string; status?: CampaignStatus[]; limit?: number; offset?: number } = {}) {
  const response = await api.get<{ success: boolean; campaigns: MarketingCampaign[]; total: number }>(
    `${BASE_PATH}/campaigns`,
    { params },
  )
  return response.data
}

export async function getCampaign(id: string) {
  const response = await api.get<{ success: boolean; campaign: MarketingCampaign }>(`${BASE_PATH}/campaigns/${id}`)
  return response.data.campaign
}

export async function createCampaign(data: {
  name: string
  subject: string
  bodyHtml: string
  bodyText: string
  templateId?: string
  targetAllVenues: boolean
  targetVenueIds: string[]
  includeStaff: boolean
  targetStaffRoles: string[]
}) {
  const response = await api.post<{ success: boolean; campaign: MarketingCampaign }>(`${BASE_PATH}/campaigns`, data)
  return response.data.campaign
}

export async function updateCampaign(
  id: string,
  data: Partial<{
    name: string
    subject: string
    bodyHtml: string
    bodyText: string
    targetAllVenues: boolean
    targetVenueIds: string[]
    includeStaff: boolean
    targetStaffRoles: string[]
  }>,
) {
  const response = await api.patch<{ success: boolean; campaign: MarketingCampaign }>(
    `${BASE_PATH}/campaigns/${id}`,
    data,
  )
  return response.data.campaign
}

export async function deleteCampaign(id: string) {
  await api.delete(`${BASE_PATH}/campaigns/${id}`)
}

export async function bulkDeleteCampaigns(filters: {
  ids?: string[]
  status?: CampaignStatus[]
  createdAfter?: string
  createdBefore?: string
}) {
  const response = await api.delete<{ success: boolean; deletedCount: number }>(`${BASE_PATH}/campaigns/bulk`, {
    data: filters,
  })
  return response.data.deletedCount
}

export async function sendCampaign(id: string) {
  const response = await api.post<{ success: boolean; campaignId: string; totalRecipients: number }>(
    `${BASE_PATH}/campaigns/${id}/send`,
  )
  return response.data
}

export async function cancelCampaign(id: string) {
  await api.post(`${BASE_PATH}/campaigns/${id}/cancel`)
}

export async function getCampaignDeliveries(
  campaignId: string,
  params: { status?: DeliveryStatus[]; search?: string; limit?: number; offset?: number } = {},
) {
  const response = await api.get<{ success: boolean; deliveries: CampaignDelivery[]; total: number }>(
    `${BASE_PATH}/campaigns/${campaignId}/deliveries`,
    { params },
  )
  return response.data
}

// ===== RECIPIENT PREVIEW =====

export async function previewRecipients(data: {
  targetAllVenues: boolean
  targetVenueIds: string[]
  includeStaff: boolean
  targetStaffRoles: string[]
}) {
  const response = await api.post<{ success: boolean } & RecipientPreview>(`${BASE_PATH}/recipients/preview`, data)
  return response.data
}
