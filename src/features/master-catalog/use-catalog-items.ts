import { useCallback, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { listCatalogItems } from './api'
import type { CatalogItemStatus } from './types'

export function useCatalogItems(organizationId: string | null | undefined) {
  const [status, setStatus] = useState<CatalogItemStatus>('ACTIVE')
  const [cursorHistory, setCursorHistory] = useState<Array<string | undefined>>([undefined])
  const cursor = cursorHistory[cursorHistory.length - 1]

  const query = useQuery({
    queryKey: ['master-catalog-items', organizationId, status, cursor],
    queryFn: () => listCatalogItems(organizationId as string, { cursor, pageSize: 25, status }),
    enabled: Boolean(organizationId),
    retry: false,
  })

  const setScopedStatus = useCallback((nextStatus: CatalogItemStatus) => {
    setStatus(nextStatus)
    setCursorHistory([undefined])
  }, [])

  const loadNext = useCallback(() => {
    if (!query.data?.nextCursor) return
    setCursorHistory(current =>
      current[current.length - 1] === query.data?.nextCursor ? current : [...current, query.data?.nextCursor ?? undefined],
    )
  }, [query.data?.nextCursor])

  const loadPrevious = useCallback(() => {
    setCursorHistory(current => (current.length > 1 ? current.slice(0, -1) : current))
  }, [])

  const refresh = useCallback(() => {
    void query.refetch()
  }, [query])

  return {
    items: query.data?.items ?? [],
    nextCursor: query.data?.nextCursor ?? null,
    isLoading: query.isPending,
    isFetching: query.isFetching,
    error: query.error,
    status,
    setStatus: setScopedStatus,
    loadNext,
    loadPrevious,
    canGoBack: cursorHistory.length > 1,
    refresh,
  }
}
