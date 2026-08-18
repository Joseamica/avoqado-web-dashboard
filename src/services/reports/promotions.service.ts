/**
 * Promotions Sales Report Service
 *
 * Cliente del reporte de promociones (`/api/v1/dashboard/reports/promotions`):
 * el COMBO como renglón, con su nombre tal como se cobró.
 *
 * Es la mitad "Fudo/Toast" de una decisión deliberada (founder, 2026-08-18): el
 * combo se reporta como renglón aquí, y "Ventas por artículo" desglosa los
 * COMPONENTES marcándolos "dentro de «Combo X»" (modelo Square). Las dos vistas
 * existen a propósito, sin switch — NO se suman entre sí.
 */

import api from '@/api'

// ============================================================
// Types
// ============================================================

export type PromotionReportType = 'summary' | 'hours' | 'days' | 'weeks' | 'months'

export interface PromotionSalesRow {
  promotionId: string
  /** El nombre TAL COMO SE COBRÓ (snapshot). Renombrar la promo no reescribe el pasado. */
  name: string
  /** BUNDLE | COMBO */
  type: string | null
  /** FIXED_TOTAL | PER_UNIT (2x1) */
  pricingMode: string | null
  timesSold: number
  grossSales: number
  discounts: number
  netSales: number
  /** Ventas marcadas para revisión (promo archivada / fuera de vigencia al sincronizar). */
  needsReview: number
}

export interface PromotionPeriodMetrics {
  period: string
  periodLabel?: string
  timesSold: number
  grossSales: number
  discounts: number
  netSales: number
}

export interface PromotionSalesResponse {
  dateRange: { startDate: string; endDate: string }
  reportType: PromotionReportType
  timezone: string
  promotions: PromotionSalesRow[]
  byPeriod?: PromotionPeriodMetrics[]
  totals: {
    promotionsCount: number
    timesSold: number
    grossSales: number
    discounts: number
    netSales: number
    needsReview: number
  }
}

export interface PromotionSalesFilters {
  // Venue activo — viaja como header x-venue-id porque esta ruta no lleva :venueId.
  venueId?: string
  startDate: string
  endDate: string
  reportType?: PromotionReportType
}

interface ApiResponse<T> {
  success: boolean
  data: T
}

// ============================================================
// API Functions
// ============================================================

export async function fetchPromotionSales(filters: PromotionSalesFilters): Promise<PromotionSalesResponse> {
  const response = await api.get<ApiResponse<PromotionSalesResponse>>('/api/v1/dashboard/reports/promotions', {
    params: {
      startDate: filters.startDate,
      endDate: filters.endDate,
      reportType: filters.reportType || 'summary',
    },
    // Sin este header el backend caería al venue (posiblemente viejo) del JWT.
    ...(filters.venueId ? { headers: { 'x-venue-id': filters.venueId } } : {}),
    withCredentials: true,
  })
  return response.data.data
}

// ============================================================
// Query Key Factory
// ============================================================

export const promotionSalesKeys = {
  all: ['promotionSales'] as const,
  report: (filters: PromotionSalesFilters) => [...promotionSalesKeys.all, 'report', filters] as const,
}
