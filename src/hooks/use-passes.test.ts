import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider, keepPreviousData } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'

type Tier = { hasFeatureAccess: (f: string) => boolean; isLoading: boolean; isResolved: boolean }
const tier = vi.hoisted(() => ({ current: { hasFeatureAccess: (_f: string) => true, isLoading: false, isResolved: true } as Tier }))
vi.mock('@/hooks/use-tier-feature-access', () => ({ useVenueTier: () => tier.current }))
// R62: la vista general exige reservations:read (como el server), no el plan.
const access = vi.hoisted(() => ({ allowed: ['reservations:read'] as string[] }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => access.allowed.includes(p) }) }))

vi.mock('@/services/passes.service', () => ({
  getPassIntegrationsOverview: vi.fn(),
  getPassCapacity: vi.fn(),
  listPassVisits: vi.fn(),
  getPassVisitsSummary: vi.fn(),
}))

// Se interceptan SÓLO useQuery/useInfiniteQuery para leer las opciones; QueryClient y useQueryClient son reales.
const mockUseQuery = vi.fn()
const mockUseInfiniteQuery = vi.fn()
vi.mock('@tanstack/react-query', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return {
    ...actual,
    useQuery: (opts: unknown) => mockUseQuery(opts),
    useInfiniteQuery: (opts: unknown) => mockUseInfiniteQuery(opts),
  }
})

import {
  passesKeys,
  useInvalidatePasses,
  usePassCapacity,
  usePassIntegrationsOverview,
  usePassVisits,
  usePassVisitsSummary,
  usePassesAccess,
} from './use-passes'

type Opts = {
  queryKey: readonly unknown[]
  enabled?: boolean
  placeholderData?: unknown
  staleTime?: number
  retry?: number
  refetchOnWindowFocus?: boolean
  refetchInterval?: number | false
  refetchIntervalInBackground?: boolean
}
let client: QueryClient
function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client }, children)
}
const allOpts = (): Opts[] => [...mockUseQuery.mock.calls, ...mockUseInfiniteQuery.mock.calls].map(c => c[0] as Opts)
const optsFor = (kind: string): Opts => allOpts().find(o => o.queryKey[2] === kind)!

function renderAll() {
  renderHook(
    () => {
      usePassIntegrationsOverview('v1')
      usePassCapacity('v1')
      usePassVisits('v1', { status: 'PENDING' })
      usePassVisitsSummary('v1', '2030-01')
    },
    { wrapper },
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  client = new QueryClient()
  mockUseQuery.mockReturnValue({ data: undefined, isLoading: false })
  mockUseInfiniteQuery.mockReturnValue({ data: undefined, isLoading: false })
  tier.current = { hasFeatureAccess: () => true, isLoading: false, isResolved: true }
  access.allowed = ['reservations:read']
})

describe('use-passes: candado de plan', () => {
  // nuevo — Review Focus 2 + R62 (pausa suave): el server ya no gatea la vista general por plan (el negocio debe VER que
  // sus clases dejaron de publicarse y poder desconectar); capacity, visits y summary siguen apagadas (ni un 403)
  it('sin el plan ⇒ sólo el overview corre; capacity, visits y summary con enabled=false', () => {
    tier.current = { hasFeatureAccess: () => false, isLoading: false, isResolved: true }
    renderAll()
    expect(allOpts()).toHaveLength(4)
    expect(optsFor('overview').enabled).toBe(true)
    for (const kind of ['capacity', 'visits', 'summary']) expect(optsFor(kind).enabled).toBe(false)
  })
  // nuevo — R62: el overview sí exige reservations:read (el server lo pide); sin él no sale una petición que acabe en 403
  it('sin reservations:read ⇒ el overview no corre', () => {
    access.allowed = []
    renderAll()
    expect(optsFor('overview').enabled).toBe(false)
  })
  // nuevo — Review Focus 2: useVenueTier hace fail-open mientras carga (hasFeatureAccess() devuelve true)
  it('con el plan todavía cargando ⇒ enabled=false aunque hasFeatureAccess diga true', () => {
    tier.current = { hasFeatureAccess: () => true, isLoading: true, isResolved: false }
    renderAll()
    for (const o of allOpts()) expect(o.enabled).toBe(false)
  })
  // nuevo — P1-2: la consulta del plan FALLÓ (ya no carga y no se resolvió). hasFeatureAccess sigue en fail-open, pero aquí NO se consulta
  it('con el plan sin poder comprobarse (isResolved=false, ya sin cargar) ⇒ enabled=false y unresolved=true', () => {
    tier.current = { hasFeatureAccess: () => true, isLoading: false, isResolved: false }
    renderAll()
    for (const o of allOpts()) expect(o.enabled).toBe(false)
    const { result } = renderHook(() => usePassesAccess('v1'), { wrapper })
    expect(result.current).toEqual({ hasFeature: true, tierLoading: false, resolved: false, unresolved: true, enabled: false })
  })
  // nuevo — sin negocio todavía no hay plan que comprobar: no es «la consulta falló» (la pantalla no debe pedir recargar)
  it('sin venueId ⇒ unresolved=false aunque isResolved sea false', () => {
    tier.current = { hasFeatureAccess: () => true, isLoading: false, isResolved: false }
    const { result } = renderHook(() => usePassesAccess(undefined), { wrapper })
    expect(result.current.unresolved).toBe(false)
    expect(result.current.enabled).toBe(false)
  })
  // nuevo
  it('con el plan resuelto y concedido ⇒ enabled=true y las claves cuelgan de [passes, venueId]', () => {
    renderAll()
    for (const o of allOpts()) {
      expect(o.enabled).toBe(true)
      expect(o.queryKey.slice(0, 2)).toEqual(['passes', 'v1'])
    }
    expect(allOpts().map(o => o.queryKey[2]).sort()).toEqual(['capacity', 'overview', 'summary', 'visits'])
  })
  // nuevo
  it('sin venueId ⇒ enabled=false', () => {
    renderHook(() => usePassIntegrationsOverview(undefined), { wrapper })
    expect((mockUseQuery.mock.calls[0][0] as Opts).enabled).toBe(false)
  })
  // nuevo — Review Focus 4: cambiar de filtro no deja la lista sin datos
  it('la lista de visitas conserva la página anterior mientras llega la nueva y es una consulta pesada', () => {
    renderHook(() => usePassVisits('v1', { status: 'PENDING', provider: 'TOTALPASS' }), { wrapper })
    const o = mockUseInfiniteQuery.mock.calls[0][0] as Opts
    expect(o.placeholderData).toBe(keepPreviousData)
    expect(o.queryKey).toEqual(['passes', 'v1', 'visits', { status: 'PENDING', provider: 'TOTALPASS' }])
    expect(o.retry).toBe(1)
    expect(o.refetchOnWindowFocus).toBe(false)
    expect(o.staleTime).toBeGreaterThanOrEqual(15_000)
  })
  // nuevo — P1-4: la recepción ve llegadas nuevas sin tocar nada, sólo con la pestaña visible; overview y capacity no lo necesitan
  it('visitas y resumen se refrescan cada 30 s sólo en primer plano; overview y capacity no', () => {
    renderAll()
    for (const kind of ['visits', 'summary']) {
      expect(optsFor(kind).refetchInterval).toBe(30_000)
      expect(optsFor(kind).refetchIntervalInBackground).toBe(false)
    }
    for (const kind of ['overview', 'capacity']) expect(optsFor(kind).refetchInterval).toBeUndefined()
  })
  // nuevo — P1-4: sin plan no hay un reloj pegándole a la API cada 30 s
  it('sin el plan, el refresco periódico se apaga (refetchInterval=false)', () => {
    tier.current = { hasFeatureAccess: () => false, isLoading: false, isResolved: true }
    renderAll()
    expect(optsFor('visits').refetchInterval).toBe(false)
    expect(optsFor('summary').refetchInterval).toBe(false)
  })
  // nuevo
  it('usePassesAccess expone las cinco señales', () => {
    tier.current = { hasFeatureAccess: () => false, isLoading: false, isResolved: true }
    const { result } = renderHook(() => usePassesAccess('v1'), { wrapper })
    expect(result.current).toEqual({ hasFeature: false, tierLoading: false, resolved: true, unresolved: false, enabled: false })
  })
})

describe('useInvalidatePasses: sólo lo que cambió', () => {
  const keysOf = (spy: { mock: { calls: unknown[][] } }) => spy.mock.calls.map(c => (c[0] as { queryKey: unknown }).queryKey)
  // nuevo — conectar, modo, clases y desconectar sólo cambian el overview
  it("'connection' invalida sólo el overview", async () => {
    const spy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useInvalidatePasses(), { wrapper })
    await result.current('v1', 'connection')
    expect(keysOf(spy)).toEqual([passesKeys.overview('v1')])
  })
  // nuevo — topes y cupo por sesión: la capacidad y lo que pinta «Pases: X de Y» (calendario y detalle de sesión)
  it("'rules' invalida capacity, class-sessions y class-session", async () => {
    const spy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useInvalidatePasses(), { wrapper })
    await result.current('v1', 'rules')
    expect(keysOf(spy)).toEqual([passesKeys.capacity('v1'), ['class-sessions', 'v1'], ['class-session', 'v1']])
  })
  // nuevo — confirmar hace check-in de la reserva: cambia la asistencia que leen las pantallas de reservas
  it("'visit' invalida visits, summary y las claves reales de reservas que muestran asistencia", async () => {
    const spy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useInvalidatePasses(), { wrapper })
    await result.current('v1', 'visit')
    expect(keysOf(spy)).toEqual([
      passesKeys.visitsAll('v1'),
      passesKeys.summaryAll('v1'),
      ['reservations', 'v1'],
      ['reservation', 'v1'],
      ['reservation-stats', 'v1'],
      ['reservation-calendar', 'v1'],
      ['class-session', 'v1'],
    ])
  })
})
