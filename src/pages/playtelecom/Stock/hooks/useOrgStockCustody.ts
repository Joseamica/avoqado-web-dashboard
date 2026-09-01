import { useInfiniteQuery } from '@tanstack/react-query'
import {
  getOrgStockCustody,
  type OrgStockCustodyPage,
  type OrgStockCustodyParams,
} from '@/services/stockDashboard.service'

export function useOrgStockCustody(orgId: string | undefined, params: Omit<OrgStockCustodyParams, 'page'>, enabled = true) {
  return useInfiniteQuery<OrgStockCustodyPage>({
    queryKey: ['org-stock-custody', orgId, params],
    queryFn: ({ pageParam }) => getOrgStockCustody(orgId!, { ...params, page: Number(pageParam) }),
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
