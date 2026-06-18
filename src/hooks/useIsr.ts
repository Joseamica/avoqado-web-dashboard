import { useQuery } from '@tanstack/react-query'

import { useCurrentVenue } from '@/hooks/use-current-venue'
import { getIsrProvisional, isrKeys, type IsrProvisionalResponse, type IsrRegime } from '@/services/fiscal/isr.service'

/** Estimación del pago provisional de ISR del venue activo. `enabled:false` desde el teaser (paywall). */
export function useIsrProvisional(period: string, regime: IsrRegime, options?: { enabled?: boolean }) {
  const { venueId } = useCurrentVenue()
  const enabled = options?.enabled ?? true

  return useQuery<IsrProvisionalResponse>({
    queryKey: isrKeys.byPeriod(venueId, period, regime),
    queryFn: () => getIsrProvisional(venueId!, period, regime),
    enabled: !!venueId && enabled,
    staleTime: 30 * 1000,
  })
}
