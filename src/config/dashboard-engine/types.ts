/**
 * Dashboard Engine — Type Definitions
 *
 * Core types for the registry-based dashboard engine.
 * Each business category gets a tailored dashboard pack
 * controlling KPIs, charts, layout, and ordering.
 */

import type { BusinessCategory } from '@/types'

// What data modules the backend can provide for a given venue
export type DataModule =
  | 'payments'
  | 'reviews'
  | 'tips'
  | 'orders'
  | 'staff_performance'
  | 'table_performance'
  | 'kitchen_performance'
  | 'reservations'
// Future: | 'inventory' | 'appointments' | 'rooms' | 'memberships'

// KPI metric definition
export interface MetricDefinition {
  id: string
  nameKey: string // i18n key (e.g., 'cards.totalSales')
  // Optional sector-aware label override. If set, takes precedence over nameKey
  // for the matching BusinessCategory (e.g., RETAIL: 'cards.avgItemsPerOrderRetail').
  nameKeyByCategory?: Partial<Record<BusinessCategory, string>>
  format: 'currency' | 'number' | 'percentage'
  iconName: string // lucide icon name
  requiredDataModules: DataModule[]
  trendGoodWhen: 'up' | 'down'
  // Maps to existing computed values in useDashboardData return object
  valueKey: string // e.g., 'totalAmount', 'fiveStarReviews'
  changeKey: string // e.g., 'amountChangePercentage'
}

// Chart/metric-panel definition
export interface ChartDefinition {
  id: string
  titleKey: string
  requiredDataModules: DataModule[]
  dataSource: {
    type: 'chart' | 'metric' | 'basic' // 'basic' = uses data from useDashboardData
    endpoint: string // e.g., 'best-selling-products', 'staff-efficiency'
  }
  componentId: string // key for lazy component lookup
  skeletonType: 'chart' | 'product-list' | 'staff' | 'table-perf' | 'table'
  // Hide this chart when the selected range covers a single day (a line chart
  // with one data point is noise). Filtered in DashboardRenderer.
  hidesOnSingleDay?: boolean
}

// Layout for a row of charts
export interface DashboardRow {
  id: string
  layout: 'full' | 'split' | 'weighted' // 1 col | 2 equal cols | 4+3 cols
  items: string[] // chart catalog IDs (1 for full, 2 for split/weighted)
  priority: number // lower = renders higher on page
}

// A complete dashboard configuration for a business category
export interface DashboardPack {
  category: BusinessCategory
  heroKpis: string[] // metric catalog IDs, ordered by priority
  rows: DashboardRow[]
}

// The output after filtering by data availability
export interface ResolvedDashboard {
  heroKpis: MetricDefinition[]
  rows: ResolvedRow[]
}

export interface ResolvedRow {
  id: string
  layout: 'full' | 'split' | 'weighted'
  items: ChartDefinition[]
}
