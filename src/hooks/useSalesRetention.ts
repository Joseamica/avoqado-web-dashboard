import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useCurrentVenue } from '@/hooks/use-current-venue'
import {
  getSalesRetention,
  salesRetentionKeys,
  setSalesRetention,
  type SalesRetentionResponse,
  type SetSalesRetentionInput,
} from '@/services/fiscal/salesRetention.service'
import { isrKeys } from '@/services/fiscal/isr.service'
import { ivaCashflowKeys } from '@/services/fiscal/ivaFlujo.service'

/** Retención en ventas capturada del periodo. `enabled:false` desde el teaser (paywall). */
export function useSalesRetention(period: string, options?: { enabled?: boolean }) {
  const { venueId } = useCurrentVenue()
  const enabled = options?.enabled ?? true

  return useQuery<SalesRetentionResponse>({
    queryKey: salesRetentionKeys.byPeriod(venueId, period),
    queryFn: () => getSalesRetention(venueId!, period),
    enabled: !!venueId && enabled,
    staleTime: 30 * 1000,
  })
}

/** Alta/actualización de la retención del periodo. Invalida ISR e IVA en flujo (ambos la restan). */
export function useSetSalesRetention() {
  const { venueId } = useCurrentVenue()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (input: SetSalesRetentionInput) => setSalesRetention(venueId!, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: salesRetentionKeys.all })
      qc.invalidateQueries({ queryKey: isrKeys.all })
      qc.invalidateQueries({ queryKey: ivaCashflowKeys.all })
    },
  })
}
