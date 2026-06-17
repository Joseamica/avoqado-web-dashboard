import { useQuery } from '@tanstack/react-query'

import { useCurrentVenue } from '@/hooks/use-current-venue'
import { accountingReportsKeys, getAccountingReports, type AccountingReportsResponse } from '@/services/fiscal/accountingReports.service'

/** Reportes contables del venue activo para un periodo. `enabled:false` desde el teaser. */
export function useAccountingReports(period: string, options?: { enabled?: boolean }) {
  const { venueId } = useCurrentVenue()
  const enabled = options?.enabled ?? true

  return useQuery<AccountingReportsResponse>({
    queryKey: accountingReportsKeys.byPeriod(venueId, period),
    queryFn: () => getAccountingReports(venueId!, period),
    enabled: !!venueId && enabled && !!period,
    staleTime: 30 * 1000,
  })
}
