/**
 * useImpersonation — React hook for SUPERADMIN impersonation sessions.
 *
 * Fetches session state from the backend via React Query, keeps a client-side
 * second-by-second countdown, and exposes start/extend/stop mutations that
 * invalidate the access/status caches so UI updates everywhere.
 *
 * See spec: docs/superpowers/specs/2026-04-20-superadmin-impersonation-design.md
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import impersonationService, {
  EligibleTargetsResponseWithScope,
  ImpersonationMode,
  ImpersonationState,
} from '@/services/impersonation.service'
import type { StaffRole } from '@/types'
import { useAuth } from '@/context/AuthContext'
import { accessQueryKey } from '@/hooks/use-access'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { StaffRole as StaffRoleEnum } from '@/types'

export const impersonationStatusQueryKey = ['impersonation', 'status']
export const impersonationTargetsQueryKey = (venueId: string | null | undefined) => ['impersonation', 'eligible-targets', venueId]

export interface StartImpersonationArgs {
  mode: ImpersonationMode
  targetUserId?: string
  targetRole?: StaffRole
  reason: string
  /** venueId currently shown in the URL. Sent explicitly to avoid JWT staleness. */
  venueId?: string
}

export interface UseImpersonationReturn {
  isImpersonating: boolean
  mode: ImpersonationMode | null
  impersonatedUserId: string | null
  impersonatedRole: StaffRole | null
  /** Real actor's role (from the `act` claim). Null when the status endpoint hasn't resolved yet. */
  realRole: StaffRole | null
  /**
   * True if the current session is "really" a SUPERADMIN — either the user's
   * effective role is SUPERADMIN (normal state) or the status endpoint confirms
   * the real actor is a SUPERADMIN (impersonation state).
   *
   * Use this (NOT `user.role === 'SUPERADMIN'`) when gating SUPERADMIN-only UI
   * that must remain visible during impersonation (e.g., the "Exit
   * impersonation" button, the ⌘⇧I shortcut).
   */
  isRealSuperadmin: boolean
  expiresAt: number | null
  extensionsUsed: number
  maxExtensions: number
  reason: string | null
  /** Milliseconds remaining until expiration. Null when not impersonating. Re-computed every second. */
  timeRemainingMs: number | null
  /** Convenience: should we warn (3 min or less)? */
  isInWarningZone: boolean
  /** Convenience: should we show critical state (30 sec or less)? */
  isInCriticalZone: boolean
  /** Has the session expired locally? Backend also rejects expired tokens. */
  isExpiredLocally: boolean
  isLoading: boolean
  isStarting: boolean
  isExtending: boolean
  isStopping: boolean
  /** Mutations */
  startImpersonation: (args: StartImpersonationArgs) => Promise<ImpersonationState>
  extendImpersonation: () => Promise<ImpersonationState>
  stopImpersonation: () => Promise<void>
  /** Targets for the picker. Loaded lazily (enabled controlled by caller). */
  useEligibleTargets: () => ReturnType<typeof useQuery<EligibleTargetsResponseWithScope>>
  /** Force a refetch of the server-side session state. */
  refreshStatus: () => void
}

/**
 * Seconds to consider "warning" and "critical" in the banner UI.
 */
const WARNING_SECONDS = 3 * 60
const CRITICAL_SECONDS = 30

export function useImpersonation(): UseImpersonationReturn {
  const queryClient = useQueryClient()
  const { user, isAuthenticated } = useAuth()
  const { venueId } = useCurrentVenue()

  const isSuperadmin = user?.role === 'SUPERADMIN'

  // Only query status for authenticated users. Query is cheap — just inspects the cookie.
  const statusQuery = useQuery<ImpersonationState>({
    queryKey: impersonationStatusQueryKey,
    queryFn: () => impersonationService.getStatus(),
    enabled: isAuthenticated,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    retry: false,
  })

  const status: ImpersonationState = statusQuery.data ?? {
    isImpersonating: false,
    mode: null,
    impersonatedUserId: null,
    impersonatedRole: null,
    expiresAt: null,
    extensionsUsed: 0,
    maxExtensions: 2,
    reason: null,
    realRole: null,
    realUserId: null,
  }

  // "Real" superadmin check: either the user's effective role is SUPERADMIN
  // (normal state) or the status endpoint reports the actor is a SUPERADMIN
  // (impersonation state, where user.role reflects the impersonated role).
  const isRealSuperadmin = user?.role === StaffRoleEnum.SUPERADMIN || status.realRole === StaffRoleEnum.SUPERADMIN

  // Second-by-second countdown derived from expiresAt. Avoids backend polling.
  const [now, setNow] = useState<number>(() => Date.now())
  useEffect(() => {
    if (!status.isImpersonating || !status.expiresAt) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [status.isImpersonating, status.expiresAt])

  const timeRemainingMs = useMemo<number | null>(() => {
    if (!status.isImpersonating || !status.expiresAt) return null
    return Math.max(0, status.expiresAt * 1000 - now)
  }, [status.isImpersonating, status.expiresAt, now])

  const isExpiredLocally = timeRemainingMs !== null && timeRemainingMs <= 0
  const isInWarningZone = timeRemainingMs !== null && timeRemainingMs > 0 && timeRemainingMs <= WARNING_SECONDS * 1000
  const isInCriticalZone = timeRemainingMs !== null && timeRemainingMs > 0 && timeRemainingMs <= CRITICAL_SECONDS * 1000

  const invalidateAccessAndStatus = useCallback(() => {
    // Status → updates banner.
    queryClient.invalidateQueries({ queryKey: impersonationStatusQueryKey })
    // Access → permissions for current venue must reflect the effective role now.
    if (venueId) {
      queryClient.invalidateQueries({ queryKey: accessQueryKey(venueId) })
    } else {
      queryClient.invalidateQueries({ queryKey: ['user-access'] })
    }
    // AuthContext's /auth/status cache — the user's role & venue list change
    // after start/stop so we must force a refetch or the stale SUPERADMIN
    // identity keeps showing in the sidebar and header.
    queryClient.invalidateQueries({ queryKey: ['status'] })
  }, [queryClient, venueId])

  const startMutation = useMutation({
    mutationFn: (args: StartImpersonationArgs) => impersonationService.start(args),
    onSuccess: () => {
      invalidateAccessAndStatus()
    },
  })

  const extendMutation = useMutation({
    mutationFn: () => impersonationService.extend(),
    onSuccess: () => {
      invalidateAccessAndStatus()
    },
  })

  const stopMutation = useMutation({
    mutationFn: () => impersonationService.stop(),
    onSuccess: () => {
      invalidateAccessAndStatus()
    },
  })

  const startImpersonation = useCallback(
    async (args: StartImpersonationArgs): Promise<ImpersonationState> => {
      const result = await startMutation.mutateAsync(args)
      return result.impersonation
    },
    [startMutation],
  )

  const extendImpersonation = useCallback(async (): Promise<ImpersonationState> => {
    const result = await extendMutation.mutateAsync()
    return result.impersonation
  }, [extendMutation])

  const stopImpersonation = useCallback(async (): Promise<void> => {
    await stopMutation.mutateAsync()
  }, [stopMutation])

  // Expose the eligible-targets query as a hook the picker opens lazily.
  // The venueId here comes from useCurrentVenue() → URL slug, so the response
  // reflects the venue the user sees in the address bar (not the stale JWT).
  const useEligibleTargets = () =>
    useQuery<EligibleTargetsResponseWithScope>({
      queryKey: impersonationTargetsQueryKey(venueId),
      queryFn: () => impersonationService.getEligibleTargets(venueId ?? undefined),
      enabled: isSuperadmin && !!venueId,
      staleTime: 2 * 60 * 1000,
    })

  return {
    isImpersonating: !!status.isImpersonating,
    mode: status.mode,
    impersonatedUserId: status.impersonatedUserId,
    impersonatedRole: status.impersonatedRole,
    realRole: status.realRole,
    isRealSuperadmin,
    expiresAt: status.expiresAt,
    extensionsUsed: status.extensionsUsed,
    maxExtensions: status.maxExtensions,
    reason: status.reason,
    timeRemainingMs,
    isInWarningZone,
    isInCriticalZone,
    isExpiredLocally,
    isLoading: statusQuery.isLoading,
    isStarting: startMutation.isPending,
    isExtending: extendMutation.isPending,
    isStopping: stopMutation.isPending,
    startImpersonation,
    extendImpersonation,
    stopImpersonation,
    useEligibleTargets,
    refreshStatus: () => queryClient.invalidateQueries({ queryKey: impersonationStatusQueryKey }),
  }
}

/**
 * Format milliseconds as mm:ss for display in the banner.
 */
export function formatImpersonationCountdown(ms: number | null): string {
  if (ms === null || ms <= 0) return '0:00'
  const totalSeconds = Math.ceil(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
