import { useQuery } from '@tanstack/react-query'
import { getOrgStockOverview, type OrgStockOverview, type OrgStockOverviewParams } from '@/services/stockDashboard.service'

export function useOrgStockControl(orgId: string | undefined, params: OrgStockOverviewParams) {
  return useQuery<OrgStockOverview>({
    queryKey: ['org-stock-control', orgId, params.dateFrom ?? null, params.dateTo ?? null],
    queryFn: () => getOrgStockOverview(orgId!, params),
    enabled: !!orgId,
    staleTime: 60_000,
  })
}
