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
  /** Fase 2: el switch «Tarjeta en línea». Encenderlo no exige Stripe; cobrar sí (`card.merchantStatus`). */
  acceptsCardOnline: boolean
  manualPause: boolean
  pausedUntil: string | null
  hours: OperatingHours | null
  lastInboxPollAt: string | null
  /** Tienda híbrida: `false` = «Nadie» confirma (la clienta paga en caja). Opcional: un servidor viejo no lo manda (= «Mi equipo»). */
  requiresAcceptance?: boolean
  /** Último latido de un aparato que cobra folios (la terminal o el POS al abrir «Por pagar»). */
  lastToPayPollAt?: string | null
  /** `false` = para este giro conviene «Nadie». Sólo una sugerencia: el servidor nunca elige solo (R37). */
  suggestedRequiresAcceptance?: boolean
  store: StoreState
  requirements: Record<StoreRequirement, boolean>
  /** Fase 2: si la tarjeta puede cobrar de verdad (Stripe del negocio). Opcional: un servidor viejo no lo manda. */
  card?: { enabled: boolean; merchantStatus: CardMerchantStatus }
}

export type CardMerchantStatus = 'NOT_CONNECTED' | 'NOT_CHARGEABLE' | 'READY'

/**
 * Respuesta del PUT /settings: los ajustes guardados. `store` y `requirements` sólo vienen si el servidor ya contesta con la
 * vista completa del GET; el panel no debe suponerlos (se mezcla sobre la caché y se vuelve a pedir el GET).
 */
export type OnlineOrderingSettingsSaved = Omit<OnlineOrderingSettings, 'store' | 'requirements'> &
  Partial<Pick<OnlineOrderingSettings, 'store' | 'requirements'>>

export type OnlineOrderingSettingsInput = Pick<
  OnlineOrderingSettings,
  'enabled' | 'minOrderAmount' | 'defaultPrepMinutes' | 'acceptsPayAtPickup' | 'acceptsCardOnline' | 'manualPause' | 'pausedUntil' | 'hours'
> & { requiresAcceptance: boolean }

/** 400 del PUT /settings cuando falta algo para abrir la tienda. */
export interface StoreRequirementsMissingBody {
  code: 'STORE_REQUIREMENTS_MISSING'
  details: { missing: StoreRequirement[] }
}

export interface MenuCategorySummary {
  id: string
  name: string
  active: boolean
  total: number
  online: number
  onlineWithoutPhoto: number
}

/** Agregado exacto del servidor (`truncated` = hay más categorías que el tope). */
export interface MenuCategoriesSummary {
  categories: MenuCategorySummary[]
  totals: { total: number; online: number; onlineWithoutPhoto: number }
  truncated: boolean
}

export interface MenuProductItem {
  id: string
  name: string
  price: number
  imageUrl: string | null
  active: boolean
  availableOnline: boolean
  categoryId: string | null
}

export interface MenuProductsPage {
  items: MenuProductItem[]
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
  // Fase 2 (tarjeta). Opcionales: el servidor publicado puede no traerlos.
  /** `AUTHORIZED` = tarjeta apartada (falta aceptar) · `CONFIRMING` = cobrándose · `null` = al recoger, ya cobrado o sin cargo vivo. */
  cardStatus?: 'AUTHORIZED' | 'CONFIRMING' | null
  /** El cargo con su estado real, en PESOS; `null` en pagar al recoger. */
  card?: {
    status: CardChargeStatus
    amount: number
    capturedAmount: number | null
    authorizedAt: string | null
    capturedAt: string | null
  } | null
  rejectReason?: RejectReason | 'PAYMENT_FAILED' | null
}

export type CardChargeStatus =
  | 'PENDING_AUTH'
  | 'AUTHORIZED'
  | 'CAPTURING'
  | 'CAPTURED'
  | 'CAPTURE_FAILED'
  | 'RELEASING'
  | 'RELEASED'
  | 'ABANDONED'

export interface Inbox {
  serverTime: string
  counts: { pending: number; accepted: number; ready: number; active: number; done: number }
  orders: InboxOrder[]
  truncated: boolean
  nextCursor: string | null
  store: (StoreState & { status: StoreStatus }) | null
}

/** Un folio de «Nadie» (la cuenta con su pedido). Los campos de la tienda híbrida son opcionales para las formas viejas. */
export interface FolioOrder extends InboxOrder {
  requiresAcceptance?: boolean
  channel?: string | null
}

/** `GET …/online-ordering/orders/to-pay` (sin latido: el panel no cuenta como aparato que cobra). Dinero en PESOS. */
export interface ToPayResponse {
  serverTime: string
  enabled: boolean
  requiresAcceptance: boolean
  showTile: boolean
  pollSeconds: number
  counts: { toPay: number; toDeliver: number }
  toPay: FolioOrder[]
  toDeliver: FolioOrder[]
  nextCursors: { toPay: string | null; toDeliver: string | null }
  store: (StoreState & { status: StoreStatus }) | null
}

export type RejectReason = 'OUT_OF_ITEMS' | 'CLOSED' | 'TOO_BUSY' | 'OTHER'

export interface ActionResult {
  status: OnlineOrderStatus
  estimatedReadyAt?: string
  unchanged?: boolean
}

export type PauseMinutes = 15 | 30 | 60 | null

// ── Devolver a la tarjeta (fase 2). Montos en PESOS como texto con 2 decimales («120.50»), nunca centavos. ──
export type CardRefundStatus =
  | 'REQUESTED'
  | 'SENDING'
  | 'PENDING'
  | 'SUCCEEDED'
  | 'RECORDED'
  | 'FAILED'
  | 'CANCELED'
  | 'REVERSED'
  | 'RESOLVED'
export type CardRefundReason = 'RETURNED_GOODS' | 'ACCIDENTAL_CHARGE' | 'CANCELLED_ORDER' | 'FRAUDULENT_CHARGE' | 'OTHER'
export type CardRefundResolveMethod = 'CASH' | 'BANK_TRANSFER'

export interface CardRefund {
  id: string
  status: CardRefundStatus
  amount: string
  reason: CardRefundReason
  note: string | null
  stripeRefundId: string | null
  refundPaymentId: string | null
  feeRefunded: string | null
  createdAt: string
  /** Sólo si falló DESPUÉS de hecha: «Devolver por otro medio» mientras `resolvedAt` sea null. */
  reversal: {
    failureReason: string | null
    detectedAt: string
    resolvedMethod: CardRefundResolveMethod | null
    resolvedAt: string | null
    resolvedNote: string | null
  } | null
}

/** `status` es el desenlace grueso (en una repetición dice `RECORDED` también para `REVERSED`/`RESOLVED`): el texto sale de `cardRefundStatus`. */
export interface CardRefundResult {
  status: 'RECORDED' | 'PENDING' | 'FAILED' | 'UNKNOWN'
  cardRefundStatus: CardRefundStatus
  cardRefundId: string
  refundId: string | null
  replay: boolean
}
