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
    retry: 1, // Reduce retries to fail faster
    refetchOnWindowFocus: false,
  })
}

/**
 * Check if user should be warned before sending a message
 */
export function shouldWarnBeforeSending(tokenBudget: TokenBudgetStatus | undefined): {
  shouldWarn: boolean
  warningType: 'low' | 'exhausted' | 'overage' | null
  message: string | null
} {
  if (!tokenBudget) {
    return { shouldWarn: false, warningType: null, message: null }
  }

  if (tokenBudget.isInOverage) {
    return {
      shouldWarn: true,
      warningType: 'overage',
      message: `Estás en excedente. Se cobrarán $${tokenBudget.overageCost.toFixed(2)} USD adicionales.`,
    }
  }

  if (tokenBudget.totalAvailable <= 0) {
    return {
      shouldWarn: true,
      warningType: 'exhausted',
      message: 'Has agotado tus tokens. Las consultas adicionales tendrán costo.',
    }
  }

  if (tokenBudget.totalAvailable < 2000) {
    return {
      shouldWarn: true,
      warningType: 'low',
      message: `Te quedan pocos tokens (${tokenBudget.totalAvailable.toLocaleString()}). Considera comprar más.`,
    }
  }

  return { shouldWarn: false, warningType: null, message: null }
}

/**
 * Get warning level based on token budget status
 * Takes into account both free and purchased tokens
 */
export function getTokenWarningLevel(tokenBudget: TokenBudgetStatus | undefined): 'normal' | 'warning' | 'danger' | 'overage' {
  if (!tokenBudget) return 'normal'

  // If actually in overage (negative balance, using tokens beyond all available)
  if (tokenBudget.isInOverage) return 'overage'

  // If has purchased tokens available, adjust the warning level
  if (tokenBudget.extraTokensBalance > 0) {
    // With purchased tokens, only warn if total available is getting low
    if (tokenBudget.totalAvailable < 1000) return 'danger'
    if (tokenBudget.totalAvailable < 3000) return 'warning'
    return 'normal'
  }

  // For free tier only, use percentage of free tokens
  if (tokenBudget.percentageUsed >= 100) return 'danger' // All free used, but not in overage yet
  if (tokenBudget.percentageUsed >= 90) return 'danger'
  if (tokenBudget.percentageUsed >= 75) return 'warning'
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
