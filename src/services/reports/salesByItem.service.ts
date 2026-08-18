/**
 * Sales by Item Report Service
 *
 * API client for the Sales by Item dashboard report.
 * Communicates with /api/v1/dashboard/reports/sales-by-item endpoint.
 */

import api from '@/api'

// ============================================================
// Types
// ============================================================

export type ReportType = 'summary' | 'hours' | 'days' | 'weeks' | 'months' | 'hourlySum' | 'dailySum'

export type GroupByOption =
  | 'none'
  | 'category'
  | 'channel'
  | 'paymentMethod'
  | 'device'
  | 'source'
  | 'serviceOption'
  | 'itemType'

export interface ItemSalesMetrics {
  productId: string | null
  productName: string
  productSku: string | null
  categoryName: string | null
  unit: string
  itemsSold: number
  unitsSold: number
  grossSales: number
  discounts: number
  netSales: number
  /**
   * Qué parte del renglón se vendió DENTRO de una promoción, con el nombre del
   * combo tal como se cobró. Sólo viene con `groupBy = 'none'`.
   *
   * Este reporte sigue el modelo SQUARE (desglosa los COMPONENTES) y el reporte
   * de Promociones el de FUDO/TOAST (el combo como renglón): son las dos vistas
   * que el founder decidió dar sin switch (2026-08-18), y esta marca es lo que
   * evita que se lean como contabilidad doble.
   *
   * 🔴 Declarar los campos NO es opcional: el server los manda, pero si el tipo
   * no los tiene TypeScript los tira en silencio — le pasó exactamente eso a
   * `discounts`/`netSales` el 2026-08-17 (ver TimePeriodItemMetrics abajo).
   */
  promotions?: Array<{ name: string; unitsSold: number; netSales: number }>
  /**
   * El nombre cuando TODA la parte promocionada del renglón vino de UNA sola
   * promoción. `null` si vino de varias (la UI dice "en N promociones");
   * ausente si el producto nunca se vendió en promoción.
   */
  promotionName?: string | null
}

export interface TimePeriodItemMetrics {
  period: string
  periodLabel?: string
  /**
   * Precio de lista: SUM(unitPrice * quantity). Deliberadamente BRUTO — la barra de la gráfica
   * dice "Ventas brutas", igual que el encabezado de la tabla (paridad con Square: bruto y
   * descuento como líneas separadas, no un neto disfrazado).
   */
  grossSales: number
  itemsSold: number
  /**
   * El server los manda desde el fix de 2026-08-17 (`sales-by-item.dashboard.service.ts`), pero
   * este tipo no los declaraba: llegaban en el JSON y TypeScript los tiraba, así que la gráfica
   * sólo podía pintar el bruto. Resultado visible: la barra decía 806 y la tabla de abajo 781,
   * sin nada que explicara los 25 de diferencia.
   */
  discounts: number
  netSales: number
}

export interface SalesByItemResponse {
  dateRange: {
    startDate: string
    endDate: string
  }
  reportType: ReportType
  items: ItemSalesMetrics[]
  byPeriod?: TimePeriodItemMetrics[]
  totals: {
    itemsSold: number
    unitsSold: number
    grossSales: number
    discounts: number
    netSales: number
  }
}

export interface SalesByItemFilters {
  // Active venue id — sent as the x-venue-id header so the backend scopes the
  // report to the user's current venue (this endpoint has no :venueId in its URL).
  venueId?: string
  startDate: string
  endDate: string
  reportType?: ReportType
  groupBy?: GroupByOption
  // Hour range filter (optional)
  startHour?: string // Format: "HH:mm" e.g. "09:00"
  endHour?: string   // Format: "HH:mm" e.g. "17:00"
  // Optional filters
  categoryId?: string
  productId?: string
  channel?: string
  paymentMethod?: string
}

export interface ApiResponse<T> {
  success: boolean
  data: T
}

// ============================================================
// API Functions
// ============================================================

/**
 * Fetch sales by item report for the authenticated venue
 *
 * @param filters - Date range and optional grouping/report type
 * @returns Sales by item data with item metrics, totals, and time periods
 */
export async function fetchSalesByItem(
  filters: SalesByItemFilters,
): Promise<SalesByItemResponse> {
  const response = await api.get<ApiResponse<SalesByItemResponse>>(
    '/api/v1/dashboard/reports/sales-by-item',
    {
      params: {
        startDate: filters.startDate,
        endDate: filters.endDate,
        reportType: filters.reportType || 'summary',
        groupBy: filters.groupBy || 'none',
        startHour: filters.startHour,
        endHour: filters.endHour,
        categoryId: filters.categoryId,
        productId: filters.productId,
        channel: filters.channel,
        paymentMethod: filters.paymentMethod,
      },
      // See salesSummary.service.ts: this endpoint resolves venue from the header
      // (or the stale JWT venue if absent). Send the active venue explicitly.
      ...(filters.venueId ? { headers: { 'x-venue-id': filters.venueId } } : {}),
      withCredentials: true,
    },
  )
  return response.data.data
}

// ============================================================
// Query Key Factory
// ============================================================

export const salesByItemKeys = {
  all: ['salesByItem'] as const,
  report: (filters: SalesByItemFilters) =>
    [...salesByItemKeys.all, 'report', filters] as const,
}
