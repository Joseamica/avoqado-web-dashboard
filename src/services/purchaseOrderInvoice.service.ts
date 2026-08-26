import api from '@/api'

/**
 * Factura del proveedor sobre una orden de compra.
 *
 * La factura NO dice qué compraste — la orden ya lo sabe. Esto comprueba que te cobraron
 * lo que pediste. Subirla nunca cambia el costo de tu mercancía: si el precio difiere, se
 * avisa, no se corrige.
 */

export type InvoiceMatchStatus = 'PENDING' | 'MATCHED' | 'SUPPLIER_MISMATCH' | 'AMOUNT_MISMATCH' | 'LINES_MISMATCH'

export interface InvoiceMatchNotes {
  invoiceTotalCents: number
  orderTotalCents: number
  /** Positivo = el proveedor cobró de MÁS. Negativo = de menos. */
  totalDifferenceCents: number
  unmatchedConceptos: number
  unmatchedOrderItemIds: string[]
  /** El proveedor no tiene RFC capturado, así que no se pudo verificar el emisor. */
  supplierUnverified?: boolean
}

export interface PurchaseOrderInvoiceLine {
  id: string
  purchaseOrderItemId: string | null
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
  purchaseOrderId: string
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
}
