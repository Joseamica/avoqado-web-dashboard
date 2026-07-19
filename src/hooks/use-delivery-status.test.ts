// src/hooks/use-delivery-status.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import type { DeliveryChannelLink, DeliveryActivationRequest } from '@/types/delivery'

// ---------------------------------------------------------------------------
// useVenueTier mock — controls hasFeatureAccess('DELIVERY_CHANNELS') + tierLoading per test
// ---------------------------------------------------------------------------
const mockUseVenueTier = vi.fn()
vi.mock('@/hooks/use-tier-feature-access', () => ({
  useVenueTier: () => mockUseVenueTier(),
}))

// ---------------------------------------------------------------------------
// delivery.service mock — inert. useQuery itself is mocked below so queryFn never actually
// runs in these tests; this just satisfies the hook's import.
// ---------------------------------------------------------------------------
vi.mock('@/services/delivery.service', () => ({
  getChannels: vi.fn(),
  getActivationRequest: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Mock @tanstack/react-query's useQuery so we control channels/activationRequest per queryKey
// without hitting the network. Mirrors src/components/billing/__tests__/FeatureGate.test.tsx.
// ---------------------------------------------------------------------------
const mockUseQuery = vi.fn()
vi.mock('@tanstack/react-query', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return {
    ...actual,
    useQuery: (opts: Parameters<typeof actual.useQuery>[0]) => mockUseQuery(opts),
  }
})

import { useDeliveryStatus } from './use-delivery-status'

type MockQueryOptions = { queryKey: readonly unknown[]; enabled?: boolean }

function activeChannel(overrides: Partial<DeliveryChannelLink> = {}): DeliveryChannelLink {
  return {
    id: 'link-1',
    venueId: 'venue-1',
    provider: 'UBER_EATS',
    status: 'ACTIVE',
    orderAcceptanceMode: 'AUTO',
    autoSyncMenu: true,
    lastMenuSyncAt: null,
    externalLocationId: 'ext-1',
    ...overrides,
  }
}

function pendingRequest(overrides: Partial<DeliveryActivationRequest> = {}): DeliveryActivationRequest {
  return {
    id: 'req-1',
    venueId: 'venue-1',
    status: 'PENDING',
    requestedChannels: ['UBER_EATS'],
    note: null,
    createdAt: '2026-07-18T00:00:00.000Z',
    ...overrides,
  }
}

/** Wires mockUseQuery to answer BOTH hook queries by queryKey, like the two real per-key caches would. */
function mockQueries(opts: {
  channels?: DeliveryChannelLink[]
  channelsLoading?: boolean
  activationRequest?: DeliveryActivationRequest | null
  activationLoading?: boolean
}) {
  mockUseQuery.mockImplementation((queryOpts: MockQueryOptions) => {
    const key = queryOpts.queryKey[0]
    if (key === 'deliveryChannels') return { data: opts.channels ?? [], isLoading: opts.channelsLoading ?? false }
    if (key === 'deliveryActivation') return { data: opts.activationRequest ?? null, isLoading: opts.activationLoading ?? false }
    throw new Error(`useQuery mock: unexpected queryKey ${String(key)}`)
  })
}

// Real QueryClientProvider wrapper (repo convention — see FeatureGate.test.tsx), written with
// createElement (not JSX) so this stays a plain .ts file per the task-4 brief's file path.
function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient()
  return createElement(QueryClientProvider, { client: queryClient }, children)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useDeliveryStatus', () => {
  // ---------------------------------------------------------------------------------------------
  // Obligatory cases (task-4 brief)
  // ---------------------------------------------------------------------------------------------
  it('sin feature (hasFeatureAccess false) → LOCKED, sin pegarle al API de activación', () => {
    mockUseVenueTier.mockReturnValue({ hasFeatureAccess: () => false, isLoading: false })
    mockQueries({}) // channels/activationRequest defaults are irrelevant — LOCKED short-circuits first

    const { result } = renderHook(() => useDeliveryStatus('venue-1'), { wrapper })

    expect(result.current.state).toBe('LOCKED')
    // enabled must be false on BOTH queries — no unnecessary request/403 against the activation API
    expect(mockUseQuery.mock.calls.length).toBeGreaterThan(0)
    for (const [queryOpts] of mockUseQuery.mock.calls as [MockQueryOptions][]) {
      expect(queryOpts.enabled).toBe(false)
    }
  })

  it('con feature, sin canal ACTIVE, sin solicitud → TEASER', () => {
    mockUseVenueTier.mockReturnValue({ hasFeatureAccess: () => true, isLoading: false })
    mockQueries({ channels: [], activationRequest: null })

    const { result } = renderHook(() => useDeliveryStatus('venue-1'), { wrapper })

    expect(result.current.state).toBe('TEASER')
  })

  it('con feature, sin canal ACTIVE, con solicitud viva → PENDING', () => {
    mockUseVenueTier.mockReturnValue({ hasFeatureAccess: () => true, isLoading: false })
    mockQueries({ channels: [], activationRequest: pendingRequest() })

    const { result } = renderHook(() => useDeliveryStatus('venue-1'), { wrapper })

    expect(result.current.state).toBe('PENDING')
  })

  it('con feature, ≥1 canal ACTIVE → LIVE (aunque haya solicitud viva)', () => {
    mockUseVenueTier.mockReturnValue({ hasFeatureAccess: () => true, isLoading: false })
    mockQueries({ channels: [activeChannel()], activationRequest: pendingRequest() })

    const { result } = renderHook(() => useDeliveryStatus('venue-1'), { wrapper })

    expect(result.current.state).toBe('LIVE')
    expect(result.current.channels).toHaveLength(1)
    expect(result.current.activationRequest).not.toBeNull()
  })

  // ---------------------------------------------------------------------------------------------
  // Additional coverage: enabled-gating, loading precedence, non-ACTIVE channel statuses
  // ---------------------------------------------------------------------------------------------
  it('sin venueId → enabled=false en ambas queries aunque haya feature', () => {
    mockUseVenueTier.mockReturnValue({ hasFeatureAccess: () => true, isLoading: false })
    mockQueries({})

    renderHook(() => useDeliveryStatus(undefined), { wrapper })

    expect(mockUseQuery.mock.calls.length).toBeGreaterThan(0)
    for (const [queryOpts] of mockUseQuery.mock.calls as [MockQueryOptions][]) {
      expect(queryOpts.enabled).toBe(false)
    }
  })

  it('canal existente pero PENDING (no ACTIVE) + sin solicitud → TEASER, no LIVE', () => {
    mockUseVenueTier.mockReturnValue({ hasFeatureAccess: () => true, isLoading: false })
    mockQueries({ channels: [activeChannel({ status: 'PENDING' })], activationRequest: null })

    const { result } = renderHook(() => useDeliveryStatus('venue-1'), { wrapper })

    expect(result.current.state).toBe('TEASER')
  })

  it('canal PAUSED (no ACTIVE) + solicitud viva → PENDING, no LIVE', () => {
    mockUseVenueTier.mockReturnValue({ hasFeatureAccess: () => true, isLoading: false })
    mockQueries({ channels: [activeChannel({ status: 'PAUSED' })], activationRequest: pendingRequest() })

    const { result } = renderHook(() => useDeliveryStatus('venue-1'), { wrapper })

    expect(result.current.state).toBe('PENDING')
  })

  it('tier cargando → isLoading true (independiente de si las queries de canal ya resolvieron)', () => {
    mockUseVenueTier.mockReturnValue({ hasFeatureAccess: () => false, isLoading: true })
    mockQueries({})

    const { result } = renderHook(() => useDeliveryStatus('venue-1'), { wrapper })

    expect(result.current.isLoading).toBe(true)
  })

  it('con feature, query de canales en vuelo → isLoading true', () => {
    mockUseVenueTier.mockReturnValue({ hasFeatureAccess: () => true, isLoading: false })
    mockQueries({ channelsLoading: true, activationLoading: false })

    const { result } = renderHook(() => useDeliveryStatus('venue-1'), { wrapper })

    expect(result.current.isLoading).toBe(true)
  })

  it('con feature, query de solicitud en vuelo → isLoading true', () => {
    mockUseVenueTier.mockReturnValue({ hasFeatureAccess: () => true, isLoading: false })
    mockQueries({ channelsLoading: false, activationLoading: true })

    const { result } = renderHook(() => useDeliveryStatus('venue-1'), { wrapper })

    expect(result.current.isLoading).toBe(true)
  })

  it('LOCKED (queries deshabilitadas) → isLoading general false, no se queda colgado cargando', () => {
    mockUseVenueTier.mockReturnValue({ hasFeatureAccess: () => false, isLoading: false })
    mockQueries({ channelsLoading: false, activationLoading: false })

    const { result } = renderHook(() => useDeliveryStatus('venue-1'), { wrapper })

    expect(result.current.isLoading).toBe(false)
  })
})
