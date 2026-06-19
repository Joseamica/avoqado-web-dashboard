import { useQuery } from '@tanstack/react-query'

import { useCurrentVenue } from '@/hooks/use-current-venue'
import { getAccountsPayable, type AccountsPayableResponse } from '@/services/fiscal/accountsPayable.service'

/** Antigüedad de saldos a proveedores (CxP) del venue activo. `enabled:false` desde el teaser (paywall). */
export function useAccountsPayable(asOf: string | undefined, options?: { enabled?: boolean }) {
  const { venueId } = useCurrentVenue()
  const enabled = options?.enabled ?? true

  return useQuery<AccountsPayableResponse>({
    queryKey: ['accounts-payable', venueId, asOf ?? 'today'],
    queryFn: () => getAccountsPayable(venueId!, asOf),
    enabled: !!venueId && enabled,
    staleTime: 30 * 1000,
  })
}
