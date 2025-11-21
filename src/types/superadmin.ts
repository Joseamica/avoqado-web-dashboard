// SaaS Superadmin System Types

export enum FeatureCategory {
  OPERATIONS = 'OPERATIONS',       // Operations and core business features
  PAYMENTS = 'PAYMENTS',           // Payment processing features
  MARKETING = 'MARKETING',         // Marketing and customer engagement
  ANALYTICS = 'ANALYTICS',         // Analytics and reporting
  INTEGRATIONS = 'INTEGRATIONS',   // Third-party integrations
}

export enum FeatureStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  DEPRECATED = 'DEPRECATED',
  BETA = 'BETA',
}

export enum PricingModel {
  FREE = 'FREE',
  FIXED = 'FIXED',           // Fixed monthly cost
  USAGE_BASED = 'USAGE_BASED', // Per transaction/usage
  TIERED = 'TIERED',         // Based on volume tiers
}

export enum VenueStatus {
  PENDING = 'PENDING',       // Awaiting approval
  ACTIVE = 'ACTIVE',         // Active subscription
  SUSPENDED = 'SUSPENDED',   // Temporarily suspended
  CANCELLED = 'CANCELLED',   // Cancelled subscription
  TRIAL = 'TRIAL',          // Free trial period
}

export enum SubscriptionPlan {
  STARTER = 'STARTER',
  PROFESSIONAL = 'PROFESSIONAL',
  ENTERPRISE = 'ENTERPRISE',
  CUSTOM = 'CUSTOM',
}

// Platform Features that can be enabled/disabled
export interface PlatformFeature {
  id: string
  code: string
  name: string
  description: string
  category: FeatureCategory
  status: FeatureStatus
  pricingModel: PricingModel
  basePrice?: number        // Monthly base price (if applicable)
  usagePrice?: number       // Per-usage price (if applicable)
  usageUnit?: string        // Unit for usage billing (transactions, API calls, etc.)
  limits?: {
    maxUsage?: number       // Usage limits
    maxUsers?: number       // User limits
    maxVenues?: number      // Multi-venue limits
  }
  dependencies?: string[]   // Required features
  isCore: boolean          // Core features cannot be disabled
  createdAt: string
  updatedAt: string
}

// Venue's feature subscriptions
export interface VenueFeature {
  id: string
  venueId: string
  featureId: string
  feature: PlatformFeature
  isEnabled: boolean
  enabledAt?: string
  disabledAt?: string
  enabledBy: string        // Superadmin who enabled it
  currentUsage?: number    // Current month usage
  usageLimit?: number      // Custom usage limit for this venue
  customPrice?: number     // Custom pricing for enterprise clients
  trialEndsAt?: string     // Trial expiration
  createdAt: string
  updatedAt: string
}

// Venue management for superadmins
export interface SuperadminVenue {
  id: string
  name: string
  slug: string
  status: VenueStatus
  subscriptionPlan: SubscriptionPlan
  monthlyRevenue: number
  commissionRate: number   // Avoqado's commission percentage
  totalTransactions: number
  totalRevenue: number
  organizationId: string
  organization: {
    id: string
    name: string
    email: string
    phone?: string
    address?: string
  }
  owner: {
    id: string
    firstName: string
    lastName: string
    email: string
    phone?: string
  }
  features: VenueFeature[]
  analytics: {
    monthlyTransactions: number
    monthlyRevenue: number
    averageOrderValue: number
    activeUsers: number
    lastActivityAt: string
  }
  billing: {
    nextBillingDate: string
    monthlySubscriptionFee: number
    additionalFeaturesCost: number
    totalMonthlyBill: number
    paymentStatus: 'PAID' | 'PENDING' | 'OVERDUE'
  }
  kycStatus?: 'PENDING_REVIEW' | 'IN_REVIEW' | 'VERIFIED' | 'REJECTED' | null  // KYC verification status
  approvedAt?: string
  approvedBy?: string
  createdAt: string
  updatedAt: string
}

// Revenue and commission tracking
export interface RevenueMetrics {
  totalPlatformRevenue: number // Total money Avoqado actually earns
  totalCommissionRevenue: number // Fees from transactions
  subscriptionRevenue: number // Monthly subscription fees from venues
  featureRevenue: number // Premium feature fees
  invoicedRevenue: number // Formally billed revenue
  settledRevenue: number // Actually received revenue
  transactionCount: number
  newVenues: number
  churnedVenues: number
}

// System-wide KPIs
export interface PlatformKPIs {
  totalRevenue: number
  monthlyRecurringRevenue: number
  totalVenues: number
  activeVenues: number
  totalUsers: number
  averageRevenuePerUser: number
  churnRate: number
  growthRate: number
  systemUptime: number
  // Platform earnings
  totalCommissionRevenue: number
  subscriptionRevenue: number
  featureRevenue: number
}

// Feature usage analytics
export interface FeatureUsageAnalytics {
  featureId: string
  featureName: string
  totalUsers: number
  activeUsers: number
  usageCount: number
  revenue: number
  adoptionRate: number
  usageByVenue: Array<{
    venueId: string
    venueName: string
    usageCount: number
    lastUsed: string
  }>
  usageByPlan: Record<SubscriptionPlan, number>
  trends: Array<{
    date: string
    usage: number
    revenue: number
  }>
}

// Superadmin dashboard summary (matching backend SuperadminDashboardData)
export interface SuperadminDashboard {
  kpis: PlatformKPIs
  revenueMetrics: RevenueMetrics
  recentActivity: Array<{
    id: string
    type: string
    description: string
    venueName?: string
    amount?: number
    timestamp: string
  }>
  alerts: Array<{
    id: string
    type: 'error' | 'warning' | 'info'
    title: string
    message: string
    isRead: boolean
  }>
  topVenues: Array<{
    name: string
    revenue: number
    commission: number
    growth: number
  }>
}

// Alias for consistency with backend naming
export type SuperadminDashboardData = SuperadminDashboard