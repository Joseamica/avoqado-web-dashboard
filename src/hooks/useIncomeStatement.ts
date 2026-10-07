import { useQuery } from '@tanstack/react-query'

import { reintentarReporte } from '@/components/accounting/errorDelReporte'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { fetchIncomeStatement, incomeStatementKeys, type IncomeStatementResponse } from '@/services/reports/incomeStatement.service'

interface UseIncomeStatementArgs {
  from: string // YYYY-MM-DD (venue timezone)
  to: string // YYYY-MM-DD (venue timezone)
  enabled?: boolean
}

/**
 * Loads the Capa A income statement for the current venue + date range.
 * Scoped to the active venue via useCurrentVenue(); disabled until a venue and
 * both dates are present.
 */
export function useIncomeStatement({ from, to, enabled = true }: UseIncomeStatementArgs) {
  const { venueId } = useCurrentVenue()

  const query = useQuery<IncomeStatementResponse>({
    queryKey: incomeStatementKeys.report(venueId, from, to),
    queryFn: () => fetchIncomeStatement(venueId!, from, to),
    enabled: !!venueId && enabled && !!from && !!to,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    // B4b (Codex r5 R5-8): REPORT_TOO_LARGE / REPORT_TIMEOUT no se repiten solos; lo demás, una vez como antes.
    retry: reintentarReporte(1),
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}
