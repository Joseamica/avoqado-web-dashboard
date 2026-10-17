/**
 * Tarjetas de regalo, fase 1a — tipos del panel. UNA sola representación (F3 de la auditoría r1 del plan): el espejo EXACTO,
 * con los MISMOS nombres y campos, de lo que responde `/api/v1/dashboard/venues/:venueId/gift-cards/*` (avoqado-server:
 * A5 `giftCardSettings.service.ts`, C3 `giftCardSurface.service.ts` y C4 `giftCardReports.service.ts`; índice, «Adiciones al
 * contrato» §6-§7, «Conciliación» y su auditoría r1). Las pantallas los leen tal cual: no hay tipos de vista ni traductores.
 * Lo que el server no manda y una pantalla necesita («vencida», el total de pendientes) lo calcula una función pura de
 * `src/pages/GiftCards/giftCardText.ts`, con su prueba.
 *
 * - Dinero en PESOS como número (el server ya los manda así).
 * - Los textos libres del server que aquí se estrechan a su enum (`reason`, `deliveryChannel`, …) son los valores del esquema
 *   de A1: el server no escribe otros.
 * - 🔴 Ningún tipo trae el código completo de una tarjeta, sólo `last4`. El único código entero que el panel llega a ver
 *   es el de «Reponer código» (`nuevoCodigo`), que se enseña una vez y no se guarda en ningún lado (spec §4.1).
 */

export type GiftCardStatus = 'PENDING' | 'ACTIVE' | 'BLOCKED' | 'DEACTIVATED'
/** Los cuatro estados más «vencida» (ACTIVE con `expiresAt` ya pasado): lo que la lista enseña y lo que filtra. */
export type GiftCardListStatus = GiftCardStatus | 'EXPIRED'
/**
 * Lo que la lista FILTRA en el server (C3/C4, decisión 1 del coordinador): los cuatro estados y `EXPIRED` (= ACTIVE con
 * `expiresAt < ahora`, en UTC). Filtrar «Activa» incluye las vencidas (la fila las marca con su distintivo). Orden: el más
 * común primero.
 */
export const GIFT_CARD_FILTER_STATUSES: readonly GiftCardListStatus[] = ['ACTIVE', 'EXPIRED', 'BLOCKED', 'DEACTIVATED', 'PENDING']

export type GiftCardActivityType =
  | 'ACTIVATE'
  | 'REDEEM'
  | 'REDEEM_REVERSAL'
  | 'ADJUST_INCREMENT'
  | 'ADJUST_DECREMENT'
  | 'BLOCK'
  | 'UNBLOCK'
  | 'DEACTIVATE'
  | 'CLAIM'
  | 'CODE_REPLACED'

export type GiftCardReason =
  | 'SUSPICIOUS_ACTIVITY'
  | 'CASHIER_ERROR'
  | 'CUSTOMER_REQUEST'
  | 'LOST_CARD'
  | 'SALE_CANCELLED'
  | 'ONLINE_REVOCATION'
  | 'CHARGEBACK'
  | 'CANCEL_IN_PROGRESS'
  | 'OTHER'

export type GiftCardDeliveryChannel = 'WHATSAPP' | 'EMAIL' | 'PRINTED' | 'CUSTOMER_CARD' | 'HANDED_TO_BUYER'
export type GiftCardDeliveryStatus = 'PENDING' | 'SENT' | 'FAILED'
export type GiftCardSource = 'POS' | 'ONLINE'
export type GiftCardValidityMonths = 12 | 24 | 36 | 60
export type GiftCardNotSellableReason = 'DISABLED' | 'NOT_IN_PLAN' | 'KEYS_MISSING'

// ── Ajustes (A5 + C3) ────────────────────────────────────────────────────

/** C3 `EstadoDeVenta`. */
export interface EstadoDeVenta {
  sellable: boolean
  code: string | null
  message: string | null
  howToEnable: 'DASHBOARD_SETTINGS' | 'PLAN' | 'CONTACT_AVOQADO' | null
  operationLimit: number | null
}

/** A5 `GiftCardSettingsView` + `sale` y `hasCards` (C3). */
export interface GiftCardSettingsView {
  enabled: boolean
  suggestedAmounts: number[]
  minAmount: number
  maxAmount: number
  /** `null` = sin vencimiento (el default). */
  validityMonths: GiftCardValidityMonths | null
  /** Versión de las reglas vigente (se congela en cada tarjeta vendida). */
  termsVersion: string
  /** Tope legal de la suma de una compra HOY (pesos); la suma debe quedar estrictamente debajo. */
  topePorOperacion: number
  /** `false` ⇒ al server le faltan las llaves y la venta está apagada (GIFT_CARD_KEYS_MISSING). */
  llavesConfiguradas: boolean
  /** ¿El negocio tiene al menos una tarjeta, de cualquier estado? (C3, `EXISTS`; decisión 1 del coordinador). Decide si sin
   *  plan se ve el cartel o la lista (DD2). */
  hasCards: boolean
  updatedAt: string | null
  /** Estado de VENTA que calcula C3. El panel explica con `motivoSinVenta` (DD13); éste queda de respaldo. */
  sale?: EstadoDeVenta
}

/** PUT parcial (A5): sólo viaja lo que cambia. Prender exige `aceptaTerminos: true` (si no, 400 GIFT_CARD_TERMS_REQUIRED). */
export interface UpdateGiftCardSettingsInput {
  enabled?: boolean
  aceptaTerminos?: boolean
  suggestedAmounts?: number[]
  minAmount?: number
  maxAmount?: number
  validityMonths?: GiftCardValidityMonths | null
}

// ── Lista (C4) ───────────────────────────────────────────────────────────

/** C4 `GiftCardRow`. */
export interface GiftCardRow {
  id: string
  last4: string
  status: GiftCardStatus
  initialAmount: number
  balance: number
  createdAt: string
  activatedAt: string | null
  expiresAt: string | null
  deliveryChannel: GiftCardDeliveryChannel
  deliveryStatus: GiftCardDeliveryStatus
  recipientName: string | null
  purchaserName: string | null
  source: GiftCardSource
  customer: { id: string; name: string } | null
  order: { id: string; orderNumber: string } | null
}

/** Lo que el panel PIDE (query de `GET /gift-cards`; no es una respuesta). */
export interface GiftCardListQuery {
  page: number
  pageSize: number
  search?: string
  status?: GiftCardListStatus[]
}

/** C4 `GiftCardListPage` = `Paginated<GiftCardRow>` + `totalBalance` (decisión 1 del coordinador). */
export interface GiftCardListPage {
  items: GiftCardRow[]
  page: number
  pageSize: number
  /** Cuántas tarjetas coinciden con la búsqueda y el filtro (todas, no sólo esta página). */
  total: number
  /** Suma del saldo de TODO el filtro, en pesos (mismo agregado que `total`; nunca se suma lo cargado). */
  totalBalance: number
}

// ── Detalle (C4) ─────────────────────────────────────────────────────────

/** C4 `GiftCardActivityRow` (`amount` siempre positivo: el tipo dice si suma o resta). */
export interface GiftCardActivityRow {
  id: string
  type: GiftCardActivityType
  amount: number
  balanceAfter: number
  reason: GiftCardReason | null
  note: string | null
  createdAt: string
  staff: { id: string; name: string } | null
  paymentId: string | null
  refundPaymentId: string | null
  orderId: string | null
}

/** Por qué no se puede cancelar la venta (C4 `cancel.reason`, el mismo predicado que `iniciarCancelacionDeVenta` de B2). */
export type GiftCardCancelReason = 'NOT_PAID' | 'NOT_SAME_DAY' | 'ALREADY_USED' | 'ALREADY_CANCELLED' | 'IN_PROGRESS'
/**
 * B2/C4 `CancelacionDeVenta`: `allowed` = «Cancelar venta» se puede iniciar ya; `reason: 'IN_PROGRESS'` = ya se inició (se
 * ofrece «Liberar»); `allowed: false` con `reason: null` = sin venta, o una tarjeta de la venta está bloqueada por otro motivo.
 */
export interface CancelacionDeVenta {
  allowed: boolean
  reason: GiftCardCancelReason | null
  /**
   * El texto del server cuando NO se puede cancelar (nota 1 del coordinador; C4, `giftCardCancel.service.ts`): distingue los
   * tres `NOT_PAID` (cancelar en el POS, reembolsar el cobro o hablar a soporte) y también viene con `reason: null` (bloqueada
   * por otro motivo). `null` sólo sin venta o con `IN_PROGRESS`. Se enseña tal cual; nunca se copia al locale.
   */
  message: string | null
}

/** C4 `GiftCardDetail`: PLANO (la fila + sus datos + el bloqueo vigente + la libreta por cursor). */
export interface GiftCardDetail extends GiftCardRow {
  validityMonths: number | null
  termsVersion: string
  message: string | null
  recipientPhone: string | null
  recipientEmail: string | null
  purchaserContact: string | null
  deliveredAt: string | null
  deactivatedAt: string | null
  /** Se usó alguna vez (un `REDEEM` en su libreta). */
  hasRedeem: boolean
  /** Reponer el código: sólo si nunca se usó, no está guardada en la tarjeta de un cliente y está viva. */
  canReplaceCode: boolean
  cancel: CancelacionDeVenta
  /**
   * El bloqueo VIGENTE (auditoría r1, D-2): el server lo saca de su último BLOCK/UNBLOCK con UNA consulta indexada, aparte de
   * la libreta paginada; `null` si la tarjeta no está `BLOCKED`. El panel NUNCA lo deduce de `activities` (tras muchos
   * movimientos el BLOCK ya no está en la primera página).
   */
  currentBlock: { reason: GiftCardReason | null; note: string | null; at: string } | null
  activities: { items: GiftCardActivityRow[]; nextCursor: string | null; total: number }
}

// ── Acciones del gerente (cuerpos de C3) ─────────────────────────────────

export type GiftCardOperation =
  | { tipo: 'AJUSTE'; direccion: 'INCREMENT' | 'DECREMENT'; amount: number; reason: GiftCardReason; note: string }
  | { tipo: 'BLOQUEAR' | 'DESBLOQUEAR'; reason: GiftCardReason; note?: string }
  | { tipo: 'REEMPLAZAR_CODIGO'; reason: 'LOST_CARD'; folio: string; note?: string }

export interface GiftCardOperationResult {
  activityIds: string[]
  /** Sólo al reponer: el código nuevo, para enseñarlo UNA vez. */
  nuevoCodigo?: { display: string; last4: string }
}

/**
 * F6 del índice: liberar una cancelación exige que el gerente confirme que COMPROBÓ que la devolución NO se hizo. Un
 * *timeout* de la terminal no lo prueba: lo incierto se queda bloqueado. Sin esto, el server responde 400.
 */
export interface ConfirmacionDeLiberar {
  confirmacionNoDevuelto: true
}

// ── Reportes (C4) ────────────────────────────────────────────────────────

/** C4 `GiftCardSummary`. */
export interface GiftCardSummary {
  from: string
  to: string
  timezone: string
  /** Activadas en el periodo (= vendidas y cobradas). */
  sold: { cards: number; amount: number }
  /** Saldo usado en el periodo, neto de los reversos (`net`). */
  redeemed: { movements: number; amount: number; reversed: number; net: number }
  cancelled: { cards: number; amount: number }
  /** Montos de ajustes del periodo (C4 no manda cuántos hubo). */
  adjustments: { increments: number; decrements: number; net: number }
  /** Lo que se debe HOY (activas y bloqueadas). `expiredAmount` = lo vencido HOY (no al corte de un periodo). */
  liveBalance: { cards: number; amount: number; expiredAmount: number; asOf: string }
}

/** C4 `AgingBucket`: sus llaves son las de los textos `reports.aging.buckets.*`. */
export type AgingBucket = '0-30' | '31-90' | '91-180' | '181-365' | '366+'
/** C4 `GiftCardAging`: saldo vivo a una fecha por antigüedad. Sin `expiredAmount` (auditoría r1, C-4: la vigencia de hoy
 *  reescribiría un corte pasado). */
export interface GiftCardAging {
  at: string
  timezone: string
  buckets: Array<{ bucket: AgingBucket; cards: number; amount: number }>
  total: { cards: number; amount: number }
}

/** C4 `PendingAccountingKind`. */
export type PendingAccountingKind = 'VENTA_DE_TARJETAS' | 'CANCELACION_DE_VENTA' | 'COBRO_CON_SALDO' | 'REVERSO_DE_SALDO'

/** C4 `PendingAccountingRow` (un reembolso o reverso llega negativo). */
export interface PendingAccountingRow {
  paymentId: string
  createdAt: string
  kind: PendingAccountingKind
  amount: number
  tipAmount: number
  method: string
  tenderLabel: string | null
  order: { id: string; orderNumber: string }
}

/** C4 `PendingAccountingPage`. Los totales se enseñan POR TIPO tal como vienen (`totals[kind]`), nunca sumados entre tipos (D5 r1). */
export interface PendingAccountingPage {
  items: PendingAccountingRow[]
  page: number
  pageSize: number
  total: number
  from: string
  to: string
  totals: Record<PendingAccountingKind, { count: number; amount: number; tipAmount: number }>
  /** El aviso al contador que manda el server (nota 1 del coordinador): qué falta registrar a mano y qué ya está en libros. */
  notice: string
}
