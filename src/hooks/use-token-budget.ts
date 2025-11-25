import { useQuery } from '@tanstack/react-query'
import { getTokenBudgetStatus, TokenBudgetStatus } from '@/services/chatService'

// Query key for token budget
export const tokenBudgetQueryKey = ['chat', 'tokenBudget'] as const

/**
 * Hook to fetch and manage token budget status for the current venue
 * Automatically refetches when the venue changes (via query key)
 */
export function useTokenBudget() {
  return useQuery<TokenBudgetStatus>({
    queryKey: tokenBudgetQueryKey,
    queryFn: getTokenBudgetStatus,
    staleTime: 2 * 60 * 1000, // 2 minutes - budget doesn't change frequently
    gcTime: 5 * 60 * 1000, // 5 minutes cache
    retry: 2,
    refetchOnWindowFocus: false,
  })
}

/**
 * Get warning level based on percentage used
 */
export function getTokenWarningLevel(percentageUsed: number): 'normal' | 'warning' | 'danger' | 'overage' {
  if (percentageUsed >= 100) return 'overage'
  if (percentageUsed >= 90) return 'danger'
  if (percentageUsed >= 75) return 'warning'
  return 'normal'
}

/**
 * Format token count for display (e.g., 10000 -> "10K")
 */
export function formatTokenCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}K`
  }
  return count.toString()
}
