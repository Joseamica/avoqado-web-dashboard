import { useQuery } from '@tanstack/react-query'

import { useCurrentVenue } from '@/hooks/use-current-venue'
import { getTrialBalance, trialBalanceKeys, type TrialBalanceResponse } from '@/services/fiscal/trialBalance.service'

/** Balanza de comprobación del venue activo para un periodo. `enabled:false` desde el teaser. */
export function useTrialBalance(period: string, options?: { enabled?: boolean }) {
  const { venueId } = useCurrentVenue()
  const enabled = options?.enabled ?? true

  return useQuery<TrialBalanceResponse>({
    queryKey: trialBalanceKeys.byPeriod(venueId, period),
    queryFn: () => getTrialBalance(venueId!, period),
    enabled: !!venueId && enabled && !!period,
    staleTime: 30 * 1000,
  })
}
