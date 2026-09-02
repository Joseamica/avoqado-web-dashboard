import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  getOrgStockBulkGroups,
  type OrgStockBulkGroupsPage,
  type OrgStockBulkGroupsParams,
} from '@/services/stockDashboard.service'

export function useOrgStockBulkGroups(orgId: string | undefined, params: OrgStockBulkGroupsParams, enabled: boolean) {
  return useQuery<OrgStockBulkGroupsPage>({
    queryKey: ['org-stock-bulk-groups', orgId, params],
    queryFn: () => getOrgStockBulkGroups(orgId!, params),
    enabled: Boolean(orgId) && enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  })
}
