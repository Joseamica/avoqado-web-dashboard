import { useQuery } from '@tanstack/react-query'

import { reintentarReporte, repetirAlVolver } from '@/components/accounting/errorDelReporte'
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
    // B4b (fallo 2 de la ronda 7): REPORT_TOO_LARGE / REPORT_TIMEOUT no se repiten solos; lo demás, 3 veces (el default de antes).
    retry: reintentarReporte(3),
    // I1 (revisión final): tampoco al recuperar el foco ni al reconectar.
    refetchOnWindowFocus: repetirAlVolver,
    refetchOnReconnect: repetirAlVolver,
  })
}
