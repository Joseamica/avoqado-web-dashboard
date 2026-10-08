import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }))
vi.mock('@/api', () => ({ default: m }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
import { staffPayService } from '../staffPay.service'
import { useActivateSede, useDeactivateSede, useParticipationPreview, useStaffPaySedes } from '@/hooks/useStaffPay'

const base = '/api/v1/dashboard/venues/v1/staff-pay'
const cliente = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
const envoltura = (qc: QueryClient) => ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children)
const SEDES = { activado: true, startDate: '2026-10-01', periodo: null, sedes: [] }
beforeEach(() => vi.clearAllMocks())

describe('staffPayService — activar y desactivar UNA sede (B11)', () => {
  it('vista previa: sin fecha sólo manda la acción (el servidor usa «hoy» de la sede); con fecha, ésa', async () => {
    m.get.mockResolvedValue({ data: {} })
    await staffPayService.participationPreview('v1', 's2', 'activar')
    expect(m.get).toHaveBeenLastCalledWith(`${base}/sedes/s2/participation-preview`, { params: { accion: 'activar' } })
    await staffPayService.participationPreview('v1', 's2', 'desactivar', '2026-10-09')
    expect(m.get).toHaveBeenLastCalledWith(`${base}/sedes/s2/participation-preview`, { params: { accion: 'desactivar', fecha: '2026-10-09' } })
  })
  it('activar y desactivar: POST con la fecha y el «hoy» que se vio (fechaEsperada), nada más (schema estricto)', async () => {
    m.post.mockResolvedValue({ data: { ventana: null, minimo: '2026-10-01', minimoEfectivo: '2026-10-01' } })
    await staffPayService.activateSede('v1', 's2', { desde: '2026-10-05', fechaEsperada: '2026-10-20' })
    expect(m.post).toHaveBeenLastCalledWith(`${base}/sedes/s2/activate`, { desde: '2026-10-05', fechaEsperada: '2026-10-20' })
    await staffPayService.deactivateSede('v1', 's2', { hasta: '2026-10-09', fechaEsperada: '2026-10-20' })
    expect(m.post).toHaveBeenLastCalledWith(`${base}/sedes/s2/deactivate`, { hasta: '2026-10-09', fechaEsperada: '2026-10-20' })
  })
})

describe('hooks de sedes', () => {
  it('la vista previa no se pide sin sede y un 4xx no se reintenta (es determinista)', async () => {
    const qc = new QueryClient() // reintentos de fábrica: el hook decide
    m.get.mockRejectedValue({ response: { status: 409, data: { code: 'YA_ACTIVA' } } })
    const sinSede = renderHook(() => useParticipationPreview(null, 'activar'), { wrapper: envoltura(qc) })
    await new Promise(r => setTimeout(r, 0))
    expect(m.get).not.toHaveBeenCalled()
    sinSede.unmount()
    const { result } = renderHook(() => useParticipationPreview('s2', 'activar'), { wrapper: envoltura(qc) })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(m.get).toHaveBeenCalledTimes(1)
  })
  it('activar una sede refresca la lista de sedes', async () => {
    const qc = cliente()
    m.get.mockResolvedValue({ data: SEDES })
    m.post.mockResolvedValue({ data: { ventana: { venueId: 's2', desde: '2026-10-05', hasta: null }, minimo: '2026-10-01', minimoEfectivo: '2026-10-01' } })
    const { result } = renderHook(() => ({ sedes: useStaffPaySedes(), activar: useActivateSede() }), { wrapper: envoltura(qc) })
    await waitFor(() => expect(result.current.sedes.data).toBeDefined())
    expect(m.get).toHaveBeenCalledTimes(1)
    await act(() => result.current.activar.mutateAsync({ sedeId: 's2', desde: '2026-10-05', fechaEsperada: '2026-10-20' }))
    expect(m.get).toHaveBeenCalledTimes(2)
  })
  it('un rechazo 4xx al desactivar también relee la lista (otro la cambió); sin respuesta, relee todo', async () => {
    const qc = cliente()
    m.get.mockResolvedValue({ data: SEDES })
    const { result } = renderHook(() => ({ sedes: useStaffPaySedes(), desactivar: useDeactivateSede() }), { wrapper: envoltura(qc) })
    await waitFor(() => expect(result.current.sedes.data).toBeDefined())
    m.post.mockRejectedValueOnce({ response: { status: 409, data: { code: 'NO_ACTIVA' } } })
    await act(() => result.current.desactivar.mutateAsync({ sedeId: 's2', hasta: '2026-10-09', fechaEsperada: '2026-10-20' }).catch(() => undefined))
    await waitFor(() => expect(m.get).toHaveBeenCalledTimes(2))
    m.post.mockRejectedValueOnce(new Error('Network Error'))
    await act(() => result.current.desactivar.mutateAsync({ sedeId: 's2', hasta: '2026-10-09', fechaEsperada: '2026-10-20' }).catch(() => undefined))
    await waitFor(() => expect(m.get).toHaveBeenCalledTimes(3))
  })
})
