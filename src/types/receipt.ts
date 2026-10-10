/**
 * Unified receipt data types for frontend consistency
 * These match the backend ReceiptDataSnapshot schema
 */

export interface ReceiptPayment {
  id: string
  amount: number
  tipAmount: number
  totalAmount: number
  method: string
  status: string
  createdAt: string
  cardBrand?: string
  maskedPan?: string
  entryMode?: string
  authorizationNumber?: string
  referenceNumber?: string
  splitType?: string
  processorData?: Record<string, unknown>
}

export interface ReceiptVenue {
  id: string
  name: string
  address: string
  city: string
  state: string
  zipCode?: string
  phone: string
  email?: string
  logo?: string
  primaryColor?: string
  currency: string
}

export interface ReceiptOrderItem {
  name: string
  quantity: number
  price: number
  totalPrice: number
  modifiers: ReceiptModifier[]
}

export interface ReceiptModifier {
  name: string
  price: number
}

export interface ReceiptTable {
  number: string
  area?: string
}

export interface ReceiptOrder {
  id: string
  number: string | number
  items: ReceiptOrderItem[]
  subtotal: number
  taxAmount: number // Standardized field name
  total: number
  createdAt: string
  type?: string
  source?: string
  table?: ReceiptTable
}

export interface ReceiptProcessedBy {
  name: string
}

export interface ReceiptCustomer {
  name: string
  email?: string
}

/**
 * Totales del comprobante de UN cobro, congelados por el servidor al crear el recibo (IVA por producto, plan 7, D3). Pesos,
 * magnitudes. Siempre: subtotal − discount + serviceCharge + addedTax + tip = total.
 */
export interface ReceiptTicketTotals {
  kind: 'COBRO' | 'DEVOLUCION'
  desglosado: boolean
  /** Desglosado: la mercancía BRUTA (antes del descuento). Sin desglose: lo cobrado sin propina. */
  subtotal: number
  /** Descuento en pesos; sólo existe si desglosa y es > 0 (plan 7, A7-R6). */
  discount?: number
  serviceCharge: number
  /** El IVA que la venta cobró APARTE. 0 = el precio ya lo traía (la norma) o no hay desglose. */
  addedTax: number
  tip: number
  total: number
}

export interface UnifiedReceiptData {
  payment: ReceiptPayment
  venue: ReceiptVenue
  order: ReceiptOrder
  processedBy?: ReceiptProcessedBy
  customer?: ReceiptCustomer
  /** Aditivo (plan 7 de IVA). Ausente en recibos viejos: el visor muestra lo cobrado sin desglose. */
  ticketTotals?: ReceiptTicketTotals | null
}

// Full receipt with metadata
export interface DigitalReceipt {
  id: string
  accessKey: string
  paymentId: string
  status: 'PENDING' | 'SENT' | 'VIEWED' | 'ERROR'
  recipientEmail?: string
  dataSnapshot: UnifiedReceiptData
  createdAt: string
  sentAt?: string
  viewedAt?: string
}

// Receipt status badge configuration
export interface ReceiptStatusConfig {
  badge: string
  icon: React.ComponentType<{ className?: string }>
  color: string
}

// Utility type for receipt API responses
export interface ReceiptApiResponse<T = UnifiedReceiptData> {
  success: boolean
  data: T
  message?: string
}