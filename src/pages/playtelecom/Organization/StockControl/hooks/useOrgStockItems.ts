import { useInfiniteQuery } from '@tanstack/react-query'
import { getOrgStockItems, type OrgStockItemsPage, type OrgStockItemsParams } from '@/services/stockDashboard.service'

export function useOrgStockItems(orgId: string | undefined, params: Omit<OrgStockItemsParams, 'page'>, enabled: boolean) {
  return useInfiniteQuery<OrgStockItemsPage>({
    queryKey: ['org-stock-items', orgId, params],
    queryFn: ({ pageParam }) => getOrgStockItems(orgId!, { ...params, page: Number(pageParam) }),
    initialPageParam: 1,
    getNextPageParam: lastPage => {
      const { page, totalPages } = lastPage.pagination
      return page < totalPages ? page + 1 : undefined
    },
    enabled: Boolean(orgId) && enabled,
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  })
}
