import api from '@/api'

export type InterVenueTransferMode = 'PULL' | 'PUSH'
export type InterVenueTransferStatus =
  | 'REQUESTED'
  | 'APPROVED'
  | 'IN_TRANSIT'
  | 'PARTIALLY_RECEIVED'
  | 'COMPLETED'
  | 'COMPLETED_WITH_VARIANCE'
  | 'REJECTED'
  | 'CANCELLED'
export type InterVenueTransferVarianceReason =
  | 'NOT_DISPATCHED'
  | 'DAMAGED'
  | 'LOST_IN_TRANSIT'
  | 'QUANTITY_ERROR'
  | 'OTHER'

export interface TransferVenue {
  id: string
  name: string
  operationalRole: 'STORE' | 'CEDIS' | 'HYBRID'
  salesEnabled?: boolean
}

export interface InterVenueTransferListItem {
  id: string
  number: string
  externalReference: string | null
  mode: InterVenueTransferMode
  status: InterVenueTransferStatus
  sourceVenueId: string
  destinationVenueId: string
  sourceVenue: TransferVenue
  destinationVenue: TransferVenue
  requestedAt: string
  createdAt: string
  _count: { items: number; receipts: number }
}

export interface TransferAllocation {
  id: string
  quantityDispatched: string
  quantityReceived: string
  costPerUnit: string
  sourceReceivedDate: string
  expirationDate: string | null
  allocationOrder: number
  sourceBatch: { batchNumber: string }
  destinationBatch: { batchNumber: string } | null
}

export interface InterVenueTransferItem {
  id: string
  unit: string
  quantityRequested: string
  quantityDispatched: string
  quantityReceived: string
  quantityVarianceResolved: string
  dispatchShortfallReason: string | null
  notes: string | null
  sourceRawMaterial: { id: string; name: string; sku: string; unit: string }
  destinationRawMaterial: { id: string; name: string; sku: string; unit: string }
  allocations: TransferAllocation[]
}

export interface InterVenueTransferDetail extends Omit<InterVenueTransferListItem, '_count'> {
  organizationId: string
  notes: string | null
  requestedByStaffId: string
  requestedAt: string
  approvedByStaffId: string | null
  approvedAt: string | null
  rejectedAt: string | null
  rejectionReason: string | null
  cancelledAt: string | null
  cancellationReason: string | null
  dispatchedAt: string | null
  completedAt: string | null
  fiscalUuid: string | null
  fiscalReference: string | null
  items: InterVenueTransferItem[]
  receipts: Array<{
    id: string
    receivedAt: string
    receivedByStaffId: string
    notes: string | null
    lines: Array<{ id: string; allocationId: string; quantity: string }>
  }>
  varianceResolutions: Array<{
    id: string
    resolvedAt: string
    resolvedByStaffId: string
    notes: string | null
    lines: Array<{
      id: string
      itemId: string
      quantity: string
      reason: InterVenueTransferVarianceReason
      costImpact: string | null
      notes: string | null
    }>
  }>
}

export interface CreateInterVenueTransferInput {
  mode: InterVenueTransferMode
  sourceVenueId: string
  destinationVenueId: string
  externalReference?: string
  notes?: string
  items: Array<{
    sourceRawMaterialId: string
    destinationRawMaterialId: string
    quantity: number
    notes?: string
  }>
}

export interface ConsolidatedInventory {
  venues: Array<
    TransferVenue & {
      rawMaterials: Array<{
        id: string
        name: string
        sku: string
        unit: string
        currentStock: string
        reservedStock: string
        reorderPoint: string
      }>
    }
  >
}

const base = (venueId: string) => `/api/v1/dashboard/venues/${venueId}/inventory/inter-venue-transfers`
const mutationHeaders = () => ({ 'Idempotency-Key': crypto.randomUUID() })

export const interVenueTransferService = {
  list: async (
    venueId: string,
    filters?: { status?: InterVenueTransferStatus; direction?: 'incoming' | 'outgoing'; search?: string; page?: number; pageSize?: number },
  ) => {
    const response = await api.get<{ success: boolean; data: { items: InterVenueTransferListItem[]; total: number; page: number; pageSize: number; totalPages: number } }>(
      base(venueId),
      { params: filters },
    )
    return response.data.data
  },

  get: async (venueId: string, transferId: string) => {
    const response = await api.get<{ success: boolean; data: InterVenueTransferDetail }>(`${base(venueId)}/${transferId}`)
    return response.data.data
  },

  create: async (venueId: string, input: CreateInterVenueTransferInput) => {
    const response = await api.post<{ success: boolean; data: InterVenueTransferDetail }>(base(venueId), input)
    return response.data.data
  },

  approve: async (venueId: string, transferId: string) => {
    const response = await api.post<{ success: boolean; data: InterVenueTransferDetail }>(`${base(venueId)}/${transferId}/approve`, {})
    return response.data.data
  },

  reject: async (venueId: string, transferId: string, reason: string) => {
    const response = await api.post<{ success: boolean; data: InterVenueTransferDetail }>(`${base(venueId)}/${transferId}/reject`, { reason })
    return response.data.data
  },

  cancel: async (venueId: string, transferId: string, reason: string) => {
    const response = await api.post<{ success: boolean; data: InterVenueTransferDetail }>(`${base(venueId)}/${transferId}/cancel`, { reason })
    return response.data.data
  },

  dispatch: async (
    venueId: string,
    transferId: string,
    items: Array<{ itemId: string; quantity: number; shortfallReason?: string }>,
  ) => {
    const response = await api.post<{ success: boolean; data: InterVenueTransferDetail }>(
      `${base(venueId)}/${transferId}/dispatch`,
      { items },
      { headers: mutationHeaders() },
    )
    return response.data.data
  },

  receive: async (venueId: string, transferId: string, input: { notes?: string; items: Array<{ itemId: string; quantity: number }> }) => {
    const response = await api.post<{ success: boolean; data: InterVenueTransferDetail }>(
      `${base(venueId)}/${transferId}/receive`,
      input,
      { headers: mutationHeaders() },
    )
    return response.data.data
  },

  resolveVariance: async (
    venueId: string,
    transferId: string,
    input: {
      notes?: string
      items: Array<{ itemId: string; quantity: number; reason: InterVenueTransferVarianceReason; notes?: string }>
    },
  ) => {
    const response = await api.post<{ success: boolean; data: InterVenueTransferDetail }>(
      `${base(venueId)}/${transferId}/resolve-variance`,
      input,
      { headers: mutationHeaders() },
    )
    return response.data.data
  },

  consolidated: async (venueId: string, search?: string) => {
    const response = await api.get<{ success: boolean; data: ConsolidatedInventory }>(`${base(venueId)}/consolidated`, {
      params: { search: search || undefined },
    })
    return response.data.data
  },
}
