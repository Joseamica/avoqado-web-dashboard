import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider, keepPreviousData } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'

const access = vi.hoisted(() => ({ allowed: ['giftCards:read'] as string[], loading: false }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => access.allowed.includes(p), isLoading: access.loading }) }))
// Todas las funciones del servicio, aunque esta prueba no las llame: un export ausente en un mock de vitest truena al usarse.
vi.mock('@/services/giftCard.service', () => ({
  getGiftCardSettings: vi.fn(),
  updateGiftCardSettings: vi.fn(),
  listGiftCards: vi.fn(),
  getGiftCardDetail: vi.fn(),
  operateGiftCard: vi.fn(),
  startGiftCardSaleCancel: vi.fn(),
  releaseGiftCardSaleCancel: vi.fn(),
  getGiftCardSummary: vi.fn(),
  getGiftCardAging: vi.fn(),
  listGiftCardPendingAccounting: vi.fn(),
  downloadGiftCardBalancesCsv: vi.fn(),
}))

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
  GIFT_CARDS_PAGE_SIZE,
  giftCardKeys,
  useGiftCardAging,
  useGiftCardDetail,
  useGiftCardList,
  useGiftCardPendingAccounting,
  useGiftCardSettings,
  useGiftCardSummary,
  useInvalidateGiftCards,
} from './use-gift-cards'

type Opts = {
  queryKey: readonly unknown[]
  enabled?: boolean
  placeholderData?: unknown
  staleTime?: number
  retry?: number
  refetchOnWindowFocus?: boolean
  getNextPageParam?: (last: unknown) => unknown
}
let client: QueryClient
const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children)
const allOpts = (): Opts[] => [...mockUseQuery.mock.calls, ...mockUseInfiniteQuery.mock.calls].map(c => c[0] as Opts)
const FILTROS = { search: '4821', status: ['ACTIVE' as const] }

function renderAll(venueId: string | undefined) {
  renderHook(
    () => {
      useGiftCardSettings(venueId)
      useGiftCardList(venueId, FILTROS)
      useGiftCardDetail(venueId, 'g1')
      useGiftCardSummary(venueId, '2026-10-01', '2026-10-14')
      useGiftCardAging(venueId, '2026-10-14')
      useGiftCardPendingAccounting(venueId, '2026-10-01', '2026-10-14')
    },
    { wrapper },
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  client = new QueryClient()
  access.allowed = ['giftCards:read']
  access.loading = false
  mockUseQuery.mockReturnValue({ data: undefined, isLoading: false })
  mockUseInfiniteQuery.mockReturnValue({ data: undefined, isLoading: false })
})

describe('use-gift-cards: consultas', () => {
  it('todas las claves cuelgan de [gift-cards, venueId] y corren con giftCards:read (sin pedir plan, R9)', () => {
    renderAll('v1')
    expect(allOpts()).toHaveLength(6)
    for (const o of allOpts()) {
      expect(o.queryKey.slice(0, 2)).toEqual(['gift-cards', 'v1'])
      expect(o.enabled).toBe(true)
    }
  })

  it('sin giftCards:read no corre ninguna (ni un 403 en la red)', () => {
    access.allowed = []
    renderAll('v1')
    for (const o of allOpts()) expect(o.enabled).toBe(false)
  })

  it('sin negocio no corre ninguna', () => {
    renderAll(undefined)
    for (const o of allOpts()) expect(o.enabled).toBe(false)
  })

  it('🔴 la lista conserva la página anterior mientras llega la nueva (búsqueda en la clave) y es una consulta pesada', () => {
    renderHook(() => useGiftCardList('v1', FILTROS), { wrapper })
    const o = mockUseInfiniteQuery.mock.calls[0][0] as Opts
    expect(o.queryKey).toEqual(giftCardKeys.list('v1', FILTROS))
    expect(o.placeholderData).toBe(keepPreviousData)
    expect(o).toMatchObject({ staleTime: 30_000, retry: 1, refetchOnWindowFocus: false })
    expect(o.getNextPageParam!({ page: 1, pageSize: GIFT_CARDS_PAGE_SIZE, total: 51 })).toBe(2)
    expect(o.getNextPageParam!({ page: 2, pageSize: GIFT_CARDS_PAGE_SIZE, total: 100 })).toBeUndefined()
  })

  it('el detalle no corre sin una tarjeta abierta y pagina con el cursor del server', () => {
    renderHook(() => useGiftCardDetail('v1', null), { wrapper })
    const cerrado = mockUseInfiniteQuery.mock.calls[0][0] as Opts
    expect(cerrado.enabled).toBe(false)
    renderHook(() => useGiftCardDetail('v1', 'g1'), { wrapper })
    const abierto = mockUseInfiniteQuery.mock.calls[1][0] as Opts
    expect(abierto.queryKey).toEqual(giftCardKeys.detail('v1', 'g1'))
    expect(abierto.getNextPageParam!({ activities: { nextCursor: 'c-2' } })).toBe('c-2')
    expect(abierto.getNextPageParam!({ activities: { nextCursor: null } })).toBeUndefined()
  })

  it('los reportes cuelgan de [gift-cards, venueId, reports] y no corren sin fechas', () => {
    renderHook(() => useGiftCardSummary('v1', '', ''), { wrapper })
    const o = mockUseQuery.mock.calls[0][0] as Opts
    expect(o.enabled).toBe(false)
    expect(o.queryKey.slice(0, 3)).toEqual(['gift-cards', 'v1', 'reports'])
    expect(giftCardKeys.aging('v1', '2026-10-14').slice(0, 3)).toEqual(['gift-cards', 'v1', 'reports'])
    expect(giftCardKeys.pending('v1', 'a', 'b').slice(0, 3)).toEqual(['gift-cards', 'v1', 'reports'])
  })
})

// D6 r1 (M2): mientras llegan los permisos `can()` da false y la consulta queda apagada SIN datos; en TanStack v5 eso no es
// «cargando» ni «error», y las pantallas caían un instante en «no se pudo cargar» o «aún no hay». El hook lo cuenta como
// cargando, así todas las pantallas del módulo lo heredan.
describe('use-gift-cards: permisos todavía cargando', () => {
  const todas = () =>
    renderHook(
      () => [
        useGiftCardSettings('v1'),
        useGiftCardList('v1', FILTROS),
        useGiftCardDetail('v1', 'g1'),
        useGiftCardSummary('v1', '2026-10-01', '2026-10-14'),
        useGiftCardAging('v1', '2026-10-14'),
        useGiftCardPendingAccounting('v1', '2026-10-01', '2026-10-14'),
      ],
      { wrapper },
    ).result.current

  it('ninguna corre y TODAS dicen «cargando»', () => {
    access.allowed = []
    access.loading = true
    const resultados = todas()
    for (const o of allOpts()) expect(o.enabled).toBe(false)
    expect(resultados).toHaveLength(6)
    for (const q of resultados) expect(q.isLoading).toBe(true)
  })

  it('ya cargados, cada una dice el estado de su consulta', () => {
    for (const q of todas()) expect(q.isLoading).toBe(false)
  })

  it('con datos ya en caché no se tapan con «cargando»', () => {
    access.loading = true
    mockUseQuery.mockReturnValue({ data: { enabled: true }, isLoading: false })
    mockUseInfiniteQuery.mockReturnValue({ data: { pages: [], pageParams: [] }, isLoading: false })
    for (const q of todas()) expect(q.isLoading).toBe(false)
  })
})

describe('use-gift-cards: invalidación (sólo lo que LEE lo que cambió)', () => {
  const invalidadas = async (change: Parameters<ReturnType<typeof useInvalidateGiftCards>>[1]) => {
    const spy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useInvalidateGiftCards(), { wrapper })
    await result.current('v1', change)
    return spy.mock.calls.map(c => (c[0] as { queryKey: unknown[] }).queryKey)
  }

  it('ajustes ⇒ los ajustes y los tipos de pago (prender crea el tender de sistema)', async () => {
    expect(await invalidadas({ kind: 'settings' })).toEqual([giftCardKeys.settings('v1'), ['tender-types', 'v1']])
  })
  it('una tarjeta ⇒ la lista, SU detalle y los reportes', async () => {
    expect(await invalidadas({ kind: 'card', giftCardId: 'g1' })).toEqual([
      giftCardKeys.listAll('v1'),
      giftCardKeys.detail('v1', 'g1'),
      giftCardKeys.reportsAll('v1'),
    ])
  })
  it('una venta (varias tarjetas) ⇒ la lista, todos los detalles y los reportes', async () => {
    expect(await invalidadas({ kind: 'sale' })).toEqual([
      giftCardKeys.listAll('v1'),
      giftCardKeys.detailAll('v1'),
      giftCardKeys.reportsAll('v1'),
    ])
  })
  it('las claves de lista y detalle son prefijos de las que leen las pantallas', () => {
    expect(giftCardKeys.list('v1', FILTROS).slice(0, 3)).toEqual(giftCardKeys.listAll('v1'))
    expect(giftCardKeys.detail('v1', 'g1').slice(0, 3)).toEqual(giftCardKeys.detailAll('v1'))
  })
})
