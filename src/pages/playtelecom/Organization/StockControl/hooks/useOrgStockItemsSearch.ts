import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getOrgStockItems, type OrgStockItemsPage, type OrgStockItemsParams } from '@/services/stockDashboard.service'

export function useOrgStockItemsSearch(orgId: string | undefined, params: Omit<OrgStockItemsParams, 'page' | 'pageSize'>, enabled: boolean) {
  return useQuery<OrgStockItemsPage>({
    queryKey: ['org-stock-items-search', orgId, params],
    queryFn: () => getOrgStockItems(orgId!, { ...params, page: 1, pageSize: 100 }),
    enabled: Boolean(orgId) && enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  })
}
