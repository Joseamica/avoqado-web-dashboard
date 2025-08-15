// SaaS Superadmin System Types

export enum FeatureCategory {
  CORE = 'CORE',           // Basic platform features
  AI = 'AI',               // AI-powered features
  ANALYTICS = 'ANALYTICS', // Advanced analytics
  INTEGRATIONS = 'INTEGRATIONS', // Third-party integrations
  PREMIUM = 'PREMIUM',     // Premium features
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
  approvedAt?: string
  approvedBy?: string
  createdAt: string
  updatedAt: string
}

// Revenue and commission tracking
export interface RevenueMetrics {
  period: 'daily' | 'weekly' | 'monthly' | 'yearly'
  totalPlatformRevenue: number
  totalCommissionRevenue: number
  subscriptionRevenue: number
  featureRevenue: number
  transactionCount: number
  activeVenues: number
  newVenues: number
  churnedVenues: number
  averageRevenuePerVenue: number
  topPerformingVenues: Array<{
    venueId: string
    venueName: string
    revenue: number
    commission: number
  }>
  revenueByPlan: Record<SubscriptionPlan, number>
  revenueByFeature: Record<string, number>
}

// System-wide KPIs
export interface PlatformKPIs {
  totalVenues: number
  activeVenues: number
  totalRevenue: number
  monthlyRecurringRevenue: number
  averageRevenuePerUser: number
  customerLifetimeValue: number
  churnRate: number
  growthRate: number
  totalTransactions: number
  totalUsers: number
  systemUptime: number
  averageResponseTime: number
  errorRate: number
  supportTickets: {
    open: number
    resolved: number
    averageResolutionTime: number
  }
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

// Superadmin dashboard summary
export interface SuperadminDashboard {
  kpis: PlatformKPIs
  revenueMetrics: RevenueMetrics
  recentActivity: Array<{
    id: string
    type: 'venue_approved' | 'feature_enabled' | 'payment_received' | 'venue_suspended'
    description: string
    venueId?: string
    venueName?: string
    amount?: number
    timestamp: string
  }>
  alertsAndNotifications: Array<{
    id: string
    type: 'warning' | 'error' | 'info'
    title: string
    message: string
    isRead: boolean
    createdAt: string
  }>
  pendingApprovals: {
    venues: number
    features: number
    payouts: number
  }
}