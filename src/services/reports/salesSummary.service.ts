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
  transactionCount: number
  // Tarjetas de regalo (fase 1a, Parte B · B5) — aditivos y opcionales: un server sin la función no los manda.
  /** Tarjetas cargadas en el rango, menos sus cancelaciones. NO es venta: no está en grossSales. */
  giftCardLoads?: number
  /** Sobres de cuentas de tarjetas PAGADAS en el rango. */
  giftCardLoadsCount?: number
  /** Pagado con saldo (venta + propina), menos sus reversos. YA está dentro de las ventas: aquí sólo se separa. */
  paidWithGiftCardBalance?: number
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
  summary: SalesSummaryMetrics
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
