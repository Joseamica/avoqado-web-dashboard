import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn((options: unknown) => options),
  useCurrentVenue: vi.fn(() => ({ venueId: 'venue-root' })),
}))

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query')
  return { ...actual, useQuery: mocks.useQuery }
})

vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: mocks.useCurrentVenue }))

import { useStoresActivityFeed } from './useStoresAnalysis'

describe('useStoresActivityFeed', () => {
  beforeEach(() => vi.clearAllMocks())

  it('preserves refetchInterval=false instead of silently restoring polling', () => {
    const { result } = renderHook(() =>
      useStoresActivityFeed(100, {
        enabled: true,
        refetchInterval: false as never,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        startDate: '2026-07-01T00:00:00.000Z',
        endDate: '2026-07-31T23:59:59.999Z',
      }),
    )

    expect((result.current as unknown as { refetchInterval: number | false }).refetchInterval).toBe(false)
    expect(result.current).toEqual(
      expect.objectContaining({
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      }),
    )
  })
})
