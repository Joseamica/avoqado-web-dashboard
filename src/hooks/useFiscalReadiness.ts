import { useQuery } from '@tanstack/react-query'

import { useCurrentVenue } from '@/hooks/use-current-venue'
import { getFiscalReadiness, type FiscalReadinessResponse } from '@/services/fiscal/fiscalReadiness.service'

/** Diagnóstico de preparación fiscal (onboarding) del venue activo. `enabled:false` desde el teaser (paywall). */
export function useFiscalReadiness(options?: { enabled?: boolean }) {
  const { venueId } = useCurrentVenue()
  const enabled = options?.enabled ?? true

  return useQuery<FiscalReadinessResponse>({
    queryKey: ['fiscal-readiness', venueId],
    queryFn: () => getFiscalReadiness(venueId!),
    enabled: !!venueId && enabled,
    staleTime: 30 * 1000,
  })
}
