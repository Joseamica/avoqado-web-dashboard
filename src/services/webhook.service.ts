/**
 * Webhook Monitoring Service (Frontend)
 *
 * API client for SUPERADMIN webhook monitoring endpoints
 */

import api from '@/api'

export interface WebhookEvent {
  id: string
  stripeEventId: string
  eventType: string
  payload: any // Full Stripe event payload
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'RETRYING'
  errorMessage?: string | null
  processingTime?: number | null
  retryCount: number
  venueId?: string | null
  venue?: {
    id: string
    name: string
    slug: string
  } | null
  createdAt: string
  processedAt?: string | null
}

export interface WebhookListResponse {
  events: WebhookEvent[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export interface WebhookMetrics {
  summary: {
    totalEvents: number
    successCount: number
    failedCount: number
    pendingCount: number
    successRate: number
    avgProcessingTime: number
  }
  eventsByType: Array<{
    type: string
    count: number
  }>
  failingEvents: Array<{
    id: string
    stripeEventId: string
    eventType: string
    retryCount: number
    errorMessage: string | null
    createdAt: string
  }>
}

export interface EventType {
  type: string
  count: number
}

/**
 * List webhook events with filters
 */
export async function listWebhookEvents(params: {
  eventType?: string
  status?: string
  venueId?: string
  startDate?: string
  endDate?: string
  limit?: number
  offset?: number
}): Promise<WebhookListResponse> {
  const response = await api.get('/api/v1/dashboard/superadmin/webhooks', { params })
  return response.data.data
}

/**
 * Get webhook event details
 */
export async function getWebhookEventDetails(eventId: string): Promise<WebhookEvent> {
  const response = await api.get(`/api/v1/dashboard/superadmin/webhooks/${eventId}`)
  return response.data.data
}

/**
 * Get webhook metrics
 */
export async function getWebhookMetrics(params?: {
  startDate?: string
  endDate?: string
}): Promise<WebhookMetrics> {
  const response = await api.get('/api/v1/dashboard/superadmin/webhooks/metrics', { params })
  return response.data.data
}

/**
 * Retry a failed webhook event
 */
export async function retryWebhookEvent(eventId: string): Promise<{ success: boolean; message: string }> {
  const response = await api.post(`/api/v1/dashboard/superadmin/webhooks/${eventId}/retry`)
  return response.data.data
}

/**
 * Get available event types
 */
export async function getEventTypes(): Promise<EventType[]> {
  const response = await api.get('/api/v1/dashboard/superadmin/webhooks/event-types')
  return response.data.data
}

export default {
  listWebhookEvents,
  getWebhookEventDetails,
  getWebhookMetrics,
  retryWebhookEvent,
  getEventTypes,
}
