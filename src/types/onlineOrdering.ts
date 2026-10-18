/** Pedidos en línea (panel). Montos en PESOS; el precio ya incluye IVA. */
import type { OperatingHours } from '@/types/reservation'

export type StoreStatus = string // 'OPEN' | 'CLOSED' | 'PAUSED' | 'OFFLINE' …: el servidor decide; la UI sólo lo etiqueta
export type StoreRequirement = 'address' | 'phone' | 'privacyNotice'

export interface StoreState {
  status: StoreStatus
  reason: string | null
  pausedUntil: string | null
  manualPause: boolean
}

export interface OnlineOrderingSettings {
  enabled: boolean
  minOrderAmount: number
  defaultPrepMinutes: number
  acceptsPayAtPickup: boolean
  manualPause: boolean
  pausedUntil: string | null
  hours: OperatingHours | null
  lastInboxPollAt: string | null
  store: StoreState
  requirements: Record<StoreRequirement, boolean>
}

export type OnlineOrderingSettingsInput = Pick<
  OnlineOrderingSettings,
  'enabled' | 'minOrderAmount' | 'defaultPrepMinutes' | 'acceptsPayAtPickup' | 'manualPause' | 'pausedUntil' | 'hours'
>

/** 400 del PUT /settings cuando falta algo para abrir la tienda. */
export interface StoreRequirementsMissingBody {
  code: 'STORE_REQUIREMENTS_MISSING'
  details: { missing: StoreRequirement[] }
}

export interface MenuCategoriesSummary {
  // Agregado exacto del servidor; la forma fina la fijan las tareas 14–15.
  [key: string]: unknown
}

export interface MenuProductsPage {
  items: Array<Record<string, unknown>>
  nextCursor: string | null
  total: number
}

export type OnlineOrderStatus =
  | 'PENDING_ACCEPTANCE'
  | 'ACCEPTED'
  | 'READY'
  | 'COMPLETED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CANCELLED_BY_CUSTOMER'
  | 'CANCELLED_BY_STAFF'

export interface InboxOrder {
  orderId: string
  onlineOrderId: string
  orderNumber: string | number
  status: OnlineOrderStatus
  paymentMode: string
  customerName: string | null
  customerPhone: string | null
  note: string | null
  createdAt: string
  acceptDeadlineAt: string | null
  estimatedReadyAt: string | null
  total: number
  remaining: number
  paymentStatus: string
  needsPrint: boolean
  items: Array<{ name: string; quantity: number; note: string | null; modifiers: Array<{ name: string; quantity: number }> }>
}

export interface Inbox {
  serverTime: string
  counts: { pending: number; accepted: number; ready: number; active: number; done: number }
  orders: InboxOrder[]
  truncated: boolean
  nextCursor: string | null
  store: (StoreState & { status: StoreStatus }) | null
}

export type RejectReason = 'OUT_OF_ITEMS' | 'CLOSED' | 'TOO_BUSY' | 'OTHER'

export interface ActionResult {
  status: OnlineOrderStatus
  estimatedReadyAt?: string
  unchanged?: boolean
}

export type PauseMinutes = 15 | 30 | 60 | null
