/**
 * useStoresAnalysis - Hook for accessing organization-level data via VENUE endpoints
 *
 * These hooks use venue-level endpoints (/venues/:venueId/stores-analysis/*)
 * which respect white-label role-based access control.
 *
 * Use these hooks for white-label pages instead of useOrganization hooks.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
  createStoreGoal,
  updateStoreGoal,
  deleteStoreGoal,
  getOrgGoals,
  createOrgGoal,
  updateOrgGoal,
  deleteOrgGoal,
  getAttendanceHeatmap,
  getSalesHeatmap,
  getOrgAttendanceConfig,
  upsertOrgAttendanceConfig,
  deleteOrgAttendanceConfig,
  getOrgTpvDefaults,
  upsertOrgTpvDefaults,
  getOrgTpvStats,
} from '@/services/storesAnalysis.service'
import type {
  CreateStoreGoalInput,
  UpdateStoreGoalInput,
  CreateOrgGoalInput,
  UpdateOrgGoalInput,
  UpsertOrgAttendanceConfigInput,
} from '@/services/storesAnalysis.service'

/**
 * Query hook for organization overview via venue endpoint
 */
export function useStoresOverview(options?: {
  enabled?: boolean
  refetchInterval?: number
  startDate?: string
  endDate?: string
  filterVenueId?: string
}) {
  const { venueId } = useCurrentVenue()

  return useQuery({
    queryKey: ['stores-analysis', venueId, 'overview', options?.startDate, options?.endDate, options?.filterVenueId],
    queryFn: () => getOverview(venueId!, options?.startDate, options?.endDate, options?.filterVenueId),
    enabled: options?.enabled !== false && !!venueId,
    staleTime: 60000,
    refetchInterval: options?.refetchInterval,
  })
}

/**
 * Query hook for organization venues via venue endpoint
 */
export function useStoresVenues(options?: { enabled?: boolean; refetchInterval?: number }) {
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
export function useStoresStockSummary(options?: { enabled?: boolean; refetchInterval?: number }) {
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
export function useStoresAnomalies(options?: { enabled?: boolean; refetchInterval?: number }) {
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
export function useStoresRevenueVsTarget(options?: { enabled?: boolean; refetchInterval?: number; filterVenueId?: string }) {
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
export function useStoresVolumeVsTarget(options?: { enabled?: boolean; refetchInterval?: number; filterVenueId?: string }) {
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
export function useStoresTopPromoter(options?: { enabled?: boolean; refetchInterval?: number }) {
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
export function useStoresWorstAttendance(options?: { enabled?: boolean; refetchInterval?: number }) {
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
export function useStoresOnlineStaff(options?: { enabled?: boolean; refetchInterval?: number }) {
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
    startDate?: string
    endDate?: string
    filterVenueId?: string
  },
) {
  const { venueId } = useCurrentVenue()

  return useQuery({
    queryKey: ['stores-analysis', venueId, 'activity-feed', limit, options?.startDate, options?.endDate, options?.filterVenueId],
    queryFn: () =>
      getActivityFeed(venueId!, {
        limit,
        startDate: options?.startDate,
        endDate: options?.endDate,
        filterVenueId: options?.filterVenueId,
      }),
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
  startDate?: string
  endDate?: string
}) {
  const { venueId } = useCurrentVenue()

  return useQuery({
    queryKey: ['stores-analysis', venueId, 'store-performance', options?.limit || 10, options?.startDate, options?.endDate],
    queryFn: () => getStorePerformance(venueId!, { limit: options?.limit, startDate: options?.startDate, endDate: options?.endDate }),
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
  startDate?: string
  endDate?: string
  filterVenueId?: string
  status?: string
}) {
  const { venueId } = useCurrentVenue()

  return useQuery({
    queryKey: [
      'stores-analysis',
      venueId,
      'staff-attendance',
      options?.date,
      options?.startDate,
      options?.endDate,
      options?.filterVenueId,
      options?.status,
    ],
    queryFn: () =>
      getStaffAttendance(venueId!, {
        date: options?.date,
        startDate: options?.startDate,
        endDate: options?.endDate,
        venueId: options?.filterVenueId,
        status: options?.status,
      }),
    enabled: options?.enabled !== false && !!venueId,
    staleTime: 30000,
    refetchInterval: options?.refetchInterval || 30000,
  })
}

// ===========================================
// STORE GOAL MUTATIONS
// ===========================================

/**
 * Mutation hook to create a store goal from the supervisor dashboard
 */
export function useCreateStoreGoal() {
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ storeId, data }: { storeId: string; data: CreateStoreGoalInput }) => createStoreGoal(venueId!, storeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores-analysis', venueId, 'store-performance'] })
    },
  })
}

/**
 * Mutation hook to update a store goal from the supervisor dashboard
 */
export function useUpdateStoreGoal() {
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ storeId, goalId, data }: { storeId: string; goalId: string; data: UpdateStoreGoalInput }) =>
      updateStoreGoal(venueId!, storeId, goalId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores-analysis', venueId, 'store-performance'] })
    },
  })
}

/**
 * Mutation hook to delete a store goal from the supervisor dashboard
 */
export function useDeleteStoreGoal() {
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ storeId, goalId }: { storeId: string; goalId: string }) => deleteStoreGoal(venueId!, storeId, goalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores-analysis', venueId, 'store-performance'] })
    },
  })
}

// ===========================================
// ORG-LEVEL GOAL HOOKS
// ===========================================

/**
 * Query hook for org-level sales goals
 */
export function useOrgGoals(options?: { enabled?: boolean }) {
  const { venueId } = useCurrentVenue()

  return useQuery({
    queryKey: ['stores-analysis', venueId, 'org-goals'],
    queryFn: () => getOrgGoals(venueId!),
    enabled: options?.enabled !== false && !!venueId,
    staleTime: 60000,
  })
}

/**
 * Mutation hook to create an org-level goal
 */
export function useCreateOrgGoal() {
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateOrgGoalInput) => createOrgGoal(venueId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores-analysis', venueId, 'org-goals'] })
      queryClient.invalidateQueries({ queryKey: ['stores-analysis', venueId, 'store-performance'] })
    },
  })
}

/**
 * Mutation hook to update an org-level goal
 */
export function useUpdateOrgGoal() {
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ goalId, data }: { goalId: string; data: UpdateOrgGoalInput }) => updateOrgGoal(venueId!, goalId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores-analysis', venueId, 'org-goals'] })
      queryClient.invalidateQueries({ queryKey: ['stores-analysis', venueId, 'store-performance'] })
    },
  })
}

/**
 * Mutation hook to delete an org-level goal
 */
export function useDeleteOrgGoal() {
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (goalId: string) => deleteOrgGoal(venueId!, goalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores-analysis', venueId, 'org-goals'] })
      queryClient.invalidateQueries({ queryKey: ['stores-analysis', venueId, 'store-performance'] })
    },
  })
}

// =============================================================================
// ORG ATTENDANCE CONFIG HOOKS
// =============================================================================

/**
 * Query hook for org-level attendance config
 */
export function useOrgAttendanceConfig(options?: { enabled?: boolean }) {
  const { venueId } = useCurrentVenue()

  return useQuery({
    queryKey: ['stores-analysis', venueId, 'org-attendance-config'],
    queryFn: () => getOrgAttendanceConfig(venueId!),
    enabled: options?.enabled !== false && !!venueId,
    staleTime: 60000,
  })
}

/**
 * Mutation hook to upsert org attendance config
 */
export function useUpsertOrgAttendanceConfig() {
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: UpsertOrgAttendanceConfigInput) => upsertOrgAttendanceConfig(venueId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores-analysis', venueId, 'org-attendance-config'] })
    },
  })
}

/**
 * Mutation hook to delete org attendance config
 */
export function useDeleteOrgAttendanceConfig() {
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => deleteOrgAttendanceConfig(venueId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores-analysis', venueId, 'org-attendance-config'] })
    },
  })
}

// =============================================================================
// ORG TPV DEFAULTS HOOKS
// =============================================================================

/**
 * Query hook for org-level TPV defaults (full settings JSON)
 */
export function useOrgTpvDefaults(options?: { enabled?: boolean }) {
  const { venueId } = useCurrentVenue()

  return useQuery({
    queryKey: ['stores-analysis', venueId, 'org-tpv-defaults'],
    queryFn: () => getOrgTpvDefaults(venueId!),
    enabled: options?.enabled !== false && !!venueId,
    staleTime: 60000,
  })
}

/**
 * Mutation hook to save org TPV defaults and push to all terminals
 */
export function useUpsertOrgTpvDefaults() {
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (settings: Record<string, any>) => upsertOrgTpvDefaults(venueId!, settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores-analysis', venueId, 'org-tpv-defaults'] })
      queryClient.invalidateQueries({ queryKey: ['stores-analysis', venueId, 'org-tpv-stats'] })
    },
  })
}

/**
 * Query hook for org TPV stats (terminal counts per venue)
 */
export function useOrgTpvStats(options?: { enabled?: boolean }) {
  const { venueId } = useCurrentVenue()

  return useQuery({
    queryKey: ['stores-analysis', venueId, 'org-tpv-stats'],
    queryFn: () => getOrgTpvStats(venueId!),
    enabled: options?.enabled !== false && !!venueId,
    staleTime: 60000,
  })
}

// =============================================================================
// HEATMAP HOOKS
// =============================================================================

/**
 * Query hook for attendance heatmap (staff × day matrix)
 */
export function useStoresAttendanceHeatmap(options: { startDate: string; endDate: string; filterVenueId?: string; enabled?: boolean }) {
  const { venueId } = useCurrentVenue()

  return useQuery({
    queryKey: ['stores-analysis', venueId, 'attendance-heatmap', options.startDate, options.endDate, options.filterVenueId],
    queryFn: () =>
      getAttendanceHeatmap(venueId!, {
        startDate: options.startDate,
        endDate: options.endDate,
        filterVenueId: options.filterVenueId,
      }),
    enabled: !!venueId && !!options.startDate && !!options.endDate && options.enabled !== false,
    staleTime: 300000, // 5 min — no need for real-time refresh
  })
}

/**
 * Query hook for sales heatmap (staff × day matrix)
 */
export function useStoresSalesHeatmap(options: { startDate: string; endDate: string; filterVenueId?: string; enabled?: boolean }) {
  const { venueId } = useCurrentVenue()

  return useQuery({
    queryKey: ['stores-analysis', venueId, 'sales-heatmap', options.startDate, options.endDate, options.filterVenueId],
    queryFn: () =>
      getSalesHeatmap(venueId!, {
        startDate: options.startDate,
        endDate: options.endDate,
        filterVenueId: options.filterVenueId,
      }),
    enabled: !!venueId && !!options.startDate && !!options.endDate && options.enabled !== false,
    staleTime: 300000,
  })
}
