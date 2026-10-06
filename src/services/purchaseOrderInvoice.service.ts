import api from '@/api'

/**
 * Factura del proveedor sobre una orden de compra.
 *
 * La factura NO dice qué compraste — la orden ya lo sabe. Esto comprueba que te cobraron
 * lo que pediste. Subirla nunca cambia el costo de tu mercancía: si el precio difiere, se
 * avisa, no se corrige.
 */

export type InvoiceMatchStatus = 'PENDING' | 'MATCHED' | 'SUPPLIER_MISMATCH' | 'AMOUNT_MISMATCH' | 'LINES_MISMATCH' | 'PARTIAL' | 'NO_ORDER'

export interface InvoiceMatchNotes {
  invoiceTotalCents: number
  orderTotalCents: number
  /** Positivo = el proveedor cobró de MÁS. Negativo = de menos. */
  totalDifferenceCents: number
  /** Lo facturado por TODAS las facturas de la orden (parciales incluidas). */
  accumulatedInvoicedCents?: number
  accumulatedDifferenceCents?: number
  unmatchedConceptos?: number
  unmatchedOrderItemIds?: string[]
  /** Sólo facturas SIN orden: renglones que los códigos aprendidos no reconocieron. */
  unidentifiedLines?: number
  totalLines?: number
  /** El emisor no está dado de alta como proveedor (o sin RFC): la factura se guardó igual. */
  supplierUnknown?: boolean
  /** El proveedor no tiene RFC capturado, así que no se pudo verificar el emisor. */
  supplierUnverified?: boolean
}

export interface PurchaseOrderInvoiceLine {
  id: string
  purchaseOrderItemId: string | null
  /** Qué ES el renglón (fase 2): insumo O producto. Ambos null = pendiente de identificar. */
  rawMaterialId: string | null
  productId: string | null
  purchaseUnit?: string | null
  presentationName?: string | null
  rawMaterial?: { id: string; name: string; unit: string } | null
  product?: { id: string; name: string; unit: string } | null
  iepsCents?: number
  supplierItemCode: string | null
  descripcion: string
  claveUnidad: string | null
  cantidad: string | number
  valorUnitarioCents: number
  importeCents: number
  descuentoCents: number
}

export interface PurchaseOrderInvoice {
  id: string
  /** Null = factura sin orden previa (fase 2). */
  purchaseOrderId: string | null
  supplier?: { id: string; name: string } | null
  purchaseOrder?: { id: string; orderNumber: string; status?: string } | null
  inventoryPreparedAt?: string | null
  inventoryReceivedAt?: string | null
  inventoryIncludeIeps?: boolean | null
  currency?: string | null
  iepsCents?: number
  uuid: string
  serie: string | null
  folio: string | null
  emisorRfc: string
  emisorNombre: string
  fechaEmision: string
  subtotalCents: number
  ivaCents: number
  totalCents: number
  xmlUrl: string | null
  matchStatus: InvoiceMatchStatus
  matchNotes: InvoiceMatchNotes | null
  createdAt: string
  _count?: { lines: number }
  lines: PurchaseOrderInvoiceLine[]
}

export const purchaseOrderInvoiceService = {
  async list(venueId: string, purchaseOrderId: string): Promise<PurchaseOrderInvoice[]> {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/inventory/purchase-orders/${purchaseOrderId}/invoices`)
    return Array.isArray(response.data) ? response.data : (response.data?.data ?? [])
  },

  async attach(venueId: string, purchaseOrderId: string, xml: string): Promise<PurchaseOrderInvoice> {
    const response = await api.post(`/api/v1/dashboard/venues/${venueId}/inventory/purchase-orders/${purchaseOrderId}/invoices`, {
      xml,
    })
    return response.data
  },

  /** Fase 2: la factura que llegó SIN orden. Se registra y se identifica lo que los códigos ya saben. */
  async registerStandalone(venueId: string, xml: string): Promise<PurchaseOrderInvoice> {
    const response = await api.post(`/api/v1/dashboard/venues/${venueId}/inventory/supplier-invoices`, { xml })
    return response.data
  },

  /** Todas las facturas del negocio; `onlyNoOrder` filtra las que llegaron sin orden. */
  async listAll(venueId: string, filters: { supplierId?: string; onlyNoOrder?: boolean } = {}): Promise<PurchaseOrderInvoice[]> {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/inventory/supplier-invoices`, {
      params: { supplierId: filters.supplierId, onlyNoOrder: filters.onlyNoOrder ? 'true' : undefined },
    })
    return response.data
  },

  async inbox(venueId: string, page = 1, search = ''): Promise<InvoicePage> {
    return (await api.get(`/api/v1/dashboard/venues/${venueId}/inventory/supplier-invoices/inbox`, { params: { page, limit: 20, search: search || undefined } })).data
  },

  async catalog(venueId: string, kind: 'RAW' | 'PRODUCT', page = 1, search = ''): Promise<InvoiceCatalogPage> {
    return (await api.get(`/api/v1/dashboard/venues/${venueId}/inventory/supplier-invoices/catalog`, { params: { kind, page, limit: 25, search: search || undefined } })).data
  },

  async previewInventory(venueId: string, invoiceId: string, includeIeps = false): Promise<InvoiceInventoryReview> {
    return (await api.get(`/api/v1/dashboard/venues/${venueId}/inventory/supplier-invoices/${invoiceId}/inventory`, { params: { includeIeps } })).data
  },

  async confirmInventory(venueId: string, invoiceId: string, confirmationToken: string, includeIeps: boolean): Promise<{ purchaseOrderId: string; status: string }> {
    return (await api.post(`/api/v1/dashboard/venues/${venueId}/inventory/supplier-invoices/${invoiceId}/inventory`, { confirmationToken, includeIeps })).data
  },

  /** Una persona confirma qué ES un renglón — y el sistema APRENDE el código del proveedor. */
  async identifyLine(
    venueId: string,
    invoiceId: string,
    lineId: string,
    body: { rawMaterialId?: string | null; productId?: string | null; purchaseUnit?: string | null; presentationName?: string | null },
  ): Promise<PurchaseOrderInvoiceLine> {
    const response = await api.post(
      `/api/v1/dashboard/venues/${venueId}/inventory/purchase-invoices/${invoiceId}/lines/${lineId}/identify`,
      body,
    )
    return response.data
  },
}

export interface InvoicePage { rows: PurchaseOrderInvoice[]; total: number; page: number; limit: number; totalPages: number }
export interface InvoiceCatalogItem { id: string; name: string; unit: string }
export interface InvoiceCatalogPage { rows: InvoiceCatalogItem[]; total: number; page: number; limit: number; totalPages: number }
export interface InvoiceInventoryReview {
  action: 'PREPARE' | 'RECEIVE'
  confirmationToken: string
  supplier: string
  total: string
  subtotal: string
  iva: string
  ieps: string
  includeIepsInCost: boolean
  lines: Array<{ lineId: string; name: string; quantity: string; unit: string; presentationName: string | null; baseQuantity: string; baseUnit: string; costAmount: string; baseUnitCost: string }>
}
