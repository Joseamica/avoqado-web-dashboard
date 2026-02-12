import api from '@/api'

// ===========================
// Types
// ===========================

export interface TpvMessage {
  id: string
  venueId: string
  type: 'ANNOUNCEMENT' | 'SURVEY' | 'ACTION'
  title: string
  body: string
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
  requiresAck: boolean
  surveyOptions?: string[]
  surveyMultiSelect: boolean
  actionLabel?: string
  actionType?: string
  actionPayload?: any
  targetType: 'ALL_TERMINALS' | 'SPECIFIC_TERMINALS'
  targetTerminalIds: string[]
  scheduledFor?: string
  expiresAt?: string
  createdBy: string
  createdByName: string
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED'
  createdAt: string
  updatedAt: string
  deliveries?: TpvMessageDelivery[]
  _count?: {
    responses: number
  }
}

export interface TpvMessageDelivery {
  id: string
  terminalId: string
  status: 'PENDING' | 'DELIVERED' | 'ACKNOWLEDGED' | 'DISMISSED'
  deliveredAt?: string
  acknowledgedAt?: string
  dismissedAt?: string
  acknowledgedBy?: string
  terminal?: {
    id: string
    name: string
    serialNumber?: string
    status?: string
  }
}

export interface TpvMessageResponse {
  id: string
  messageId: string
  terminalId: string
  selectedOptions: string[]
  respondedBy?: string
  respondedByName?: string
  createdAt: string
  terminal?: {
    id: string
    name: string
    serialNumber?: string
  }
}

export interface CreateTpvMessageRequest {
  type: 'ANNOUNCEMENT' | 'SURVEY' | 'ACTION'
  title: string
  body: string
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
  requiresAck?: boolean
  surveyOptions?: string[]
  surveyMultiSelect?: boolean
  actionLabel?: string
  actionType?: string
  actionPayload?: any
  targetType: 'ALL_TERMINALS' | 'SPECIFIC_TERMINALS'
  targetTerminalIds?: string[]
  scheduledFor?: string
  expiresAt?: string
}

// ===========================
// API Functions
// ===========================

export const createTpvMessage = async (venueId: string, data: CreateTpvMessageRequest) => {
  const response = await api.post(`/api/v1/dashboard/venues/${venueId}/messages`, data)
  return response.data
}

export const getTpvMessages = async (
  venueId: string,
  params?: { status?: string; type?: string; limit?: number; offset?: number },
) => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/messages`, { params })
  return response.data
}

export const getTpvMessage = async (venueId: string, messageId: string) => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/messages/${messageId}`)
  return response.data
}

export const getTpvMessageResponses = async (venueId: string, messageId: string) => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/messages/${messageId}/responses`)
  return response.data
}

export const cancelTpvMessage = async (venueId: string, messageId: string) => {
  const response = await api.delete(`/api/v1/dashboard/venues/${venueId}/messages/${messageId}`)
  return response.data
}
