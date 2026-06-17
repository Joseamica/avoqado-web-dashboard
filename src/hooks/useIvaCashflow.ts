import { useQuery } from '@tanstack/react-query'

import { useCurrentVenue } from '@/hooks/use-current-venue'
import { getIvaCashflow, ivaCashflowKeys, type IvaCashflowResponse } from '@/services/fiscal/ivaFlujo.service'

/** IVA en flujo de efectivo del contribuyente del venue activo para un periodo. `enabled:false` desde el teaser. */
export function useIvaCashflow(period: string, options?: { enabled?: boolean }) {
  const { venueId } = useCurrentVenue()
  const enabled = options?.enabled ?? true

  return useQuery<IvaCashflowResponse>({
    queryKey: ivaCashflowKeys.byPeriod(venueId, period),
    queryFn: () => getIvaCashflow(venueId!, period),
    enabled: !!venueId && enabled && !!period,
    staleTime: 30 * 1000,
  })
}
