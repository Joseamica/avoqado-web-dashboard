import api from '@/api'

// ============================================================================
// ENUMS - Matching Backend EXACTLY
// ============================================================================

export enum PurchaseOrderStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  SENT = 'SENT',
  CONFIRMED = 'CONFIRMED',
  SHIPPED = 'SHIPPED',
  PARTIAL = 'PARTIAL',
  RECEIVED = 'RECEIVED',
  CANCELLED = 'CANCELLED',
}

export enum Unit {
  KILOGRAM = 'KILOGRAM',
  GRAM = 'GRAM',
  LITER = 'LITER',
  MILLILITER = 'MILLILITER',
  PIECE = 'PIECE',
  DOZEN = 'DOZEN',
  CASE = 'CASE',
  BAG = 'BAG',
  BOX = 'BOX',
  BOTTLE = 'BOTTLE',
  CAN = 'CAN',
  CUP = 'CUP',
  TABLESPOON = 'TABLESPOON',
  TEASPOON = 'TEASPOON',
  OUNCE = 'OUNCE',
  POUND = 'POUND',
  GALLON = 'GALLON',
  QUART = 'QUART',
  PINT = 'PINT',
}

export enum PurchaseOrderItemStatus {
  PENDING = 'PENDING',
  RECEIVED = 'RECEIVED',
  DAMAGED = 'DAMAGED',
  NOT_PROCESSED = 'NOT_PROCESSED',
}

// ============================================================================
// TYPES - Matching Backend EXACTLY
// ============================================================================

export interface PurchaseOrder {
  id: string
  venueId: string
  supplierId: string
  orderNumber: string
  orderDate: string
  expectedDeliveryDate?: string | null
  status: PurchaseOrderStatus
  subtotal: string // Decimal as string
  taxRate: number
  taxAmount: string // Decimal as string
  commissionRate: number
  commission: string // Decimal as string
  total: string // Decimal as string
  notes?: string | null
  // Shipping address fields
  shippingAddressType?: 'VENUE' | 'CUSTOM' | null
  shippingAddress?: string | null
  shippingCity?: string | null
  shippingState?: string | null
  shippingZipCode?: string | null
  createdById: string
  createdAt: string
  updatedAt: string
  supplier?: any // Nested supplier object
  items: PurchaseOrderItem[]
  createdBy?: any // Nested staff object
}

export interface PurchaseOrderItem {
  id: string
  purchaseOrderId: string
  rawMaterialId: string
  quantityOrdered: number
  quantityReceived: number
  unit: Unit
  unitPrice: string // Decimal as string
  total: string // Decimal as string
  receiveStatus: PurchaseOrderItemStatus
  receivedNotes?: string | null
  rawMaterial?: any // Nested raw material object
}

export interface CreatePurchaseOrderDto {
  supplierId: string
  orderDate: string
  expectedDeliveryDate?: string
  taxRate: number
  notes?: string
  // Shipping address (optional custom delivery location)
  shippingAddressType?: 'VENUE' | 'CUSTOM'
  shippingAddress?: string
  shippingCity?: string
  shippingState?: string
  shippingZipCode?: string
  items: Array<{
    rawMaterialId: string
    quantityOrdered: number
    unit: Unit
    unitPrice: number
  }>
}

export interface UpdatePurchaseOrderDto {
  supplierId?: string
  orderDate?: string
  status?: PurchaseOrderStatus
  expectedDeliveryDate?: string
  taxRate?: number
  notes?: string
  // Shipping address (optional custom delivery location)
  shippingAddressType?: 'VENUE' | 'CUSTOM'
  shippingAddress?: string
  shippingCity?: string
  shippingState?: string
  shippingZipCode?: string
  items?: Array<{
    rawMaterialId: string
    quantityOrdered: number
    unit: Unit
    unitPrice: number
  }>
}

export interface ReceivePurchaseOrderDto {
  items: Array<{
    purchaseOrderItemId: string
    quantityReceived: number
    unitCost?: number
    batchNumber?: string
    expirationDate?: string
  }>
  partial: boolean
}

export interface PurchaseOrderStats {
  totalOrders: number
  draftOrders: number
  pendingOrders: number
  completedOrders: number
  cancelledOrders: number
  totalSpent?: number
}

// ============================================================================
// LABEL GENERATION TYPES
// ============================================================================

export interface LabelGenerationConfig {
  labelType: string
  barcodeFormat: 'SKU' | 'GTIN'
  details: {
    sku: boolean
    gtin: boolean
    variantName: boolean
    price: boolean
    itemName: boolean
    unitAbbr: boolean
  }
  items: Array<{
    itemId: string
    quantity: number
  }>
}

export interface LabelTemplate {
  value: string
  label: string
  category: 'avery' | 'dymo' | 'zebra'
}

export const LABEL_TYPES: LabelTemplate[] = [
  // Avery templates
  { value: 'avery-5160', label: 'Avery 5160/8160 - Easy Peel Address Labels 1 x 2 5/8"', category: 'avery' },
  { value: 'avery-5161', label: 'Avery 5161/8161 - Easy Peel Address Labels 1 x 4"', category: 'avery' },
  { value: 'avery-5167', label: 'Avery 5167/8167 - Easy Peel Return Address Labels 1/2 x 1 3/4"', category: 'avery' },
  { value: 'avery-5195', label: 'Avery 5195/8195 - Easy Peel Return Address Labels 2/3 x 1 3/4"', category: 'avery' },

  // DYMO templates
  { value: 'dymo-1738595', label: 'DYMO 1738595 - LW Barcode Labels 3/4 x 2 1/2"', category: 'dymo' },
  { value: 'dymo-30330', label: 'DYMO 30330 - LW Address Labels 3/4 x 2"', category: 'dymo' },
  { value: 'dymo-30332', label: 'DYMO 30332 - LW Multi-Purpose Labels 1 x 1"', category: 'dymo' },
  { value: 'dymo-30334', label: 'DYMO 30334 - LW Multi-Purpose Labels 1 1/4 x 2 1/4"', category: 'dymo' },
  { value: 'dymo-30336', label: 'DYMO 30336 - LW Multi-Purpose Labels 1 x 2 1/8"', category: 'dymo' },

  // Zebra templates
  { value: 'zebra-1.5x1', label: 'Zebra - 1 1/2 x 1"', category: 'zebra' },
  { value: 'zebra-1.5x0.5', label: 'Zebra - 1 1/2 x 1/2"', category: 'zebra' },
  { value: 'zebra-1x1', label: 'Zebra - 1 x 1"', category: 'zebra' },
  { value: 'zebra-1.2x0.85', label: 'Zebra - 1.2 x 0.85"', category: 'zebra' },
]

// ============================================================================
// API CLIENT
// ============================================================================

export const purchaseOrderService = {
  /**
   * Get all purchase orders for a venue
   */
  getPurchaseOrders: async (
    venueId: string,
    filters?: { status?: PurchaseOrderStatus[]; supplierId?: string }
  ) => {
    const { data } = await api.get(`/api/v1/dashboard/venues/${venueId}/inventory/purchase-orders`, { params: filters })
    return data
  },

  /**
   * Get a single purchase order by ID
   */
  getPurchaseOrder: async (venueId: string, poId: string) => {
    const { data } = await api.get(`/api/v1/dashboard/venues/${venueId}/inventory/purchase-orders/${poId}`)
    return data
  },

  /**
   * Create a new purchase order
   */
  createPurchaseOrder: async (venueId: string, dto: CreatePurchaseOrderDto) => {
    const { data } = await api.post(`/api/v1/dashboard/venues/${venueId}/inventory/purchase-orders`, dto)
    return data
  },

  /**
   * Update an existing purchase order (only allowed in DRAFT status)
   */
  updatePurchaseOrder: async (venueId: string, poId: string, dto: UpdatePurchaseOrderDto) => {
    const { data } = await api.put(`/api/v1/dashboard/venues/${venueId}/inventory/purchase-orders/${poId}`, dto)
    return data
  },

  /**
   * Approve a purchase order (PENDING_APPROVAL → APPROVED)
   */
  approvePurchaseOrder: async (venueId: string, poId: string) => {
    const { data } = await api.post(`/api/v1/dashboard/venues/${venueId}/inventory/purchase-orders/${poId}/approve`)
    return data
  },

  /**
   * Receive a purchase order (SHIPPED → RECEIVED or PARTIAL)
   */
  receivePurchaseOrder: async (venueId: string, poId: string, dto: ReceivePurchaseOrderDto) => {
    const { data } = await api.post(`/api/v1/dashboard/venues/${venueId}/inventory/purchase-orders/${poId}/receive`, dto)
    return data
  },

  /**
   * Cancel a purchase order
   */
  cancelPurchaseOrder: async (venueId: string, poId: string, reason: string) => {
    const { data } = await api.post(`/api/v1/dashboard/venues/${venueId}/inventory/purchase-orders/${poId}/cancel`, { reason })
    return data
  },

  /**
   * Delete a purchase order (DRAFT only)
   */
  deletePurchaseOrder: async (venueId: string, poId: string) => {
    const { data } = await api.delete(`/api/v1/dashboard/venues/${venueId}/inventory/purchase-orders/${poId}`)
    return data
  },

  /**
   * Get purchase order statistics
   */
  getStats: async (venueId: string) => {
    const { data } = await api.get(`/api/v1/dashboard/venues/${venueId}/inventory/purchase-orders/stats`)
    return data
  },

  /**
   * Update purchase order fees (tax rate and/or commission rate)
   */
  updatePurchaseOrderFees: async (
    venueId: string,
    poId: string,
    fees: { taxRate?: number; commissionRate?: number }
  ) => {
    const { data } = await api.put(
      `/api/v1/dashboard/venues/${venueId}/inventory/purchase-orders/${poId}/fees`,
      fees
    )
    return data
  },

  /**
   * Update individual purchase order item status
   */
  updatePurchaseOrderItemStatus: async (
    venueId: string,
    poId: string,
    itemId: string,
    status: {
      receiveStatus: PurchaseOrderItemStatus
      quantityReceived?: number
      notes?: string
    }
  ) => {
    const { data } = await api.put(
      `/api/v1/dashboard/venues/${venueId}/inventory/purchase-orders/${poId}/items/${itemId}/status`,
      status
    )
    return data
  },

  /**
   * Recalculate purchase order status based on item statuses
   */
  recalculateStatus: async (venueId: string, poId: string) => {
    const { data } = await api.post(
      `/api/v1/dashboard/venues/${venueId}/inventory/purchase-orders/${poId}/recalculate-status`
    )
    return data
  },

  /**
   * Mark all items in a purchase order as RECEIVED
   */
  receiveAllItems: async (venueId: string, poId: string, receivedDate?: string) => {
    const { data } = await api.post(
      `/api/v1/dashboard/venues/${venueId}/inventory/purchase-orders/${poId}/receive-all`,
      { receivedDate }
    )
    return data
  },

  /**
   * Mark all items in a purchase order as NOT_PROCESSED
   */
  receiveNoItems: async (venueId: string, poId: string, reason?: string) => {
    const { data } = await api.post(
      `/api/v1/dashboard/venues/${venueId}/inventory/purchase-orders/${poId}/receive-none`,
      { reason }
    )
    return data
  },

  /**
   * Generate labels for purchase order items
   */
  generateLabels: async (
    venueId: string,
    poId: string,
    config: LabelGenerationConfig
  ): Promise<{ blob: Blob; totalLabels: number }> => {
    const response = await api.post(
      `/api/v1/dashboard/venues/${venueId}/inventory/purchase-orders/${poId}/labels`,
      config,
      { responseType: 'blob' }
    )

    const totalLabels = parseInt(response.headers['x-total-labels'] || '0', 10)

    return {
      blob: response.data,
      totalLabels,
    }
  },

  /**
   * Generate PDF for purchase order
   */
  generatePDF: async (venueId: string, poId: string): Promise<Blob> => {
    const response = await api.get(
      `/api/v1/dashboard/venues/${venueId}/inventory/purchase-orders/${poId}/pdf`,
      { responseType: 'blob' }
    )

    return response.data
  },
}

// ============================================================================
// UTILITY TYPES & FUNCTIONS
// ============================================================================

export interface PurchaseOrderFilters {
  status?: PurchaseOrderStatus[]
  supplierId?: string
  search?: string
  startDate?: string
  endDate?: string
}

/**
 * Format decimal price string for display
 */
export function formatPrice(price: string | number): string {
  const numPrice = typeof price === 'string' ? parseFloat(price) : price
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(numPrice)
}

/**
 * Get badge styling for purchase order status
 */
export function getStatusBadgeColor(status: PurchaseOrderStatus): {
  variant: 'default' | 'destructive' | 'outline' | 'secondary' | 'soft'
  className: string
} {
  switch (status) {
    case PurchaseOrderStatus.DRAFT:
      return { variant: 'secondary', className: 'bg-muted text-muted-foreground' }
    case PurchaseOrderStatus.PENDING_APPROVAL:
      return { variant: 'soft', className: 'bg-yellow-100 text-yellow-800' }
    case PurchaseOrderStatus.APPROVED:
      return { variant: 'default', className: 'bg-blue-100 text-blue-800' }
    case PurchaseOrderStatus.SENT:
      return { variant: 'default', className: 'bg-indigo-100 text-indigo-800' }
    case PurchaseOrderStatus.CONFIRMED:
      return { variant: 'default', className: 'bg-purple-100 text-purple-800' }
    case PurchaseOrderStatus.SHIPPED:
      return { variant: 'default', className: 'bg-cyan-100 text-cyan-800' }
    case PurchaseOrderStatus.PARTIAL:
      return { variant: 'soft', className: 'bg-orange-100 text-orange-800' }
    case PurchaseOrderStatus.RECEIVED:
      return { variant: 'default', className: 'bg-green-100 text-green-800' }
    case PurchaseOrderStatus.CANCELLED:
      return { variant: 'destructive', className: 'bg-red-100 text-red-800' }
    default:
      return { variant: 'secondary', className: 'bg-muted text-muted-foreground' }
  }
}
