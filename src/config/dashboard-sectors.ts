/**
 * Dashboard Sector Configuration
 *
 * Declarative config for which chart sections and KPI cards
 * are visible per business sector on the Home dashboard.
 */

import type { BusinessCategory } from '@/types'

// ==========================================
// Chart Section IDs (must match Home.tsx usage)
// ==========================================

export type ChartSectionId =
  | 'payment-methods'
  | 'best-selling-products'
  | 'revenue-trends'
  | 'aov-trends'
  | 'order-frequency'
  | 'staff-efficiency'
  | 'table-efficiency'
  | 'customer-satisfaction'
  | 'peak-hours'
  | 'kitchen-performance'
  | 'tips-over-time'
  | 'product-analytics'

// ==========================================
// KPI Card IDs
// ==========================================

export type KpiCardId =
  | 'totalSales'
  | 'fiveStarReviews'
  | 'totalTips'
  | 'avgTipPercentage'
  | 'totalTransactions'
  | 'avgTicket'

// ==========================================
// Sector Dashboard Config Type
// ==========================================

export interface SectorDashboardConfig {
  kpiCards: KpiCardId[]
  visibleSections: Set<ChartSectionId>
}

// ==========================================
// All sections (used for FOOD_SERVICE which sees everything)
// ==========================================

const ALL_SECTIONS: ChartSectionId[] = [
  'payment-methods',
  'best-selling-products',
  'revenue-trends',
  'aov-trends',
  'order-frequency',
  'staff-efficiency',
  'table-efficiency',
  'customer-satisfaction',
  'peak-hours',
  'kitchen-performance',
  'tips-over-time',
  'product-analytics',
]

// ==========================================
// Sector Configurations
// ==========================================

export const SECTOR_DASHBOARD_CONFIG: Record<BusinessCategory, SectorDashboardConfig> = {
  FOOD_SERVICE: {
    kpiCards: ['totalSales', 'fiveStarReviews', 'totalTips', 'avgTipPercentage'],
    visibleSections: new Set(ALL_SECTIONS),
  },
  RETAIL: {
    kpiCards: ['totalSales', 'fiveStarReviews', 'totalTransactions', 'avgTicket'],
    visibleSections: new Set<ChartSectionId>([
      'payment-methods',
      'best-selling-products',
      'revenue-trends',
      'aov-trends',
      'order-frequency',
      'staff-efficiency',
      // table-efficiency: N
      'customer-satisfaction',
      'peak-hours',
      // kitchen-performance: N
      // tips-over-time: N
      'product-analytics',
    ]),
  },
  SERVICES: {
    kpiCards: ['totalSales', 'fiveStarReviews', 'totalTips', 'avgTicket'],
    visibleSections: new Set<ChartSectionId>([
      'payment-methods',
      'best-selling-products',
      'revenue-trends',
      'aov-trends',
      'order-frequency',
      'staff-efficiency',
      // table-efficiency: N
      'customer-satisfaction',
      'peak-hours',
      // kitchen-performance: N
      'tips-over-time',
      'product-analytics',
    ]),
  },
  HOSPITALITY: {
    kpiCards: ['totalSales', 'fiveStarReviews', 'totalTips', 'avgTipPercentage'],
    visibleSections: new Set<ChartSectionId>([
      'payment-methods',
      'best-selling-products',
      'revenue-trends',
      'aov-trends',
      'order-frequency',
      'staff-efficiency',
      'table-efficiency',
      'customer-satisfaction',
      'peak-hours',
      // kitchen-performance: N
      'tips-over-time',
      'product-analytics',
    ]),
  },
  ENTERTAINMENT: {
    kpiCards: ['totalSales', 'fiveStarReviews', 'totalTips', 'avgTipPercentage'],
    visibleSections: new Set<ChartSectionId>([
      'payment-methods',
      'best-selling-products',
      'revenue-trends',
      'aov-trends',
      'order-frequency',
      'staff-efficiency',
      'table-efficiency',
      'customer-satisfaction',
      'peak-hours',
      // kitchen-performance: N
      'tips-over-time',
      'product-analytics',
    ]),
  },
  OTHER: {
    kpiCards: ['totalSales', 'fiveStarReviews', 'totalTips', 'avgTipPercentage'],
    visibleSections: new Set<ChartSectionId>([
      'payment-methods',
      'best-selling-products',
      'revenue-trends',
      'aov-trends',
      'order-frequency',
      'staff-efficiency',
      // table-efficiency: N
      'customer-satisfaction',
      'peak-hours',
      // kitchen-performance: N
      // tips-over-time: N
      'product-analytics',
    ]),
  },
}
