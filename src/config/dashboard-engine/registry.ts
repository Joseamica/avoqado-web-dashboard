/**
 * Dashboard Engine — Registry
 *
 * Dashboard packs per BusinessCategory + resolver that filters
 * by data availability to produce a ResolvedDashboard.
 *
 * Each pack defines a dramatically different layout tailored
 * to the business type. The resolver filters out items whose
 * required data modules aren't available.
 */

import type { BusinessCategory } from '@/types'
import type { DashboardPack, DashboardRow, ResolvedDashboard, ResolvedRow } from './types'
import { METRIC_CATALOG } from './metric-catalog'
import { CHART_CATALOG } from './chart-catalog'
import { getDataAvailability } from './data-availability'

// ==========================================
// Dashboard Packs per Business Category
// ==========================================

/**
 * FOOD_SERVICE — Full restaurant dashboard
 * 6 KPIs: sales, orders, avg covers, avg tip %, tips, SPLH
 * 11 chart rows including kitchen, heatmap, channel mix
 */
const FOOD_SERVICE_PACK: DashboardPack = {
  category: 'FOOD_SERVICE',
  heroKpis: ['total_sales', 'total_orders', 'avg_covers', 'avg_tip_pct', 'total_tips', 'splh'],
  rows: [
    { id: 'fs-payment-bestsellers', layout: 'weighted', items: ['payment_methods', 'best_selling_products'], priority: 1 },
    { id: 'fs-revenue', layout: 'full', items: ['revenue_trends'], priority: 2 },
    { id: 'fs-channel-category', layout: 'split', items: ['channel_mix', 'category_mix'], priority: 3 },
    { id: 'fs-heatmap-weekday', layout: 'split', items: ['sales_heatmap', 'sales_by_weekday'], priority: 4 },
    { id: 'fs-aov-orders', layout: 'split', items: ['aov_trends', 'order_frequency'], priority: 5 },
    { id: 'fs-staff-table', layout: 'split', items: ['staff_efficiency', 'table_efficiency'], priority: 6 },
    { id: 'fs-staff-ranking', layout: 'full', items: ['staff_ranking'], priority: 7 },
    { id: 'fs-satisfaction', layout: 'full', items: ['customer_satisfaction'], priority: 8 },
    { id: 'fs-peak-kitchen', layout: 'split', items: ['peak_hours', 'kitchen_performance'], priority: 9 },
    { id: 'fs-tips', layout: 'full', items: ['tips_over_time'], priority: 10 },
    { id: 'fs-discount-products', layout: 'split', items: ['discount_analysis', 'product_analytics'], priority: 11 },
  ],
}

/**
 * RETAIL — Inventory & transaction focused
 * 6 KPIs: sales, transactions, avg ticket, items/order, unique customers, discounts
 * 9 chart rows — NO tips, NO kitchen, NO tables
 * Category mix and product analytics prominent
 */
const RETAIL_PACK: DashboardPack = {
  category: 'RETAIL',
  heroKpis: ['total_sales', 'total_transactions', 'avg_ticket', 'avg_items_per_order', 'unique_customers', 'total_discounts'],
  rows: [
    { id: 'rt-payment-bestsellers', layout: 'weighted', items: ['payment_methods', 'best_selling_products'], priority: 1 },
    { id: 'rt-revenue', layout: 'full', items: ['revenue_trends'], priority: 2 },
    { id: 'rt-category-channel', layout: 'split', items: ['category_mix', 'channel_mix'], priority: 3 },
    { id: 'rt-weekday', layout: 'full', items: ['sales_by_weekday'], priority: 4 },
    { id: 'rt-aov-orders', layout: 'split', items: ['aov_trends', 'order_frequency'], priority: 5 },
    { id: 'rt-staff', layout: 'full', items: ['staff_efficiency'], priority: 6 },
    { id: 'rt-staff-ranking', layout: 'full', items: ['staff_ranking'], priority: 7 },
    { id: 'rt-discount-products', layout: 'split', items: ['discount_analysis', 'product_analytics'], priority: 8 },
    { id: 'rt-satisfaction', layout: 'full', items: ['customer_satisfaction'], priority: 9 },
  ],
}

/**
 * SERVICES — Appointment & reservation focused (salons, clinics, fitness)
 * 6 KPIs: sales, reservations, no-show %, cancellation %, tips, avg ticket
 * Reservation overview as FIRST chart
 */
const SERVICES_PACK: DashboardPack = {
  category: 'SERVICES',
  heroKpis: ['total_sales', 'total_reservations', 'no_show_rate', 'cancellation_rate', 'total_tips', 'avg_ticket'],
  rows: [
    { id: 'sv-reservations', layout: 'full', items: ['reservation_overview'], priority: 1 },
    { id: 'sv-payment-bestsellers', layout: 'weighted', items: ['payment_methods', 'best_selling_products'], priority: 2 },
    { id: 'sv-revenue', layout: 'full', items: ['revenue_trends'], priority: 3 },
    { id: 'sv-weekday-category', layout: 'split', items: ['sales_by_weekday', 'category_mix'], priority: 4 },
    { id: 'sv-aov-orders', layout: 'split', items: ['aov_trends', 'order_frequency'], priority: 5 },
    { id: 'sv-staff', layout: 'full', items: ['staff_efficiency'], priority: 6 },
    { id: 'sv-staff-ranking', layout: 'full', items: ['staff_ranking'], priority: 7 },
    { id: 'sv-satisfaction', layout: 'full', items: ['customer_satisfaction'], priority: 8 },
    { id: 'sv-tips', layout: 'full', items: ['tips_over_time'], priority: 9 },
  ],
}

/**
 * HOSPITALITY — Reservation & guest experience focused (hotels, hostels, resorts)
 * 6 KPIs: sales, reservations, no-show %, reviews, tips, avg tip %
 * Reservation overview prominent
 */
const HOSPITALITY_PACK: DashboardPack = {
  category: 'HOSPITALITY',
  heroKpis: ['total_sales', 'total_reservations', 'no_show_rate', 'five_star_reviews', 'total_tips', 'avg_tip_pct'],
  rows: [
    { id: 'hs-reservations', layout: 'full', items: ['reservation_overview'], priority: 1 },
    { id: 'hs-payment-bestsellers', layout: 'weighted', items: ['payment_methods', 'best_selling_products'], priority: 2 },
    { id: 'hs-revenue', layout: 'full', items: ['revenue_trends'], priority: 3 },
    { id: 'hs-channel-category', layout: 'split', items: ['channel_mix', 'category_mix'], priority: 4 },
    { id: 'hs-weekday', layout: 'full', items: ['sales_by_weekday'], priority: 5 },
    { id: 'hs-aov-orders', layout: 'split', items: ['aov_trends', 'order_frequency'], priority: 6 },
    { id: 'hs-staff-table', layout: 'split', items: ['staff_efficiency', 'table_efficiency'], priority: 7 },
    { id: 'hs-staff-ranking', layout: 'full', items: ['staff_ranking'], priority: 8 },
    { id: 'hs-satisfaction', layout: 'full', items: ['customer_satisfaction'], priority: 9 },
    { id: 'hs-tips', layout: 'full', items: ['tips_over_time'], priority: 10 },
  ],
}

/**
 * ENTERTAINMENT — Event & experience focused (cinemas, arcades, nightclubs)
 * 6 KPIs: sales, orders, reviews, tips, avg tip %, unique customers
 * No kitchen, no tables
 */
const ENTERTAINMENT_PACK: DashboardPack = {
  category: 'ENTERTAINMENT',
  heroKpis: ['total_sales', 'total_orders', 'five_star_reviews', 'total_tips', 'avg_tip_pct', 'unique_customers'],
  rows: [
    { id: 'en-payment-bestsellers', layout: 'weighted', items: ['payment_methods', 'best_selling_products'], priority: 1 },
    { id: 'en-revenue', layout: 'full', items: ['revenue_trends'], priority: 2 },
    { id: 'en-weekday-category', layout: 'split', items: ['sales_by_weekday', 'category_mix'], priority: 3 },
    { id: 'en-aov-orders', layout: 'split', items: ['aov_trends', 'order_frequency'], priority: 4 },
    { id: 'en-staff', layout: 'full', items: ['staff_efficiency'], priority: 5 },
    { id: 'en-staff-ranking', layout: 'full', items: ['staff_ranking'], priority: 6 },
    { id: 'en-satisfaction', layout: 'full', items: ['customer_satisfaction'], priority: 7 },
    { id: 'en-tips', layout: 'full', items: ['tips_over_time'], priority: 8 },
  ],
}

/**
 * OTHER — Minimal dashboard for unclassified businesses
 * 4 KPIs: sales, reviews, transactions, avg ticket
 * Basic chart set only
 */
const OTHER_PACK: DashboardPack = {
  category: 'OTHER',
  heroKpis: ['total_sales', 'five_star_reviews', 'total_transactions', 'avg_ticket'],
  rows: [
    { id: 'ot-payment-bestsellers', layout: 'weighted', items: ['payment_methods', 'best_selling_products'], priority: 1 },
    { id: 'ot-revenue', layout: 'full', items: ['revenue_trends'], priority: 2 },
    { id: 'ot-weekday', layout: 'full', items: ['sales_by_weekday'], priority: 3 },
    { id: 'ot-aov-orders', layout: 'split', items: ['aov_trends', 'order_frequency'], priority: 4 },
    { id: 'ot-peak', layout: 'full', items: ['peak_hours'], priority: 5 },
    { id: 'ot-products', layout: 'full', items: ['product_analytics'], priority: 6 },
  ],
}

const DASHBOARD_PACKS: Record<BusinessCategory, DashboardPack> = {
  FOOD_SERVICE: FOOD_SERVICE_PACK,
  RETAIL: RETAIL_PACK,
  SERVICES: SERVICES_PACK,
  HOSPITALITY: HOSPITALITY_PACK,
  ENTERTAINMENT: ENTERTAINMENT_PACK,
  OTHER: OTHER_PACK,
}

// ==========================================
// Resolver
// ==========================================

function hasRequiredModules(
  requiredModules: readonly string[],
  available: Set<string>,
): boolean {
  return requiredModules.every(m => available.has(m))
}

function resolveRows(rows: DashboardRow[], available: Set<string>): ResolvedRow[] {
  return rows
    .sort((a, b) => a.priority - b.priority)
    .reduce<ResolvedRow[]>((acc, row) => {
      const resolvedItems = row.items
        .map(itemId => CHART_CATALOG[itemId])
        .filter(chart => chart && hasRequiredModules(chart.requiredDataModules, available))

      if (resolvedItems.length === 0) return acc

      // Adjust layout if we lost an item from a split/weighted row
      let layout = row.layout
      if (resolvedItems.length === 1 && (layout === 'split' || layout === 'weighted')) {
        layout = 'full'
      }

      acc.push({ id: row.id, layout, items: resolvedItems })
      return acc
    }, [])
}

export function getResolvedDashboard(category: BusinessCategory): ResolvedDashboard {
  const pack = DASHBOARD_PACKS[category] || DASHBOARD_PACKS.FOOD_SERVICE
  const available = getDataAvailability(category)

  const heroKpis = pack.heroKpis
    .map(id => METRIC_CATALOG[id])
    .filter(metric => metric && hasRequiredModules(metric.requiredDataModules, available))

  const rows = resolveRows(pack.rows, available)

  return { heroKpis, rows }
}
