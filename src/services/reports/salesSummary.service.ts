/**
 * Sales Summary Report Service
 *
 * API client for the Sales Summary dashboard report.
 * Communicates with /api/v1/dashboard/reports/sales-summary endpoint.
 */

import api from '@/api'

// ============================================================
// Constants
// ============================================================

// Mirrors avoqado-server/src/services/legacy/qrPayments.legacy.service.ts
// (MINDFORM_NEW_VENUE_ID). Kept in sync manually; a comment in the backend
// file points here. Used to gate the QR_LEGACY filter option to MindForm only.
export const MINDFORM_VENUE_ID = 'cmisvi38o001fhr2828ygmxi2'

// ============================================================
// Types
// ============================================================

export type PaymentMethodFilter = 'CASH' | 'CARD' | 'QR_LEGACY' | 'OTHER'
export type CardTypeFilter = 'CREDIT' | 'DEBIT' | 'AMEX' | 'INTERNATIONAL'

export interface SalesSummaryMetrics {
  // Order-derived fields. Null when a payment filter is active — they cannot
  // be honestly attributed to a single payment method (Square approach).
  grossSales: number | null
  items: number | null
  serviceCosts: number | null
  discounts: number | null
  netSales: number | null
  deferredSales: number | null
  taxes: number | null
  // Payment-derived fields. Always numbers, even under filter.
  refunds: number
  tips: number
  // Costs breakdown
  platformFees: number // Avoqado platform fees
  staffCommissions: number // Commissions paid to staff
  commissions: number // Legacy field (= platformFees for backwards compatibility)
  totalCollected: number
  // True profit after all costs
  netProfit: number
  /** Cobros (desde el 21-nov el servidor ya no cuenta aquí las devoluciones: van en `refundCount`). */
  transactionCount: number
  // Carril B (21-nov-2026) — aditivos y opcionales: un servidor viejo no los manda.
  /** «Sin cobrar» (D6): lo que deben las cuentas abiertas o pagadas a medias, sin propina. NO es venta. Null en la vista de movimientos. */
  unpaidSales?: number | null
  /** Cuántas cuentas abiertas deben algo. */
  unpaidOrders?: number | null
  /** Comisiones de terceros (D1): Rappi, Uber Eats, DiDi, tipos de pago con comisión. Ya restadas de `totalCollected`. */
  tenderCommissions?: number
  /** Cuántas devoluciones hay en `refunds`. */
  refundCount?: number
  /**
   * Carril F (hz:fefa11b6:D16.2) — sólo en la vista de movimientos: los cobros de ese filtro sin devoluciones, con propina. Cierra la
   * cuenta al centavo: chargedAmount − refunds − platformFees − tenderCommissions = totalCollected. Un servidor viejo no lo manda.
   */
  chargedAmount?: number
  // Tarjetas de regalo (fase 1a, Parte B · B5) — aditivos y opcionales: un server sin la función no los manda.
  /** Tarjetas cargadas en el rango, menos sus cancelaciones. NO es venta: no está en grossSales. */
  giftCardLoads?: number
  /** Sobres de cuentas de tarjetas PAGADAS en el rango. */
  giftCardLoadsCount?: number
  /** Pagado con saldo (venta + propina), menos sus reversos. YA está dentro de las ventas: aquí sólo se separa. */
  paidWithGiftCardBalance?: number
  // Carril G · D5 (22-nov-2026) — aditivos; con `includePrepaid` y sin filtro. Cobrado por adelantado que NO es venta.
  /** Paquetes de clases comprados en línea en el rango. */
  packagesSoldOnline?: number
  packagesSoldOnlineCount?: number
  /** Depósitos de reservas cobrados en el rango menos los devueltos en el rango (neto). */
  reservationDeposits?: number
  /** Cuántos depósitos se cobraron en el rango. */
  reservationDepositsCount?: number
  /** Lo devuelto de depósitos en el rango. */
  reservationDepositsRefunded?: number
}

/**
 * La cabecera de la respuesta: las cifras (también las de cada periodo) y lo que sólo trae el total. Una lista no va en
 * `SalesSummaryMetrics`, que la tabla por periodo recorre como números.
 */
export interface SalesSummaryHeadline extends SalesSummaryMetrics {
  /** Carril G · D5: paquetes en línea cobrados en otra moneda; aparte, nunca sumados a los pesos. */
  packagesSoldOnlineOtherCurrencies?: Array<{ currency: string; amount: number; count: number }>
}

/**
 * Carril G · D4: un renglón de «Ventas por canal» o «Por tipo de pedido». Las mismas unidades que la cabecera; el SERVIDOR reparte
 * cada importe al centavo, así que la suma de los renglones da la cabecera. `orderCount` es null en el QR del sistema anterior.
 */
export interface SalesBreakdownRow {
  key: string
  grossSales: number
  discounts: number
  refunds: number
  netSales: number
  tips: number
  platformFees: number
  tenderCommissions: number
  totalCollected: number
  orderCount: number | null
  transactionCount: number
  refundCount: number
}

export interface PaymentMethodBreakdown {
  method: string
  amount: number
  count: number
  percentage: number
}

export interface PaymentMethodDetailedBreakdown {
  bucket: 'CARD' | 'CASH' | 'OTHER' | 'QR_LEGACY'
  /** Movimiento del cajón: cobros MENOS devoluciones, con propina (puede ser negativo el día de una devolución). */
  amount: number
  /** Filas del cajón, devoluciones incluidas. */
  count: number
  percentage: number
  tips: number
  refunds: number
  platformFees: number
  // Aditivos (carril C, 21-nov-2026). Un SERVIDOR viejo no los manda: el estado de cuenta cae a las cifras de antes.
  /** Sólo cobros (sin devoluciones), con propina. */
  chargedAmount?: number
  /** Cuántos cobros (sin devoluciones). */
  chargedCount?: number
  /** Comisión congelada de Rappi/Uber o de un tipo de pago propio, con signo. */
  tenderCommissions?: number
  /** Devuelto de cuentas canceladas o borradas: salió dinero, pero la cabecera no lo resta (su venta tampoco se cuenta). */
  cancelledOrderRefunds?: number
  /** Aditivo (carril C2): de `amount`/`count`, lo cobrado en OTRA moneda (sin convertir); el estado lo descuenta. */
  foreignAmount?: number
  foreignCount?: number
  subBuckets?: Array<{
    type: 'CREDIT' | 'DEBIT' | 'AMEX' | 'INTERNATIONAL'
    amount: number
    count: number
    percentage: number
    platformFees: number
    chargedAmount?: number
    chargedCount?: number
    /** Aditivo (carril C): la comisión redondeada por cobro, la misma base del estado de cuenta. */
    platformFeesCents?: number
  }>
}

/** El dinero de un destino del estado de cuenta (misma forma que un comercio: neto con sus devoluciones). Aditivo, carril C. */
export interface MoneyDestination {
  collected: number
  refunds: number
  refundCount: number
  platformFee: number
  netToReceive: number
  transactionCount: number
}

/**
 * Aditivo (carril C): a dónde fue cada cobro, UN destino por cobro, leído con los cajones (el SERVIDOR lo decide con su
 * autoridad de «¿está en el cajón?» y «¿lo deposita Avoqado?»). `tenderCommissions` se resta aparte.
 */
export interface StatementDestinations {
  terminal: MoneyDestination
  drawer: MoneyDestination
  online: MoneyDestination
  other: MoneyDestination
  tenderCommissions: number
  /** Aditivo (carril C2, D12.3): «otros» por tipo de pago; suman `other`. */
  otherByType?: OtherTypeBreakdown[]
  /** Aditivo (carril C2, D17): lo movido en otra moneda (neto, sin convertir), fuera de las cuentas en pesos. */
  foreignCurrency?: Array<{ currency: string; net: number; transactionCount: number; refundCount: number }>
}

/** Un tipo de «otros»: `key` es el id del tipo de pago propio (con su nombre en `label`) o el método (`label` null). */
export interface OtherTypeBreakdown extends MoneyDestination {
  key: string
  label: string | null
  method: string
  tenderCommissions: number
}

/** Lo pagado con saldo de tarjeta de regalo, FUERA de los buckets (B5: un bucket nuevo tumbaría al panel que no lo conoce). */
export interface GiftCardBalanceBreakdown {
  amount: number
  count: number
  tips: number
  refunds: number
}

export interface TimePeriodMetrics {
  period: string
  periodLabel?: string
  metrics: SalesSummaryMetrics
}

export type ReportType = 'summary' | 'hours' | 'days' | 'weeks' | 'months' | 'hourlySum' | 'dailySum'
export type GroupBy = 'none' | 'paymentMethod'

/** Active settlement rule for one card type on a merchant account. Additive —
 *  present only when the backend attaches it (guard `?.length` everywhere). */
export interface MerchantSettlementRule {
  cardType: 'CREDIT' | 'DEBIT' | 'AMEX' | 'INTERNATIONAL' | 'OTHER'
  settlementDays: number
}

export interface MerchantAccountBreakdown {
  merchantAccountId: string
  displayName: string
  provider: string
  affiliation: string | null
  collectedOnCard: number
  platformFee: number
  netToReceive: number
  transactionCount: number
  /** Soonest estimated settlement; present only when includeSettlementProjection=true. */
  estimatedSettlement?: {
    nextDate: string | null // YYYY-MM-DD in venue timezone
    settlementDays: number | null
  }
  /** Per-card-type settlement rules (active SettlementConfiguration); present
   *  only when includeMerchantBreakdown=true and the account has rules. */
  settlementRules?: MerchantSettlementRule[]
  /** Aditivo (carril C): lo devuelto a tarjeta en el rango (positivo), ya restado de `collectedOnCard` y `netToReceive`. */
  refunds?: number
  /** Aditivo (carril C): cuántas de `transactionCount` son devoluciones. */
  refundCount?: number
  /** Aditivo (carril C): neto de sus cobros sin fecha estimada (sin costo todavía o sin regla). */
  unprojectedNet?: number
}

// Entrega 2 — settlement projection ("¿cuándo cae el dinero?").
export interface SettlementCalendarMerchant {
  merchantAccountId: string
  displayName: string
  platformFee: number
  netToReceive: number
  transactionCount: number
}

export interface SettlementCalendarDay {
  date: string // YYYY-MM-DD settlement date in venue timezone
  status: 'settled' | 'pending' | 'projected' // vs today: past / today / future
  totalNet: number
  byMerchant: SettlementCalendarMerchant[]
}

export interface SalesSummaryResponse {
  dateRange: {
    startDate: string
    endDate: string
  }
  reportType: ReportType
  summary: SalesSummaryHeadline
  byPaymentMethod?: PaymentMethodBreakdown[]
  /** Aditivo (tarjetas de regalo, full-testing v2 #1): VENTAS por método para la barra bajo el total; `byPaymentMethod` es DINERO. */
  salesByPaymentMethod?: PaymentMethodBreakdown[]
  byPaymentMethodDetailed?: PaymentMethodDetailedBreakdown[]
  byPeriod?: TimePeriodMetrics[]
  /** Per-merchant-account card breakdown; present only when includeMerchantBreakdown=true. */
  byMerchantAccount?: MerchantAccountBreakdown[]
  /** Aditivo (carril C): a dónde fue cada cobro; con `includeMerchantBreakdown` y sin filtro de método. */
  statementDestinations?: StatementDestinations
  /** Settlement projection calendar; present only when includeSettlementProjection=true. */
  settlementCalendar?: SettlementCalendarDay[]
  /** True when a payment filter is active; order-level metrics are then null. */
  filtered: boolean
  /** Lo pagado con saldo de tarjetas de regalo (B5); sólo con groupBy=paymentMethod y sin filtro. Opcional. */
  giftCardBalanceBreakdown?: GiftCardBalanceBreakdown
  /** Aditivo (D15): el servidor no pudo leer todos los cobros del sistema anterior de QR; estas cifras pueden estar incompletas. */
  legacyUnavailable?: true
  /** Carril G · D4 (todos los planes): la cabecera por canal y por tipo de pedido; con `includeChannelBreakdown` y sin filtro. */
  byChannel?: SalesBreakdownRow[]
  byOrderType?: SalesBreakdownRow[]
  /** Las tablas por canal se leyeron un instante después de la cabecera y alguna cifra cambió (entró una venta): recargar. */
  channelBreakdownOutOfSync?: true
  /** Carril F2: sólo si se pidió `compareTo`. Lo que impide comparar viene en `status`; el reporte de arriba sale siempre. */
  comparison?: SalesSummaryComparison
}

/** Carril F2 (hz:fefa11b6:D7): contra qué se compara el Resumen de ventas. */
export type CompararCon = 'previous_period' | 'previous_year'

/** La diferencia que calcula el SERVIDOR (la pantalla sólo pinta). `percent` null con base 0 o negativa; `isNew` si antes era $0. */
export interface CambioDeCifra {
  difference: number
  percent: number | null
  isNew: boolean
}

export interface SalesSummaryComparison {
  compareTo: CompararCon
  status: 'ok' | 'plan' | 'notStarted' | 'tooLong' | 'legacyQr'
  /** En español, cuando `status` no es `ok`. */
  message?: string
  asOf?: string
  /** Lo que se leyó de cada lado (el actual, hasta la hora del corte si va a la mitad). */
  baseRange?: { startDate: string; endDate: string }
  dateRange?: { startDate: string; endDate: string }
  untilSameTime?: boolean
  /** 52 semanas antes: mismos días de la semana. */
  matchedWeekday?: boolean
  summary?: SalesSummaryHeadline
  changes?: Partial<Record<keyof SalesSummaryMetrics, CambioDeCifra | null>>
  /** El negocio del QR anterior: el periodo comparado no trae esos cobros y no se calcula el cambio. */
  excludesLegacyQr?: true
}

export interface SalesSummaryFilters {
  // Included only to scope the query cache per venue. The backend resolves
  // venueId from auth, so it is not sent on the request.
  venueId?: string
  startDate: string
  endDate: string
  groupBy?: GroupBy
  reportType?: ReportType
  merchantAccountId?: string
  paymentMethod?: PaymentMethodFilter
  cardType?: CardTypeFilter
  includeMerchantBreakdown?: boolean
  includeSettlementProjection?: boolean
  /** Carril G · D4: «Ventas por canal» (el servidor la deja pasar sólo con el plan). */
  includeChannelBreakdown?: boolean
  /** Carril G · D5: paquetes en línea y depósitos de reservas en el resumen. */
  includePrepaid?: boolean
  /** Carril F2: también el otro periodo (Pro). */
  compareTo?: CompararCon
}

export interface ApiResponse<T> {
  success: boolean
  data: T
}

// ============================================================
// API Functions
// ============================================================

/**
 * Fetch sales summary report for the authenticated venue
 *
 * @param filters - Date range and optional grouping/report type
 * @returns Sales summary data with metrics, payment breakdown, and time periods
 */
export async function fetchSalesSummary(
  filters: SalesSummaryFilters,
): Promise<SalesSummaryResponse> {
  const response = await api.get<ApiResponse<SalesSummaryResponse>>(
    '/api/v1/dashboard/reports/sales-summary',
    {
      params: {
        startDate: filters.startDate,
        endDate: filters.endDate,
        groupBy: filters.groupBy || 'none',
        reportType: filters.reportType || 'summary',
        ...(filters.merchantAccountId ? { merchantAccountId: filters.merchantAccountId } : {}),
        ...(filters.paymentMethod ? { paymentMethod: filters.paymentMethod } : {}),
        ...(filters.paymentMethod === 'CARD' && filters.cardType ? { cardType: filters.cardType } : {}),
        ...(filters.includeMerchantBreakdown ? { includeMerchantBreakdown: 'true' } : {}),
        ...(filters.includeSettlementProjection ? { includeSettlementProjection: 'true' } : {}),
        ...(filters.includeChannelBreakdown ? { includeChannelBreakdown: 'true' } : {}),
        ...(filters.includePrepaid ? { includePrepaid: 'true' } : {}),
        ...(filters.compareTo ? { compareTo: filters.compareTo } : {}),
      },
      // Tell the backend which venue is active. This endpoint has no :venueId in
      // its URL, so without this header it would fall back to the (possibly stale)
      // JWT venue and report the wrong venue's sales after a deep-link/refresh.
      ...(filters.venueId ? { headers: { 'x-venue-id': filters.venueId } } : {}),
      withCredentials: true,
    },
  )
  return response.data.data
}

// ============================================================
// Query Key Factory
// ============================================================

export const salesSummaryKeys = {
  all: ['salesSummary'] as const,
  summary: (filters: SalesSummaryFilters) =>
    [...salesSummaryKeys.all, 'report', filters] as const,
}
