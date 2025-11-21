import api from '@/api'
import { TransactionCardType } from './availableBalance.service'

/**
 * Settlement Incident Service
 *
 * API client for settlement incident tracking and confirmation.
 * Handles detection of delayed settlements and manual confirmation workflows.
 */

export enum IncidentStatus {
  PENDING_CONFIRMATION = 'PENDING_CONFIRMATION',
  CONFIRMED_DELAY = 'CONFIRMED_DELAY',
  RESOLVED = 'RESOLVED',
  ESCALATED = 'ESCALATED',
}

export interface SettlementIncident {
  id: string
  transactionId: string | null
  venueId: string
  estimatedSettlementDate: string
  actualSettlementDate: string | null
  delayDays: number | null
  processorName: string
  cardType: TransactionCardType
  transactionDate: string
  amount: number
  status: IncidentStatus
  detectionDate: string
  resolutionDate: string | null
  notes: string | null
  alertedSOFOM: boolean
  alertedAt: string | null
  resolvedBy: string | null
  resolutionNotes: string | null
  createdAt: string
  updatedAt: string
  // Relations
  venue?: {
    id: string
    name: string
    slug: string
  }
  transaction?: {
    id: string
    payment: {
      id: string
      transactionCost?: {
        merchantAccount: {
          provider: {
            name: string
          }
        }
      }
    }
  }
  confirmations?: SettlementConfirmation[]
}

export interface SettlementConfirmation {
  id: string
  incidentId: string | null
  transactionId: string | null
  venueId: string
  confirmedBy: string
  confirmationDate: string
  settlementArrived: boolean
  actualDate: string | null
  notes: string | null
  evidenceUrl: string | null
  bankReference: string | null
  createdAt: string
}

export interface IncidentStats {
  total: number
  pending: number
  delayed: number
  resolved: number
  escalated: number
  averageDelayDays: number
}

export interface ConfirmIncidentParams {
  settlementArrived: boolean
  actualDate?: string
  notes?: string
}

export interface EscalateIncidentParams {
  notes?: string
}

/**
 * Get settlement incidents for a venue
 */
export async function getVenueIncidents(
  venueId: string,
  params?: {
    status?: 'pending' | 'active' | 'all'
  },
): Promise<{ success: boolean; data: SettlementIncident[] }> {
  const res = await api.get(`/api/v1/dashboard/venues/${venueId}/settlement-incidents`, {
    params,
    withCredentials: true,
  })
  return res.data
}

/**
 * Get all incidents (SuperAdmin only)
 */
export async function getAllIncidents(params?: {
  status?: 'pending' | 'active' | 'all'
}): Promise<{ success: boolean; data: SettlementIncident[] }> {
  const res = await api.get(`/api/v1/dashboard/superadmin/settlement-incidents`, {
    params,
    withCredentials: true,
  })
  return res.data
}

/**
 * Confirm a settlement incident
 */
export async function confirmIncident(
  venueId: string,
  incidentId: string,
  params: ConfirmIncidentParams,
): Promise<{
  success: boolean
  data: {
    incident: SettlementIncident
    confirmation: SettlementConfirmation
  }
  message: string
}> {
  const res = await api.post(
    `/api/v1/dashboard/venues/${venueId}/settlement-incidents/${incidentId}/confirm`,
    params,
    {
      withCredentials: true,
    },
  )
  return res.data
}

/**
 * Escalate an incident (SuperAdmin only)
 */
export async function escalateIncident(
  incidentId: string,
  params?: EscalateIncidentParams,
): Promise<{
  success: boolean
  data: SettlementIncident
  message: string
}> {
  const res = await api.post(
    `/api/v1/dashboard/superadmin/settlement-incidents/${incidentId}/escalate`,
    params,
    {
      withCredentials: true,
    },
  )
  return res.data
}

/**
 * Get incident statistics for a venue
 */
export async function getVenueIncidentStats(venueId: string): Promise<{ success: boolean; data: IncidentStats }> {
  const res = await api.get(`/api/v1/dashboard/venues/${venueId}/settlement-incidents/stats`, {
    withCredentials: true,
  })
  return res.data
}

/**
 * Get global incident statistics (SuperAdmin only)
 */
export async function getGlobalIncidentStats(): Promise<{ success: boolean; data: IncidentStats }> {
  const res = await api.get(`/api/v1/dashboard/superadmin/settlement-incidents/stats`, {
    withCredentials: true,
  })
  return res.data
}
