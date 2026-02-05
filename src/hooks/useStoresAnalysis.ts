/**
 * useStoresAnalysis - Hook for accessing organization-level data via VENUE endpoints
 *
 * These hooks use venue-level endpoints (/venues/:venueId/stores-analysis/*)
 * which respect white-label role-based access control.
 *
 * Use these hooks for white-label pages instead of useOrganization hooks.
 */

import { useQuery } from '@tanstack/react-query'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import {
  getOverview,
  getVenues,
  getStockSummary,
  getAnomalies,
  getRevenueVsTarget,
  getVolumeVsTarget,
  getTopPromoter,
  getWorstAttendance,
  getOnlineStaff,
  getActivityFeed,
  getStorePerformance,
  getStaffAttendance,
} from '@/services/storesAnalysis.service'

/**
 * Query hook for organization overview via venue endpoint
 */
export function useStoresOverview(options?: {
  enabled?: boolean
  refetchInterval?: number
}) {
  const { venueId } = useCurrentVenue()

  return useQuery({
    queryKey: ['stores-analysis', venueId, 'overview'],
    queryFn: () => getOverview(venueId!),
    enabled: options?.enabled !== false && !!venueId,
    staleTime: 60000,
    refetchInterval: options?.refetchInterval,
  })
}

/**
 * Query hook for organization venues via venue endpoint
 */
export function useStoresVenues(options?: {
  enabled?: boolean
  refetchInterval?: number
}) {
  const { venueId } = useCurrentVenue()

  return useQuery({
    queryKey: ['stores-analysis', venueId, 'venues'],
    queryFn: () => getVenues(venueId!),
    enabled: options?.enabled !== false && !!venueId,
    staleTime: 60000,
    refetchInterval: options?.refetchInterval,
  })
}

/**
 * Query hook for stock summary via venue endpoint
 */
export function useStoresStockSummary(options?: {
  enabled?: boolean
  refetchInterval?: number
}) {
  const { venueId } = useCurrentVenue()

  return useQuery({
    queryKey: ['stores-analysis', venueId, 'stock-summary'],
    queryFn: () => getStockSummary(venueId!),
    enabled: options?.enabled !== false && !!venueId,
    staleTime: 120000,
    refetchInterval: options?.refetchInterval,
  })
}

/**
 * Query hook for anomalies via venue endpoint
 */
export function useStoresAnomalies(options?: {
  enabled?: boolean
  refetchInterval?: number
}) {
  const { venueId } = useCurrentVenue()

  return useQuery({
    queryKey: ['stores-analysis', venueId, 'anomalies'],
    queryFn: () => getAnomalies(venueId!),
    enabled: options?.enabled !== false && !!venueId,
    staleTime: 60000,
    refetchInterval: options?.refetchInterval || 120000,
  })
}

/**
 * Query hook for revenue vs target chart via venue endpoint
 */
export function useStoresRevenueVsTarget(options?: {
  enabled?: boolean
  refetchInterval?: number
  filterVenueId?: string
}) {
  const { venueId } = useCurrentVenue()
  const filterVenueId = options?.filterVenueId

  return useQuery({
    queryKey: ['stores-analysis', venueId, 'charts', 'revenue-vs-target', filterVenueId || 'all'],
    queryFn: () => getRevenueVsTarget(venueId!, filterVenueId),
    enabled: options?.enabled !== false && !!venueId,
    staleTime: 120000,
    refetchInterval: options?.refetchInterval,
  })
}

/**
 * Query hook for volume vs target chart via venue endpoint
 */
export function useStoresVolumeVsTarget(options?: {
  enabled?: boolean
  refetchInterval?: number
  filterVenueId?: string
}) {
  const { venueId } = useCurrentVenue()
  const filterVenueId = options?.filterVenueId

  return useQuery({
    queryKey: ['stores-analysis', venueId, 'charts', 'volume-vs-target', filterVenueId || 'all'],
    queryFn: () => getVolumeVsTarget(venueId!, filterVenueId),
    enabled: options?.enabled !== false && !!venueId,
    staleTime: 120000,
    refetchInterval: options?.refetchInterval,
  })
}

/**
 * Query hook for top promoter via venue endpoint
 */
export function useStoresTopPromoter(options?: {
  enabled?: boolean
  refetchInterval?: number
}) {
  const { venueId } = useCurrentVenue()

  return useQuery({
    queryKey: ['stores-analysis', venueId, 'insights', 'top-promoter'],
    queryFn: () => getTopPromoter(venueId!),
    enabled: options?.enabled !== false && !!venueId,
    staleTime: 60000,
    refetchInterval: options?.refetchInterval || 120000,
  })
}

/**
 * Query hook for worst attendance via venue endpoint
 */
export function useStoresWorstAttendance(options?: {
  enabled?: boolean
  refetchInterval?: number
}) {
  const { venueId } = useCurrentVenue()

  return useQuery({
    queryKey: ['stores-analysis', venueId, 'insights', 'worst-attendance'],
    queryFn: () => getWorstAttendance(venueId!),
    enabled: options?.enabled !== false && !!venueId,
    staleTime: 60000,
    refetchInterval: options?.refetchInterval || 120000,
  })
}

/**
 * Query hook for online staff via venue endpoint
 */
export function useStoresOnlineStaff(options?: {
  enabled?: boolean
  refetchInterval?: number
}) {
  const { venueId } = useCurrentVenue()

  return useQuery({
    queryKey: ['stores-analysis', venueId, 'staff', 'online'],
    queryFn: () => getOnlineStaff(venueId!),
    enabled: options?.enabled !== false && !!venueId,
    staleTime: 30000,
    refetchInterval: options?.refetchInterval || 60000,
  })
}

/**
 * Query hook for activity feed via venue endpoint
 */
export function useStoresActivityFeed(
  limit: number = 50,
  options?: {
    enabled?: boolean
    refetchInterval?: number
  }
) {
  const { venueId } = useCurrentVenue()

  return useQuery({
    queryKey: ['stores-analysis', venueId, 'activity-feed', limit],
    queryFn: () => getActivityFeed(venueId!, { limit }),
    enabled: options?.enabled !== false && !!venueId,
    staleTime: 30000,
    refetchInterval: options?.refetchInterval || 60000,
  })
}

/**
 * Query hook for store performance via venue endpoint
 */
export function useStoresStorePerformance(options?: {
  enabled?: boolean
  refetchInterval?: number
  limit?: number
}) {
  const { venueId } = useCurrentVenue()

  return useQuery({
    queryKey: ['stores-analysis', venueId, 'store-performance', options?.limit || 10],
    queryFn: () => getStorePerformance(venueId!, { limit: options?.limit }),
    enabled: options?.enabled !== false && !!venueId,
    staleTime: 60000,
    refetchInterval: options?.refetchInterval,
  })
}

/**
 * Query hook for staff attendance via venue endpoint
 */
export function useStoresStaffAttendance(options?: {
  enabled?: boolean
  refetchInterval?: number
  date?: string
  filterVenueId?: string
  status?: string
}) {
  const { venueId } = useCurrentVenue()

  return useQuery({
    queryKey: ['stores-analysis', venueId, 'staff-attendance', options?.date, options?.filterVenueId, options?.status],
    queryFn: () => getStaffAttendance(venueId!, {
      date: options?.date,
      venueId: options?.filterVenueId,
      status: options?.status,
    }),
    enabled: options?.enabled !== false && !!venueId,
    staleTime: 30000,
    refetchInterval: options?.refetchInterval || 30000,
  })
}
