import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useCatalogItems } from './use-catalog-items'
import { useQuery } from '@tanstack/react-query'

vi.mock('@tanstack/react-query', () => ({ useQuery: vi.fn() }))

const mockedUseQuery = vi.mocked(useQuery)
const refetch = vi.fn()

function latestQueryKey() {
  const calls = mockedUseQuery.mock.calls
  return calls[calls.length - 1]?.[0].queryKey
}

describe('useCatalogItems', () => {
  beforeEach(() => {
    refetch.mockReset()
    mockedUseQuery.mockReturnValue({
      data: { items: [], nextCursor: 'cursor-2' },
      isPending: false,
      isFetching: false,
      error: null,
      refetch,
    } as never)
  })

  it('supports forward and backward cursor navigation without losing page authority', () => {
    const { result } = renderHook(() => useCatalogItems('org-1'))

    expect(result.current.canGoBack).toBe(false)
    expect(latestQueryKey()).toEqual(['master-catalog-items', 'org-1', 'ACTIVE', undefined])

    act(() => result.current.loadNext())
    expect(result.current.canGoBack).toBe(true)
    expect(latestQueryKey()).toEqual(['master-catalog-items', 'org-1', 'ACTIVE', 'cursor-2'])

    act(() => result.current.loadPrevious())
    expect(result.current.canGoBack).toBe(false)
    expect(latestQueryKey()).toEqual(['master-catalog-items', 'org-1', 'ACTIVE', undefined])
  })

  it('refetches the current page even when it is the first page', () => {
    const { result } = renderHook(() => useCatalogItems('org-1'))

    act(() => result.current.refresh())

    expect(refetch).toHaveBeenCalledTimes(1)
  })
})
