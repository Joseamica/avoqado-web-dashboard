import { useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { onboardingStateService, type OnboardingStateMap } from '@/services/onboardingState.service'

/**
 * Reads ALL onboarding state for the current venue at once. Backed by a
 * single TanStack Query cache key per venue so every consumer shares one
 * network request and one reactive source of truth.
 *
 * Individual features should prefer `useOnboardingKey` below for ergonomics.
 */
export function useOnboardingStateMap() {
  const { venueId } = useCurrentVenue()

  const query = useQuery({
    queryKey: ['onboarding-state', venueId],
    queryFn: () => onboardingStateService.getAll(venueId!),
    enabled: !!venueId,
    // Onboarding state changes rarely; don't auto-refetch on window focus.
    staleTime: Infinity,
    // Keep in cache across route changes so the banner doesn't flash on navigation.
    gcTime: 30 * 60 * 1000,
    // Back off on 401/403 — guards + login flow will handle session issues.
    retry: false,
  })

  return {
    data: query.data ?? {},
    isLoading: query.isLoading,
    isFetched: query.isFetched,
    error: query.error,
  }
}

/**
 * Read/write a single onboarding state key with optimistic updates.
 *
 * Returns:
 *  - `value`: current state value (or `defaultValue` until the fetch resolves).
 *  - `isLoaded`: `true` after the initial fetch completes — use this to avoid
 *    flashing dismissable UI before hydration.
 *  - `setValue(next)`: optimistically updates the cache and PUTs to the API.
 *    Rolls back on failure so the UI stays consistent.
 *  - `clear()`: deletes the key (back to default).
 */
export function useOnboardingKey<T = unknown>(
  key: string,
  defaultValue: T,
): {
  value: T
  isLoaded: boolean
  setValue: (next: T) => void
  clear: () => void
} {
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { data, isFetched } = useOnboardingStateMap()

  const value = useMemo<T>(() => {
    if (!(key in data)) return defaultValue
    return data[key] as T
  }, [data, key, defaultValue])

  const queryKey = useMemo(() => ['onboarding-state', venueId], [venueId])

  const setMutation = useMutation({
    mutationFn: async (next: T) => {
      if (!venueId) throw new Error('No active venue')
      await onboardingStateService.set(venueId, key, next)
    },
    onMutate: async (next: T) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<OnboardingStateMap>(queryKey)
      queryClient.setQueryData<OnboardingStateMap>(queryKey, {
        ...(previous ?? {}),
        [key]: next,
      })
      return { previous }
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(queryKey, ctx.previous)
      }
    },
    // Trust the optimistic update; don't re-fetch after every write.
  })

  const clearMutation = useMutation({
    mutationFn: async () => {
      if (!venueId) throw new Error('No active venue')
      await onboardingStateService.clear(venueId, key)
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<OnboardingStateMap>(queryKey)
      const next = { ...(previous ?? {}) }
      delete next[key]
      queryClient.setQueryData<OnboardingStateMap>(queryKey, next)
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(queryKey, ctx.previous)
      }
    },
  })

  const setValue = useCallback((next: T) => setMutation.mutate(next), [setMutation])
  const clear = useCallback(() => clearMutation.mutate(), [clearMutation])

  return {
    value,
    isLoaded: isFetched,
    setValue,
    clear,
  }
}
