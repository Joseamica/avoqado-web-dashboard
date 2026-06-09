/**
 * Sales by Category Report Service
 *
 * API client for the Sales by Category dashboard report.
 *
 * There is no dedicated backend endpoint: this report reuses the
 * /api/v1/dashboard/reports/sales-by-item endpoint with `groupBy=category`
 * forced. The endpoint already aggregates OrderItems by category (using the
 * denormalized `categoryName`, falling back to the linked MenuCategory name),
 * so each returned "item" is actually one category. We remap the raw response
 * into a category-shaped payload so the page never has to know about the
 * underlying item endpoint.
 */

import api from '@/api'

// ============================================================
// Types
// ============================================================

export type ReportType = 'summary' | 'hours' | 'days' | 'weeks' | 'months' | 'hourlySum' | 'dailySum'

export interface CategorySalesMetrics {
  categoryName: string
  itemsSold: number
  unitsSold: number
  grossSales: number
  discounts: number
  netSales: number
}

export interface TimePeriodCategoryMetrics {
  period: string
  periodLabel?: string
  grossSales: number
  itemsSold: number
}

export interface SalesByCategoryResponse {
  dateRange: {
    startDate: string
    endDate: string
  }
  reportType: ReportType
  categories: CategorySalesMetrics[]
  byPeriod?: TimePeriodCategoryMetrics[]
  totals: {
    itemsSold: number
    unitsSold: number
    grossSales: number
    discounts: number
    netSales: number
  }
}

export interface SalesByCategoryFilters {
  // Active venue id — sent as the x-venue-id header so the backend scopes the
  // report to the user's current venue (this endpoint has no :venueId in its URL).
  venueId?: string
  startDate: string
  endDate: string
  reportType?: ReportType
  // Hour range filter (optional) — Format: "HH:mm"
  startHour?: string
  endHour?: string
}

// Raw shape returned by the sales-by-item endpoint (grouped by category, so
// `productName` carries the category name and product-specific fields are null).
interface RawItemMetrics {
  productName: string
  itemsSold: number
  unitsSold: number
  grossSales: number
  discounts: number
  netSales: number
}

interface RawSalesByItemResponse {
  dateRange: { startDate: string; endDate: string }
  reportType: ReportType
  items: RawItemMetrics[]
  byPeriod?: TimePeriodCategoryMetrics[]
  totals: {
    itemsSold: number
    unitsSold: number
    grossSales: number
    discounts: number
    netSales: number
  }
}

interface ApiResponse<T> {
  success: boolean
  data: T
}

// ============================================================
// API Functions
// ============================================================

/**
 * Fetch the sales-by-category report for the authenticated venue.
 *
 * @param filters - Date range, report type and optional hour range.
 * @returns Category-level sales metrics, totals and time-period breakdown.
 */
export async function fetchSalesByCategory(filters: SalesByCategoryFilters): Promise<SalesByCategoryResponse> {
  const response = await api.get<ApiResponse<RawSalesByItemResponse>>('/api/v1/dashboard/reports/sales-by-item', {
    params: {
      startDate: filters.startDate,
      endDate: filters.endDate,
      reportType: filters.reportType || 'summary',
      groupBy: 'category',
      startHour: filters.startHour,
      endHour: filters.endHour,
    },
    // This endpoint resolves the venue from the header (or the stale JWT venue if
    // absent). Send the active venue explicitly to avoid reporting the wrong venue.
    ...(filters.venueId ? { headers: { 'x-venue-id': filters.venueId } } : {}),
    withCredentials: true,
  })

  const raw = response.data.data

  return {
    dateRange: raw.dateRange,
    reportType: raw.reportType,
    categories: raw.items.map(item => ({
      categoryName: item.productName,
      itemsSold: item.itemsSold,
      unitsSold: item.unitsSold,
      grossSales: item.grossSales,
      discounts: item.discounts,
      netSales: item.netSales,
    })),
    byPeriod: raw.byPeriod,
    totals: raw.totals,
  }
}

// ============================================================
// Query Key Factory
// ============================================================

export const salesByCategoryKeys = {
  all: ['salesByCategory'] as const,
  report: (filters: SalesByCategoryFilters) => [...salesByCategoryKeys.all, 'report', filters] as const,
}
