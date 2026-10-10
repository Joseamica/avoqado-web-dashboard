/**
 * Cableado de los dos hooks que SONDEAN (C7-M(3)). Las funciones puras (`intervaloDelResumen`, `anotarTanda`, `siguienteTanda`…)
 * ya tienen sus pruebas; aquí se prueba que los hooks las USAN bien, con relojes falsos y un QueryClient de verdad:
 * - `conError` sale del estado de la consulta (tras un fallo se espacia a 30 s);
 * - `enabled` y `refetchInterval` dependen de `activo` / del resumen (sin permiso, sin plan o sin `vivo`, no se pregunta);
 * - la `queryFn` de los envíos pasa por `anotarTanda` (un id que el server ya no devuelve queda sin envío y no se vuelve a preguntar).
 */
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const access = vi.hoisted(() => ({ allowed: [] as string[] }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => access.allowed.includes(p) }) }))
const svc = vi.hoisted(() => ({
  getShopifyOverview: vi.fn(),
  getShopifyReviewEnvios: vi.fn(),
  getShopifyConnectReview: vi.fn(),
  getShopifyLocations: vi.fn(),
  listShopifyIssues: vi.fn(),
  listShopifyReviews: vi.fn(),
}))
vi.mock('@/services/shopify.service', () => svc)

import { SHOPIFY_ERROR_MS, SHOPIFY_PROGRESS_MS, useShopifyEnviosEnCamino, useShopifyOverview, type FilaCargada } from '@/hooks/use-shopify'
import type { ShopifyConnection, ShopifyOverview, ShopifyReview } from '@/types/shopify'

const conexion = (o: Partial<ShopifyConnection> = {}): ShopifyConnection => ({
  fase: 'ACTIVE',
  pausedFrom: null,
  estado: 'ACTIVA',
  shopDomain: 'x.myshopify.com',
  locationName: 'Tienda',
  importacion: { variantes: 0, error: null },
  aplicacion: null,
  conteos: { emparejados: 1, pendientes: 0, atorados: 0, inciertos: 0, porRevisar: 0, sinPareja: 0 },
  retrasoMin: null,
  cuadre: { pendiente: true, ultimo: null },
  proximoIntento: null,
  ...o,
})
const resumen = (c: ShopifyConnection | null, planActive = true): ShopifyOverview => ({ planActive, connection: c })

function crearWrapper() {
  // `retryDelay` corto: los hooks piden `retry: 1` y el reintento no debe comerse el reloj de la prueba.
  const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 1 } } })
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children)
  return { client, wrapper }
}
const avanzar = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  access.allowed = ['inventory:read']
})
afterEach(() => {
  vi.useRealTimers()
})

describe('useShopifyOverview — el sondeo del resumen', () => {
  it('🔴 con un cuadre pedido se vuelve a pedir cada 5 s, ni antes ni sólo una vez', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion()))
    const { wrapper } = crearWrapper()
    renderHook(() => useShopifyOverview('v1'), { wrapper })
    await avanzar(0)
    expect(svc.getShopifyOverview).toHaveBeenCalledTimes(1)
    await avanzar(SHOPIFY_PROGRESS_MS - 100)
    expect(svc.getShopifyOverview).toHaveBeenCalledTimes(1)
    await avanzar(200)
    expect(svc.getShopifyOverview).toHaveBeenCalledTimes(2)
    await avanzar(SHOPIFY_PROGRESS_MS)
    expect(svc.getShopifyOverview).toHaveBeenCalledTimes(3)
  })

  it('🔴 `conError` sale del estado de la consulta: tras un fallo se espacia a 30 s (sin tormenta de reintentos)', async () => {
    svc.getShopifyOverview.mockResolvedValueOnce(resumen(conexion())).mockRejectedValue(new Error('Network Error'))
    const { wrapper } = crearWrapper()
    renderHook(() => useShopifyOverview('v1'), { wrapper })
    await avanzar(0)
    await avanzar(SHOPIFY_PROGRESS_MS + 100) // la vuelta de los 5 s falla (y su único reintento)
    const tras = svc.getShopifyOverview.mock.calls.length
    expect(tras).toBeGreaterThanOrEqual(2)
    await avanzar(SHOPIFY_ERROR_MS - 2_000) // a los 5 s ya NO vuelve a preguntar: espera los 30 s
    expect(svc.getShopifyOverview).toHaveBeenCalledTimes(tras)
    await avanzar(4_000)
    expect(svc.getShopifyOverview.mock.calls.length).toBeGreaterThan(tras)
  })

  it.each<[string, ShopifyOverview]>([
    ['el plan está inactivo', resumen(conexion(), false)],
    ['la conexión está pausada', resumen(conexion({ fase: 'PAUSED', pausedFrom: 'ACTIVE', estado: 'PAUSADA' }))],
    ['Shopify retiró el permiso (detenida)', resumen(conexion({ estado: 'REVOCADA' }))],
    ['no hay nada en curso', resumen(conexion({ cuadre: { pendiente: false, ultimo: null } }))],
  ])('🔴 el `refetchInterval` recibe el resumen: si %s, no se sondea', async (_caso, o) => {
    svc.getShopifyOverview.mockResolvedValue(o)
    const { wrapper } = crearWrapper()
    renderHook(() => useShopifyOverview('v1'), { wrapper })
    await avanzar(0)
    await avanzar(60_000)
    expect(svc.getShopifyOverview).toHaveBeenCalledTimes(1)
  })

  it('🔴 `enabled`: sin `inventory:read` o sin sucursal no se pregunta nada', async () => {
    svc.getShopifyOverview.mockResolvedValue(resumen(conexion()))
    access.allowed = []
    const { wrapper } = crearWrapper()
    renderHook(() => useShopifyOverview('v1'), { wrapper })
    renderHook(() => useShopifyOverview(undefined), { wrapper })
    await avanzar(20_000)
    expect(svc.getShopifyOverview).not.toHaveBeenCalled()
  })
})

const revision = (id: string, envio: ShopifyReview['envio']): ShopifyReview => ({
  id,
  status: 'RESOLVED',
  reason: 'DIFERENCIA',
  avoqadoQty: '1',
  shopifyQty: 1,
  atorados: 0,
  suggestion: 'AVOQADO',
  choice: 'AVOQADO',
  envio,
  createdAt: '2026-10-08T12:00:00.000Z',
  product: { id: `p-${id}`, name: id, sku: null },
})
// Memoizadas A PROPÓSITO (el hook pide `filas` estables): un arreglo nuevo por render rehacería la fusión en cada vuelta.
const FILAS: FilaCargada[] = [
  { item: revision('r1', 'PENDIENTE'), at: 0 },
  { item: revision('r2', 'PENDIENTE'), at: 0 },
]
const envios = (...xs: Array<[string, ShopifyReview['envio'] & string]>) => ({
  items: xs.map(([id, envio]) => ({ id, status: 'RESOLVED' as const, choice: 'AVOQADO' as const, envio })),
})

describe('useShopifyEnviosEnCamino — el sondeo acotado de las elecciones en camino', () => {
  it('🔴 pregunta por las que siguen en camino cada 5 s, funde lo contestado y se detiene cuando ya no queda ninguna', async () => {
    svc.getShopifyReviewEnvios
      .mockResolvedValueOnce(envios(['r1', 'ENVIADO'], ['r2', 'PENDIENTE']))
      .mockResolvedValueOnce(envios(['r2', 'ENVIADO']))
    const { wrapper } = crearWrapper()
    const { result } = renderHook(() => useShopifyEnviosEnCamino('v1', FILAS, true), { wrapper })
    await avanzar(0)
    expect(svc.getShopifyReviewEnvios).toHaveBeenLastCalledWith('v1', ['r1', 'r2'])
    expect(result.current.map(i => i.envio)).toEqual(['ENVIADO', 'PENDIENTE'])
    await avanzar(SHOPIFY_PROGRESS_MS + 100)
    // La segunda vuelta pregunta SÓLO por la que sigue en camino (el estado se elige sobre lo ya observado).
    expect(svc.getShopifyReviewEnvios).toHaveBeenLastCalledWith('v1', ['r2'])
    expect(result.current.map(i => i.envio)).toEqual(['ENVIADO', 'ENVIADO'])
    await avanzar(30_000)
    expect(svc.getShopifyReviewEnvios).toHaveBeenCalledTimes(2)
  })

  it('🔴 `activo` depende de `vivo`: con la conexión que no avanza no se pregunta; al volver a avanzar, sí', async () => {
    svc.getShopifyReviewEnvios.mockResolvedValue(envios(['r1', 'PENDIENTE'], ['r2', 'PENDIENTE']))
    const { wrapper } = crearWrapper()
    const { rerender } = renderHook(({ vivo }) => useShopifyEnviosEnCamino('v1', FILAS, vivo), { wrapper, initialProps: { vivo: false } })
    await avanzar(20_000)
    expect(svc.getShopifyReviewEnvios).not.toHaveBeenCalled()
    rerender({ vivo: true })
    await avanzar(0)
    expect(svc.getShopifyReviewEnvios).toHaveBeenCalledTimes(1)
  })

  it('🔴 sin `inventory:read` no se pregunta nada, aunque haya filas en camino', async () => {
    access.allowed = []
    svc.getShopifyReviewEnvios.mockResolvedValue(envios(['r1', 'ENVIADO'], ['r2', 'ENVIADO']))
    const { wrapper } = crearWrapper()
    renderHook(() => useShopifyEnviosEnCamino('v1', FILAS, true), { wrapper })
    await avanzar(20_000)
    expect(svc.getShopifyReviewEnvios).not.toHaveBeenCalled()
  })

  it('🔴 la `queryFn` pasa por `anotarTanda`: un id que el server ya no devuelve queda SIN envío (nunca «llegó») y no se vuelve a preguntar', async () => {
    svc.getShopifyReviewEnvios.mockResolvedValue(envios(['r1', 'ENVIADO'])) // r2 desapareció (purgada o de otra sucursal)
    const { wrapper } = crearWrapper()
    const { result } = renderHook(() => useShopifyEnviosEnCamino('v1', FILAS, true), { wrapper })
    await avanzar(0)
    expect(result.current.map(i => i.envio)).toEqual(['ENVIADO', null])
    expect(result.current[1].choice).toBe('AVOQADO') // conserva lo que eligió
    await avanzar(30_000)
    expect(svc.getShopifyReviewEnvios).toHaveBeenCalledTimes(1)
  })

  it('🔴 `conError` sale del estado de la consulta: tras un fallo se pregunta cada 30 s, no cada 5', async () => {
    svc.getShopifyReviewEnvios.mockRejectedValue(new Error('Network Error'))
    const { wrapper } = crearWrapper()
    renderHook(() => useShopifyEnviosEnCamino('v1', FILAS, true), { wrapper })
    await avanzar(50) // la petición y su único reintento (retryDelay 1 ms)
    const tras = svc.getShopifyReviewEnvios.mock.calls.length
    expect(tras).toBe(2)
    await avanzar(SHOPIFY_ERROR_MS - 2_000)
    expect(svc.getShopifyReviewEnvios).toHaveBeenCalledTimes(tras)
    await avanzar(4_000)
    expect(svc.getShopifyReviewEnvios.mock.calls.length).toBeGreaterThan(tras)
  })
})
