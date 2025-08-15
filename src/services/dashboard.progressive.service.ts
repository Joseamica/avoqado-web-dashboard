import api from '@/api'

// Types for chunked data loading
export interface BasicMetricsData {
  payments: any[]
  reviews: any[]
  paymentMethodsData: any[]
}

export interface ChartData {
  [key: string]: any
}

export interface ExtendedMetricsData {
  [key: string]: any
}

export interface DateRange {
  from: Date
  to: Date
}

// API service for progressive dashboard data loading
export class DashboardProgressiveService {
  private venueId: string

  constructor(venueId: string) {
    this.venueId = venueId
  }

  // Get basic metrics (priority load)
  async getBasicMetrics(dateRange: DateRange): Promise<BasicMetricsData> {
    const response = await api.get(`/api/v1/dashboard/venues/${this.venueId}/basic-metrics`, {
      params: {
        fromDate: dateRange.from.toISOString(),
        toDate: dateRange.to.toISOString(),
      },
    })
    return response.data
  }

  // Get specific chart data
  async getChartData(
    chartType: 'best-selling-products' | 'tips-over-time' | 'sales-by-payment-method' | 'peak-hours' | 'weekly-trends',
    dateRange: DateRange
  ): Promise<ChartData> {
    const response = await api.get(`/api/v1/dashboard/venues/${this.venueId}/charts/${chartType}`, {
      params: {
        fromDate: dateRange.from.toISOString(),
        toDate: dateRange.to.toISOString(),
      },
    })
    return response.data
  }

  // Get extended metrics
  async getExtendedMetrics(
    metricType: 'table-performance' | 'product-profitability' | 'staff-performance' | 'prep-times',
    dateRange: DateRange
  ): Promise<ExtendedMetricsData> {
    const response = await api.get(`/api/v1/dashboard/venues/${this.venueId}/metrics/${metricType}`, {
      params: {
        fromDate: dateRange.from.toISOString(),
        toDate: dateRange.to.toISOString(),
      },
    })
    return response.data
  }
}

// Chart type mapping for progressive loading
export const CHART_TYPES = {
  BEST_SELLING_PRODUCTS: 'best-selling-products',
  TIPS_OVER_TIME: 'tips-over-time',
  SALES_BY_PAYMENT_METHOD: 'sales-by-payment-method',
  PEAK_HOURS: 'peak-hours',
  WEEKLY_TRENDS: 'weekly-trends',
} as const

// Metric type mapping for progressive loading
export const METRIC_TYPES = {
  TABLE_PERFORMANCE: 'table-performance',
  PRODUCT_PROFITABILITY: 'product-profitability',
  STAFF_PERFORMANCE: 'staff-performance',
  PREP_TIMES: 'prep-times',
} as const

// Progressive loading section configuration
export const PROGRESSIVE_SECTIONS = [
  {
    id: 'basic-metrics',
    name: 'Basic Metrics',
    priority: 1,
    type: 'basic',
  },
  {
    id: 'best-selling-products',
    name: 'Best Selling Products',
    priority: 2,
    type: 'chart',
    chartType: CHART_TYPES.BEST_SELLING_PRODUCTS,
  },
  {
    id: 'tips-over-time',
    name: 'Tips Over Time',
    priority: 3,
    type: 'chart',
    chartType: CHART_TYPES.TIPS_OVER_TIME,
  },
  {
    id: 'sales-by-payment-method',
    name: 'Sales by Payment Method',
    priority: 4,
    type: 'chart',
    chartType: CHART_TYPES.SALES_BY_PAYMENT_METHOD,
  },
  {
    id: 'peak-hours',
    name: 'Peak Hours',
    priority: 5,
    type: 'chart',
    chartType: CHART_TYPES.PEAK_HOURS,
  },
  {
    id: 'table-performance',
    name: 'Table Performance',
    priority: 6,
    type: 'metric',
    metricType: METRIC_TYPES.TABLE_PERFORMANCE,
  },
  {
    id: 'product-profitability',
    name: 'Product Profitability',
    priority: 7,
    type: 'metric',
    metricType: METRIC_TYPES.PRODUCT_PROFITABILITY,
  },
  {
    id: 'weekly-trends',
    name: 'Weekly Trends',
    priority: 8,
    type: 'chart',
    chartType: CHART_TYPES.WEEKLY_TRENDS,
  },
  {
    id: 'staff-performance',
    name: 'Staff Performance',
    priority: 9,
    type: 'metric',
    metricType: METRIC_TYPES.STAFF_PERFORMANCE,
  },
] as const