import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useCurrentVenue } from '@/hooks/use-current-venue'
import { fiscalLossKeys, getFiscalLoss, setFiscalLoss, type FiscalLossResponse } from '@/services/fiscal/fiscalLoss.service'
import { isrKeys } from '@/services/fiscal/isr.service'

/** Saldo de pérdidas de ejercicios anteriores del contribuyente. `enabled:false` desde el teaser. */
export function useFiscalLoss(options?: { enabled?: boolean }) {
  const { venueId } = useCurrentVenue()
  const enabled = options?.enabled ?? true
  return useQuery<FiscalLossResponse>({
    queryKey: fiscalLossKeys.byVenue(venueId),
    queryFn: () => getFiscalLoss(venueId!),
    enabled: !!venueId && enabled,
    staleTime: 30 * 1000,
  })
}

/** Alta/actualización del saldo. Invalida el ISR (lo resta a la utilidad del régimen general). */
export function useSetFiscalLoss() {
  const { venueId } = useCurrentVenue()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { pendingCents: number; note?: string | null }) => setFiscalLoss(venueId!, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fiscalLossKeys.all })
      qc.invalidateQueries({ queryKey: isrKeys.all })
    },
  })
}
