import { useQuery } from '@tanstack/react-query'
import { getOrgStockOverview, type OrgStockOverview, type OrgStockOverviewParams } from '@/services/stockDashboard.service'

export function useOrgStockControl(orgId: string | undefined, params: OrgStockOverviewParams) {
  return useQuery<OrgStockOverview>({
    queryKey: ['org-stock-control', orgId, params.dateFrom ?? null, params.dateTo ?? null],
    queryFn: () => getOrgStockOverview(orgId!, params),
    enabled: !!orgId,
    // Control de Stock is the supervisor's day-to-day screen and must reflect a SIM's
    // real status quickly (Isaac 2026-07-21: a SIM sold mid-bulk still showed "Disponible"
    // here because the list was cached fresh for 60s). Show cached instantly but always
    // refetch fresh on entering the page and on returning to the tab.
    staleTime: 10_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })
}
