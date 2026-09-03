import { useEffect, useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'

import { getCommercialBillingOverview, getCommercialBillingReceipts, previewCommercialConfigurator } from './api'
import type { CommercialConfiguratorSelection } from './commercial-contract'

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

function useDebouncedSelection(selection: CommercialConfiguratorSelection | null, delay: number) {
  const [debounced, setDebounced] = useState(selection)
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(selection), delay)
    return () => window.clearTimeout(timeout)
  }, [delay, selection])
  return debounced
}

export function useCommercialConfiguratorPreview(
  venueId: string | undefined,
  selection: CommercialConfiguratorSelection | null,
  enabled: boolean,
) {
  const debouncedSelection = useDebouncedSelection(selection, 300)
  const query = useQuery({
    queryKey: ['commercialBilling', 'configurator', venueId, debouncedSelection],
    queryFn: ({ signal }) => previewCommercialConfigurator(venueId!, debouncedSelection!, signal),
    enabled: Boolean(venueId) && enabled && debouncedSelection !== null,
    staleTime: 0,
    gcTime: 60_000,
    retry: 0,
    refetchOnWindowFocus: false,
  })
  return { ...query, isSelectionPending: debouncedSelection !== selection }
}
