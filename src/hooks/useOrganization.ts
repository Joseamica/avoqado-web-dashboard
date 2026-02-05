/**
 * useOrganization - Hook for accessing organization-level data
 *
 * Provides organization context and data fetching for multi-venue organizations.
 * Extracts organizationId from activeVenue to enable organization-wide queries.
 *
 * Used in: PlayTelecom CommandCenter (aggregated metrics across all stores)
 */

import { useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useQuery } from '@tanstack/react-query'
import {
  getOrganizationOverview,
  getOrganizationVenues,
  getEnhancedOverview,
  getOnlineStaff,
  getActivityFeed,
  getStockSummary,
  getAnomalies,
  getRevenueVsTarget,
  getVolumeVsTarget,
  getTopPromoter,
  getWorstAttendance,
} from '@/services/organization.service'

/**
 * Base organization hook
 *
 * Extracts organization data from activeVenue context.
 * Note: Backend must include organization in venue response.
 */
export function useOrganization() {
  const { activeVenue } = useAuth()

  // Extract organizationId from activeVenue
  // Backend should include organization in venue response
  const organizationId = useMemo(() => {
    // TODO: Add organization to ActiveVenue type when backend is updated
    const orgId = (activeVenue as any)?.organizationId || (activeVenue as any)?.organization?.id
    return orgId
  }, [activeVenue])

  const organizationSlug = useMemo(() => {
    // TODO: Add organization to ActiveVenue type when backend is updated
    return (activeVenue as any)?.organization?.slug
  }, [activeVenue])

  const organizationName = useMemo(() => {
    // TODO: Add organization to ActiveVenue type when backend is updated
    return (activeVenue as any)?.organization?.name
  }, [activeVenue])

  return {
    organizationId,
    organizationSlug,
    organizationName,
    hasOrganization: !!organizationId,
  }
}

/**
 * Query hook for organization overview
 *
 * Fetches aggregated metrics from all venues in the organization.
 * Returns: totalRevenue, totalOrders, avgOrderValue, topVenues, etc.
 *
 * @param timeRange - Filter by time period ('7d', '30d', '90d')
 * @param options - Additional query options
 */
export function useOrganizationOverview(
  timeRange: '7d' | '30d' | '90d' = '7d',
  options?: {
    enabled?: boolean
    refetchInterval?: number
  }
) {
  const { organizationId } = useOrganization()

  return useQuery({
    queryKey: ['organization', organizationId, 'overview', timeRange],
    queryFn: () => getOrganizationOverview(organizationId!, { timeRange }),
    enabled: options?.enabled !== false && !!organizationId,
    staleTime: 60000, // 1 minute
    refetchInterval: options?.refetchInterval,
  })
}

/**
 * Query hook for organization venues
 *
 * Fetches list of all venues with individual metrics.
 * Used for: Store selector, top/worst performer insights, venue comparison.
 *
 * @param timeRange - Filter by time period ('7d', '30d', '90d')
 * @param options - Additional query options
 */
export function useOrganizationVenues(
  timeRange: '7d' | '30d' | '90d' = '7d',
  options?: {
    enabled?: boolean
    refetchInterval?: number
  }
) {
  const { organizationId } = useOrganization()

  return useQuery({
    queryKey: ['organization', organizationId, 'venues', timeRange],
    queryFn: () => getOrganizationVenues(organizationId!, { timeRange }),
    enabled: options?.enabled !== false && !!organizationId,
    staleTime: 60000, // 1 minute
    refetchInterval: options?.refetchInterval,
  })
}

/**
 * Query hook for enhanced organization overview
 *
 * Fetches overview with additional analytics:
 * - Comparisons vs previous period
 * - Venue rankings
 * - Growth trends
 *
 * @param timeRange - Filter by time period ('7d', '30d', '90d')
 * @param options - Additional query options
 */
export function useEnhancedOrganizationOverview(
  timeRange: '7d' | '30d' | '90d' = '7d',
  options?: {
    enabled?: boolean
    refetchInterval?: number
  }
) {
  const { organizationId } = useOrganization()

  return useQuery({
    queryKey: ['organization', organizationId, 'enhanced-overview', timeRange],
    queryFn: () => getEnhancedOverview(organizationId!, { timeRange }),
    enabled: options?.enabled !== false && !!organizationId,
    staleTime: 60000, // 1 minute
    refetchInterval: options?.refetchInterval,
  })
}

/**
 * Query hook for online staff
 *
 * Fetches real-time online staff count using TimeEntry.
 * Returns staff with active TimeEntry (clockIn without clockOut).
 *
 * Used in: CommandCenter (Promotores Online gauge)
 *
 * @param options - Additional query options
 */
export function useOnlineStaff(options?: {
  enabled?: boolean
  refetchInterval?: number
}) {
  const { organizationId } = useOrganization()

  return useQuery({
    queryKey: ['organization', organizationId, 'staff', 'online'],
    queryFn: () => getOnlineStaff(organizationId!),
    enabled: options?.enabled !== false && !!organizationId,
    staleTime: 30000, // 30 seconds (more frequent for real-time data)
    refetchInterval: options?.refetchInterval || 60000, // Auto-refresh every minute by default
  })
}

/**
 * Query hook for activity feed
 *
 * Fetches recent activity events across organization:
 * - Sales (completed orders)
 * - Check-ins (staff TimeEntry)
 * - System alerts
 *
 * Used in: CommandCenter (Live Activity Feed)
 *
 * @param limit - Max events to fetch (default 50)
 * @param options - Additional query options
 */
export function useActivityFeed(
  limit: number = 50,
  options?: {
    enabled?: boolean
    refetchInterval?: number
  }
) {
  const { organizationId } = useOrganization()

  return useQuery({
    queryKey: ['organization', organizationId, 'activity-feed', limit],
    queryFn: () => getActivityFeed(organizationId!, limit),
    enabled: options?.enabled !== false && !!organizationId,
    staleTime: 30000, // 30 seconds
    refetchInterval: options?.refetchInterval || 60000, // Auto-refresh every minute
  })
}

/**
 * Query hook for stock summary
 *
 * Fetches organization-wide inventory statistics:
 * - Total pieces available
 * - Total value
 * - Low stock alerts
 * - Critical alerts
 * - Store breakdown
 *
 * Used in: CommandCenter (Stock de SIMs KPI)
 *
 * @param options - Additional query options
 */
export function useStockSummary(options?: {
  enabled?: boolean
  refetchInterval?: number
}) {
  const { organizationId } = useOrganization()

  return useQuery({
    queryKey: ['organization', organizationId, 'stock-summary'],
    queryFn: () => getStockSummary(organizationId!),
    enabled: options?.enabled !== false && !!organizationId,
    staleTime: 120000, // 2 minutes (inventory changes less frequently)
    refetchInterval: options?.refetchInterval,
  })
}

/**
 * Query hook for anomalies
 *
 * Fetches operational anomalies across organization:
 * - No check-ins after 10 AM
 * - Pending deposits
 * - Low stock alerts
 * - Low performance stores
 *
 * Used in: CommandCenter (Anomalías Operativas KPI)
 *
 * @param options - Additional query options
 */
export function useAnomalies(options?: {
  enabled?: boolean
  refetchInterval?: number
}) {
  const { organizationId } = useOrganization()

  return useQuery({
    queryKey: ['organization', organizationId, 'anomalies'],
    queryFn: () => getAnomalies(organizationId!),
    enabled: options?.enabled !== false && !!organizationId,
    staleTime: 60000, // 1 minute
    refetchInterval: options?.refetchInterval || 120000, // Auto-refresh every 2 minutes
  })
}

/**
 * Query hook for revenue vs target chart
 *
 * Fetches daily revenue compared to target for current week
 *
 * Used in: CommandCenter (Rendimiento vs Metas - Ingresos chart)
 *
 * @param options - Additional query options
 */
export function useRevenueVsTarget(options?: {
  enabled?: boolean
  refetchInterval?: number
  venueId?: string
}) {
  const { organizationId } = useOrganization()
  const venueId = options?.venueId

  return useQuery({
    queryKey: ['organization', organizationId, 'charts', 'revenue-vs-target', venueId || 'all'],
    queryFn: () => getRevenueVsTarget(organizationId!, venueId),
    enabled: options?.enabled !== false && !!organizationId,
    staleTime: 120000, // 2 minutes
    refetchInterval: options?.refetchInterval,
  })
}

/**
 * Query hook for volume vs target chart
 *
 * Fetches daily sales volume compared to target for current week
 *
 * Used in: CommandCenter (Rendimiento vs Metas - Volumen chart)
 *
 * @param options - Additional query options
 */
export function useVolumeVsTarget(options?: {
  enabled?: boolean
  refetchInterval?: number
  venueId?: string
}) {
  const { organizationId } = useOrganization()
  const venueId = options?.venueId

  return useQuery({
    queryKey: ['organization', organizationId, 'charts', 'volume-vs-target', venueId || 'all'],
    queryFn: () => getVolumeVsTarget(organizationId!, venueId),
    enabled: options?.enabled !== false && !!organizationId,
    staleTime: 120000, // 2 minutes
    refetchInterval: options?.refetchInterval,
  })
}

/**
 * Query hook for top promoter
 *
 * Fetches the top performing promoter by sales count today.
 *
 * Used in: CommandCenter (Top Promotor insight)
 *
 * @param options - Additional query options
 */
export function useTopPromoter(options?: {
  enabled?: boolean
  refetchInterval?: number
}) {
  const { organizationId } = useOrganization()

  return useQuery({
    queryKey: ['organization', organizationId, 'insights', 'top-promoter'],
    queryFn: () => getTopPromoter(organizationId!),
    enabled: options?.enabled !== false && !!organizationId,
    staleTime: 60000, // 1 minute
    refetchInterval: options?.refetchInterval || 120000, // Auto-refresh every 2 minutes
  })
}

/**
 * Query hook for worst attendance
 *
 * Fetches the store with worst attendance (lowest percentage of active staff).
 *
 * Used in: CommandCenter (Peor Asistencia insight)
 *
 * @param options - Additional query options
 */
export function useWorstAttendance(options?: {
  enabled?: boolean
  refetchInterval?: number
}) {
  const { organizationId } = useOrganization()

  return useQuery({
    queryKey: ['organization', organizationId, 'insights', 'worst-attendance'],
    queryFn: () => getWorstAttendance(organizationId!),
    enabled: options?.enabled !== false && !!organizationId,
    staleTime: 60000, // 1 minute
    refetchInterval: options?.refetchInterval || 120000, // Auto-refresh every 2 minutes
  })
}
