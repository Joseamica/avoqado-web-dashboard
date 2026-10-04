import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }))
vi.mock('@/api', () => ({ default: m }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
import { staffPayService } from '../staffPay.service'
import { staffPayKeys, useClassDifference, useDifferences, useSettleDifference } from '@/hooks/useStaffPay'

const base = (v: string) => `/api/v1/dashboard/venues/${v}/staff-pay`
beforeEach(() => vi.clearAllMocks())

function conCliente() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children)
  return { qc, wrapper }
}
const preview = (total: string) => ({
  periodoOrigen: { id: 'p8', start: '2026-08-01', end: '2026-08-31' },
  destino: { start: '2026-10-01', end: '2026-10-31', venueIds: ['v1', 'v2'] },
  sedeEnDestino: true,
  filas: [],
  total,
  bloqueada: false,
  huella: 'h'.repeat(64),
})
const cuerpo = { periodoOrigenId: 'p8', huellaEsperada: 'h'.repeat(64), solicitudId: 'clave-0001' }

describe('staffPayService — diferencias', () => {
  it('la lista va por el periodo, con cursor sólo desde la segunda página', async () => {
    m.get.mockResolvedValue({ data: { items: [], nextCursor: null, parcial: false } })
    await staffPayService.differences('v1', 'p8', { limit: 50 })
    expect(m.get).toHaveBeenLastCalledWith(`${base('v1')}/periods/p8/differences`, { params: { limit: 50 } })
    await staffPayService.differences('v1', 'p8', { cursor: 'v2:c1:a', limit: 50 })
    expect(m.get).toHaveBeenLastCalledWith(`${base('v1')}/periods/p8/differences`, { params: { cursor: 'v2:c1:a', limit: 50 } })
  })
  it('el preview y la liquidación van bajo la sede de la CLASE (Codex R1-18)', async () => {
    m.get.mockResolvedValue({ data: preview('40.00') })
    await staffPayService.classDifference('v2', 'c1')
    expect(m.get).toHaveBeenLastCalledWith(`${base('v2')}/class-sessions/c1/difference`, { params: {} })
    await staffPayService.classDifference('v2', 'c1', '2026-10-03')
    expect(m.get).toHaveBeenLastCalledWith(`${base('v2')}/class-sessions/c1/difference`, { params: { destinoFecha: '2026-10-03' } })
    m.post.mockResolvedValue({ data: { lineas: [], yaLiquidada: false } })
    await staffPayService.settleDifference('v2', 'c1', { ...cuerpo, ampliarAlcance: true })
    expect(m.post).toHaveBeenCalledWith(`${base('v2')}/class-sessions/c1/difference/settle`, { ...cuerpo, ampliarAlcance: true })
  })
})

describe('hooks de diferencias', () => {
  it('la lista avanza por cursor y se detiene cuando el server manda nextCursor null', async () => {
    m.get.mockImplementation(async (_u: string, { params }: { params: { cursor?: string } }) => ({
      data: params.cursor
        ? { items: [{ classSessionId: 'c2' }], nextCursor: null, parcial: false }
        : { items: [{ classSessionId: 'c1' }], nextCursor: 'v1:c1:a', parcial: false },
    }))
    const { result } = renderHook(() => useDifferences('p8'), { wrapper: conCliente().wrapper })
    await waitFor(() => expect(result.current.hasNextPage).toBe(true))
    await act(async () => {
      await result.current.fetchNextPage()
    })
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2))
    expect(result.current.hasNextPage).toBe(false)
    expect(m.get).toHaveBeenLastCalledWith(`${base('v1')}/periods/p8/differences`, { params: { cursor: 'v1:c1:a', limit: 50 } })
  })
  it('la sede de la clase entra en la llave: dos sedes, dos consultas; un 409 no se reintenta', async () => {
    m.get.mockResolvedValue({ data: preview('40.00') })
    const { wrapper } = conCliente()
    renderHook(() => useClassDifference('v1', 'c1'), { wrapper })
    renderHook(() => useClassDifference('v2', 'c1'), { wrapper })
    await waitFor(() => expect(m.get).toHaveBeenCalledTimes(2))
    expect(m.get.mock.calls.map(([u]) => u)).toEqual([
      `${base('v1')}/class-sessions/c1/difference`,
      `${base('v2')}/class-sessions/c1/difference`,
    ])
    m.get.mockReset()
    m.get.mockRejectedValue(Object.assign(new Error('409'), { response: { status: 409, data: { code: 'X' } } }))
    const { result } = renderHook(() => useClassDifference('v3', 'c1'), { wrapper: conCliente().wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(m.get).toHaveBeenCalledTimes(1)
  })
  it('liquidar refresca diferencias, periodos, reporte y la ficha de la clase (de las dos sedes), y nada más', async () => {
    m.post.mockResolvedValue({ data: { lineas: [{ staffId: 'a', amount: '40.00' }], yaLiquidada: false } })
    const { qc, wrapper } = conCliente()
    const inv = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useSettleDifference('v2', 'c1'), { wrapper })
    await act(async () => {
      await result.current.mutateAsync(cuerpo)
    })
    const llaves = inv.mock.calls.map(([f]) => JSON.stringify(f?.queryKey))
    for (const k of [
      staffPayKeys.periods('v1'),
      staffPayKeys.report('v1'),
      staffPayKeys.periods('v2'),
      staffPayKeys.report('v2'),
      staffPayKeys.classPay('v2', 'c1'),
    ]) {
      expect(llaves).toContain(JSON.stringify(k))
    }
    // La lista de diferencias cuelga de `periods`: la cubre su invalidación.
    expect(staffPayKeys.differences('v1', 'p8').slice(0, 3)).toEqual([...staffPayKeys.periods('v1')])
    for (const k of [staffPayKeys.all('v1'), staffPayKeys.levels('v1'), staffPayKeys.tables('v1'), staffPayKeys.access('v1')]) {
      expect(llaves).not.toContain(JSON.stringify(k))
    }
  })
  it('HUELLA_CAMBIO con el preview nuevo lo deja en la caché de la clase, sin otra vuelta al server', async () => {
    const nuevo = preview('90.00')
    m.post.mockRejectedValue(
      Object.assign(new Error('409'), { response: { status: 409, data: { code: 'HUELLA_CAMBIO', details: { preview: nuevo } } } }),
    )
    const { qc, wrapper } = conCliente()
    const { result } = renderHook(() => useSettleDifference('v2', 'c1'), { wrapper })
    await act(async () => {
      await result.current.mutateAsync(cuerpo).catch(() => undefined)
    })
    expect(qc.getQueryData(staffPayKeys.classDifference('v2', 'c1'))).toEqual(nuevo)
    expect(m.get).not.toHaveBeenCalled()
  })
})
