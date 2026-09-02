import { useInfiniteQuery, useQuery } from '@tanstack/react-query'

import { getCommercialBillingOverview, getCommercialBillingReceipts } from './api'

export function useCommercialBillingOverview(venueId: string | undefined) {
  return useQuery({
    queryKey: ['commercialBilling', 'overview', venueId],
    queryFn: () => getCommercialBillingOverview(venueId!),
    enabled: Boolean(venueId),
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  })
}

export function useCommercialBillingReceipts(venueId: string | undefined, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ['commercialBilling', 'receipts', venueId],
    queryFn: ({ pageParam }) => getCommercialBillingReceipts(venueId!, pageParam, 25),
    initialPageParam: null as string | null,
    getNextPageParam: page => (page.state === 'READY' ? (page.nextCursor ?? undefined) : undefined),
    enabled: Boolean(venueId) && enabled,
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  })
}
