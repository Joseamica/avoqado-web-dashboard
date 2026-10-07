import { useQuery } from '@tanstack/react-query'

import { reintentarReporte, repetirAlVolver } from '@/components/accounting/errorDelReporte'
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
    // B4b (Codex r5 R5-8): REPORT_TOO_LARGE / REPORT_TIMEOUT no se repiten solos; lo demás, 3 veces (el default de react-query de antes).
    retry: reintentarReporte(3),
    // I1 (revisión final): tampoco al recuperar el foco ni al reconectar.
    refetchOnWindowFocus: repetirAlVolver,
    refetchOnReconnect: repetirAlVolver,
  })
}
