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

import { intervaloDeRappi, useDeliveryStatus } from './use-delivery-status'

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

  it('canal PAUSED → LIVE: sigue en el panel vivo, donde está el control para reanudarlo (Rappi fase 3)', () => {
    mockUseVenueTier.mockReturnValue({ hasFeatureAccess: () => true, isLoading: false })
    mockQueries({ channels: [activeChannel({ status: 'PAUSED' })], activationRequest: pendingRequest() })

    const { result } = renderHook(() => useDeliveryStatus('venue-1'), { wrapper })

    expect(result.current.state).toBe('LIVE')
  })

  it('canal DISABLED + sin solicitud → TEASER (ahí sale «Reconectar»)', () => {
    mockUseVenueTier.mockReturnValue({ hasFeatureAccess: () => true, isLoading: false })
    mockQueries({ channels: [activeChannel({ provider: 'RAPPI', status: 'DISABLED' })], activationRequest: null })

    const { result } = renderHook(() => useDeliveryStatus('venue-1'), { wrapper })

    expect(result.current.state).toBe('TEASER')
  })

  it('con alguna tienda de Rappi la lista se refresca cada 30 s (sólo con la pestaña visible); sin Rappi no', () => {
    mockUseVenueTier.mockReturnValue({ hasFeatureAccess: () => true, isLoading: false })
    mockQueries({ channels: [] })

    renderHook(() => useDeliveryStatus('venue-1'), { wrapper })

    const canales = (mockUseQuery.mock.calls as [MockQueryOptions & Record<string, unknown>][])
      .map(([o]) => o)
      .find(o => o.queryKey[0] === 'deliveryChannels')!
    const intervalo = canales.refetchInterval as (q: { state: { data?: DeliveryChannelLink[] } }) => number | false
    expect(intervalo({ state: { data: [activeChannel({ provider: 'RAPPI' })] } })).toBe(30_000)
    expect(intervalo({ state: { data: [activeChannel()] } })).toBe(false)
    expect(intervalo({ state: { data: undefined } })).toBe(false)
    expect(canales.refetchIntervalInBackground).not.toBe(true)
    // Al volver a la pestaña SIEMPRE se relee, aunque todavía no haya Rappi (Codex código r1 #2: la primera conexión).
    expect(canales.refetchOnWindowFocus).toBe('always')
  })

  it('mientras una tienda de Rappi espera confirmación se refresca cada 10 s, sólo los primeros 5 min', () => {
    const ahora = Date.parse('2026-10-25T12:00:00.000Z')
    const esperando = (haceMs: number) =>
      activeChannel({ provider: 'RAPPI', status: 'PENDING', updatedAt: new Date(ahora - haceMs).toISOString() })
    expect(intervaloDeRappi([esperando(60_000)], ahora)).toBe(10_000)
    expect(intervaloDeRappi([esperando(6 * 60_000)], ahora)).toBe(30_000)
    expect(intervaloDeRappi([activeChannel({ status: 'PENDING', updatedAt: new Date(ahora).toISOString() })], ahora)).toBe(false)
  })

  it('tier cargando → isLoading true (independiente de si las queries de canal ya resolvieron)', () => {
    mockUseVenueTier.mockReturnValue({ hasFeatureAccess: () => false, isLoading: true })
    mockQueries({})

    const { result } = renderHook(() => useDeliveryStatus('venue-1'), { wrapper })

    expect(result.current.isLoading).toBe(true)
  })

  it('FAIL-OPEN durante carga de tier (hasFeatureAccess true + isLoading true) → enabled false en ambas queries, NO pega al API', () => {
    // useVenueTier hace fail-open: mientras planTierInfo === undefined, hasFeatureAccess() devuelve true
    // para TODOS los venues (incl. los LOCKED) — ver use-tier-feature-access.ts:95. Si el gate de las
    // queries no descuenta tierLoading, esa ventana de cold-load dispararía getChannels/getActivationRequest
    // en un venue SIN el feature → 403 (el backend las gatea con checkFeatureAccess). Debe seguir sin pegar
    // al API hasta que el tier asiente; cuando asiente, si el venue no tiene el feature, hasFeature ya es
    // false y sigue sin pegar.
    mockUseVenueTier.mockReturnValue({ hasFeatureAccess: () => true, isLoading: true })
    mockQueries({})

    const { result } = renderHook(() => useDeliveryStatus('venue-1'), { wrapper })

    expect(mockUseQuery.mock.calls.length).toBeGreaterThan(0)
    for (const [queryOpts] of mockUseQuery.mock.calls as [MockQueryOptions][]) {
      expect(queryOpts.enabled).toBe(false)
    }
    // Sin flash de contenido: mientras carga el tier, isLoading sigue true.
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
