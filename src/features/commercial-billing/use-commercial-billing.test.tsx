import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useInfiniteQuery, useQuery } from '@tanstack/react-query'

import { previewCommercialConfigurator } from './api'
import type { CommercialConfiguratorSelection } from './commercial-contract'
import { useCommercialConfiguratorPreview } from './use-commercial-billing'

vi.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: vi.fn(),
  useQuery: vi.fn(),
}))

vi.mock('./api', () => ({
  getCommercialBillingOverview: vi.fn(),
  getCommercialBillingReceipts: vi.fn(),
  previewCommercialConfigurator: vi.fn(),
}))

const mockedUseQuery = vi.mocked(useQuery)
const mockedUseInfiniteQuery = vi.mocked(useInfiniteQuery)
const mockedPreview = vi.mocked(previewCommercialConfigurator)

function latestQueryOptions() {
  return mockedUseQuery.mock.calls[mockedUseQuery.mock.calls.length - 1]?.[0]
}

describe('useCommercialConfiguratorPreview', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockedUseQuery.mockReturnValue({} as never)
    mockedUseInfiniteQuery.mockReturnValue({} as never)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('debounces selection changes and forwards TanStack Query cancellation to the preview request', async () => {
    const initial: CommercialConfiguratorSelection = {
      mode: 'CUSTOM',
      billingUnit: 'VENUE_MONTH',
      moduleCodes: [],
    }
    const changed: CommercialConfiguratorSelection = {
      mode: 'CUSTOM',
      billingUnit: 'VENUE_MONTH',
      moduleCodes: ['CFDI_MODULE'],
    }
    const { result, rerender } = renderHook(
      ({ selection }) => useCommercialConfiguratorPreview('venue-1', selection, true),
      { initialProps: { selection: initial } },
    )

    expect(result.current.isSelectionPending).toBe(false)
    expect(latestQueryOptions()?.queryKey).toEqual(['commercialBilling', 'configurator', 'venue-1', initial])

    rerender({ selection: changed })
    expect(result.current.isSelectionPending).toBe(true)
    expect(latestQueryOptions()?.queryKey).toEqual(['commercialBilling', 'configurator', 'venue-1', initial])

    act(() => vi.advanceTimersByTime(299))
    expect(latestQueryOptions()?.queryKey).toEqual(['commercialBilling', 'configurator', 'venue-1', initial])

    act(() => vi.advanceTimersByTime(1))
    expect(result.current.isSelectionPending).toBe(false)
    const changedOptions = latestQueryOptions()
    expect(changedOptions?.queryKey).toEqual(['commercialBilling', 'configurator', 'venue-1', changed])

    const controller = new AbortController()
    const queryFn = changedOptions?.queryFn
    expect(typeof queryFn).toBe('function')
    if (typeof queryFn !== 'function') throw new Error('Expected configurator queryFn')
    await queryFn({ signal: controller.signal } as never)
    expect(mockedPreview).toHaveBeenCalledWith('venue-1', changed, controller.signal)
  })

  it('keeps the last confirmed preview while a changed selection is priced', () => {
    const selection: CommercialConfiguratorSelection = {
      mode: 'CUSTOM',
      billingUnit: 'VENUE_MONTH',
      moduleCodes: [],
    }

    renderHook(() => useCommercialConfiguratorPreview('venue-1', selection, true))

    const placeholderData = latestQueryOptions()?.placeholderData
    expect(placeholderData).toBeTypeOf('function')
    if (typeof placeholderData !== 'function') throw new Error('Expected configurator placeholderData')
    const previousPreview = { source: 'server-confirmed-preview' }
    expect(placeholderData(previousPreview as never, undefined as never)).toBe(previousPreview)
  })
})
