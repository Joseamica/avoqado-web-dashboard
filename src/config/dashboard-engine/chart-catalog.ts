/**
 * Dashboard Engine — Chart Catalog
 *
 * 19 chart and metric-panel definitions available for dashboard rows.
 * Each entry maps to a React component via componentId.
 */

import type { ChartDefinition } from './types'

export const CHART_CATALOG: Record<string, ChartDefinition> = {
  // ==========================================
  // Original 12 charts (existing)
  // ==========================================
  payment_methods: {
    id: 'payment_methods',
    titleKey: 'sections.paymentMethods',
    requiredDataModules: ['payments'],
    dataSource: { type: 'basic', endpoint: '' },
    componentId: 'PaymentMethodsPie',
    skeletonType: 'chart',
  },
  best_selling_products: {
    id: 'best_selling_products',
    titleKey: 'sections.bestSellers',
    requiredDataModules: ['orders'],
    dataSource: { type: 'chart', endpoint: 'best-selling-products' },
    componentId: 'BestSellingProductsChart',
    skeletonType: 'product-list',
  },
  revenue_trends: {
    id: 'revenue_trends',
    titleKey: 'sections.revenueTrends',
    requiredDataModules: ['payments'],
    dataSource: { type: 'chart', endpoint: 'revenue-trends' },
    componentId: 'RevenueTrendsChart',
    skeletonType: 'chart',
    hidesOnSingleDay: true,
  },
  aov_trends: {
    id: 'aov_trends',
    titleKey: 'aov.title',
    requiredDataModules: ['payments'],
    dataSource: { type: 'chart', endpoint: 'aov-trends' },
    componentId: 'AOVTrendsChart',
    skeletonType: 'chart',
  },
  order_frequency: {
    id: 'order_frequency',
    titleKey: 'orderFrequency.title',
    requiredDataModules: ['orders'],
    dataSource: { type: 'chart', endpoint: 'order-frequency' },
    componentId: 'OrderFrequencyChart',
    skeletonType: 'chart',
  },
  customer_satisfaction: {
    id: 'customer_satisfaction',
    titleKey: 'customerSatisfaction.title',
    requiredDataModules: ['reviews'],
    dataSource: { type: 'chart', endpoint: 'customer-satisfaction' },
    componentId: 'CustomerSatisfactionChart',
    skeletonType: 'chart',
  },
  peak_hours: {
    id: 'peak_hours',
    titleKey: 'sections.peakHours',
    requiredDataModules: ['payments'],
    dataSource: { type: 'chart', endpoint: 'peak-hours' },
    componentId: 'PeakHoursChart',
    skeletonType: 'chart',
  },
  kitchen_performance: {
    id: 'kitchen_performance',
    titleKey: 'kitchen.title',
    requiredDataModules: ['kitchen_performance'],
    dataSource: { type: 'chart', endpoint: 'kitchen-performance' },
    componentId: 'KitchenPerformanceChart',
    skeletonType: 'chart',
  },
  tips_over_time: {
    id: 'tips_over_time',
    titleKey: 'sections.tipsOverTime',
    requiredDataModules: ['payments', 'tips'],
    dataSource: { type: 'chart', endpoint: 'tips-over-time' },
    componentId: 'TipsOverTimeChart',
    skeletonType: 'chart',
  },
  staff_efficiency: {
    id: 'staff_efficiency',
    titleKey: 'sections.staffEfficiency',
    requiredDataModules: ['staff_performance'],
    dataSource: { type: 'metric', endpoint: 'staff-efficiency' },
    componentId: 'StaffEfficiencyMetrics',
    skeletonType: 'staff',
  },
  table_efficiency: {
    id: 'table_efficiency',
    titleKey: 'sections.tableEfficiency',
    requiredDataModules: ['table_performance'],
    dataSource: { type: 'metric', endpoint: 'table-efficiency' },
    componentId: 'TableEfficiencyMetrics',
    skeletonType: 'table-perf',
  },
  product_analytics: {
    id: 'product_analytics',
    titleKey: 'sections.productAnalytics',
    requiredDataModules: ['orders'],
    dataSource: { type: 'metric', endpoint: 'product-analytics' },
    componentId: 'ProductAnalyticsMetrics',
    skeletonType: 'table',
  },

  // ==========================================
  // 7 New charts
  // ==========================================
  sales_by_weekday: {
    id: 'sales_by_weekday',
    titleKey: 'salesByWeekday.title',
    requiredDataModules: ['orders'],
    dataSource: { type: 'chart', endpoint: 'sales-by-weekday' },
    componentId: 'SalesByWeekdayChart',
    skeletonType: 'chart',
  },
  category_mix: {
    id: 'category_mix',
    titleKey: 'categoryMix.title',
    requiredDataModules: ['orders'],
    dataSource: { type: 'chart', endpoint: 'category-mix' },
    componentId: 'CategoryMixChart',
    skeletonType: 'chart',
  },
  channel_mix: {
    id: 'channel_mix',
    titleKey: 'channelMix.title',
    requiredDataModules: ['orders'],
    dataSource: { type: 'chart', endpoint: 'channel-mix' },
    componentId: 'ChannelMixChart',
    skeletonType: 'chart',
  },
  sales_heatmap: {
    id: 'sales_heatmap',
    titleKey: 'salesHeatmap.title',
    requiredDataModules: ['orders'],
    dataSource: { type: 'chart', endpoint: 'sales-heatmap' },
    componentId: 'SalesHeatmapChart',
    skeletonType: 'chart',
  },
  discount_analysis: {
    id: 'discount_analysis',
    titleKey: 'discountAnalysis.title',
    requiredDataModules: ['orders'],
    dataSource: { type: 'chart', endpoint: 'discount-analysis' },
    componentId: 'DiscountAnalysisChart',
    skeletonType: 'chart',
  },
  reservation_overview: {
    id: 'reservation_overview',
    titleKey: 'reservationOverview.title',
    requiredDataModules: ['reservations'],
    dataSource: { type: 'chart', endpoint: 'reservation-overview' },
    componentId: 'ReservationOverviewChart',
    skeletonType: 'chart',
  },
  staff_ranking: {
    id: 'staff_ranking',
    titleKey: 'staffRanking.title',
    requiredDataModules: ['staff_performance'],
    dataSource: { type: 'chart', endpoint: 'staff-ranking' },
    componentId: 'StaffRankingTable',
    skeletonType: 'table',
  },
}
