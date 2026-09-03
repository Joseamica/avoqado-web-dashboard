import { useQuery } from '@tanstack/react-query'
import { getOrgStockSummary, type OrgStockOverviewParams, type OrgStockSummaryData } from '@/services/stockDashboard.service'

export function useOrgStockSummary(orgId: string | undefined, params: OrgStockOverviewParams) {
  return useQuery<OrgStockSummaryData>({
    queryKey: ['org-stock-summary', orgId, params.dateFrom ?? null, params.dateTo ?? null],
    queryFn: () => getOrgStockSummary(orgId!, params),
    enabled: Boolean(orgId),
    staleTime: 30_000,
    retry: 1,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })
}
