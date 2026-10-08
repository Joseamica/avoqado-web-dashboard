import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }))
vi.mock('@/api', () => ({ default: m }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
import { staffPayService } from '../staffPay.service'
import { useAdjustmentPreview, useStaffPaySedes } from '@/hooks/useStaffPay'

const base = '/api/v1/dashboard/venues/v1/staff-pay'
beforeEach(() => vi.clearAllMocks())

describe('staffPayService — fase 3 (activación, propinas, sedes)', () => {
  it('activar manda periodicidad, inicioEsperado y la lista explícita de sedes', async () => {
    m.post.mockResolvedValue({ data: { startDate: '2026-10-01', yaActivado: false } })
    await staffPayService.activate('v1', { periodicidad: 'MONTHLY', inicioEsperado: '2026-10-01', sedes: ['s1'] })
    expect(m.post).toHaveBeenCalledWith(`${base}/activate`, { periodicidad: 'MONTHLY', inicioEsperado: '2026-10-01', sedes: ['s1'] })
  })
  it('propinas: PUT /tips con { encender }', async () => {
    m.put.mockResolvedValue({ data: { encendidas: true } })
    await staffPayService.setTips('v1', true)
    expect(m.put).toHaveBeenCalledWith(`${base}/tips`, { encender: true })
  })
  it('acceso trae periodicidad y si ya es fija (E1d)', async () => {
    m.get.mockResolvedValue({ data: { enabled: true, activado: false, startDate: null, propinasEncendidas: false, periodicidad: 'SEMIMONTHLY', periodicidadFija: true } })
    const a = await staffPayService.access('v1')
    expect(m.get).toHaveBeenCalledWith(`${base}/access`)
    expect(a.periodicidad).toBe('SEMIMONTHLY')
  })
  it('useStaffPaySedes pide GET /sedes y respeta enabled', async () => {
    m.get.mockResolvedValue({ data: { activado: false, startDate: null, periodo: null, sedes: [] } })
    const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }, children)
    const off = renderHook(() => useStaffPaySedes(false), { wrapper })
    await new Promise(r => setTimeout(r, 0))
    expect(m.get).not.toHaveBeenCalled()
    off.unmount()
    const { result } = renderHook(() => useStaffPaySedes(), { wrapper })
    await waitFor(() => expect(result.current.data?.sedes).toEqual([]))
    expect(m.get).toHaveBeenCalledWith(`${base}/sedes`)
  })
})

describe('vista previa del ajuste manual (B13, E5a)', () => {
  const Q = { sede: 's1', staffId: 'a', amount: -150, reason: 'Llegó tarde', fecha: '2026-10-01' }
  const envoltura = (qc: QueryClient) => ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children)
  it('GET /adjustments/preview con lo que se guardaría, como parámetros', async () => {
    m.get.mockResolvedValue({ data: { avisoPendientes: { n: 0 } } })
    await staffPayService.adjustmentPreview('v1', Q)
    expect(m.get).toHaveBeenCalledWith(`${base}/adjustments/preview`, { params: Q })
  })
  it('el hook no pide nada sin formulario completo ni apagado; con él, UNA vez tras la pausa de 300 ms aunque se teclee', async () => {
    m.get.mockResolvedValue({ data: { staffId: 'a', avisoPendientes: { n: 0, total: '0.00', porDestino: [], items: [], truncado: false } } })
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { rerender, result } = renderHook(({ q, on }: { q: typeof Q | null; on: boolean }) => useAdjustmentPreview(q, on), {
      wrapper: envoltura(qc),
      initialProps: { q: null as typeof Q | null, on: true },
    })
    rerender({ q: Q, on: false })
    await new Promise(r => setTimeout(r, 400))
    expect(m.get).not.toHaveBeenCalled()
    // Teclear el motivo letra por letra: una sola consulta, con el último valor.
    rerender({ q: { ...Q, reason: 'Llegó' }, on: true })
    rerender({ q: { ...Q, reason: 'Llegó ta' }, on: true })
    rerender({ q: Q, on: true })
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(m.get).toHaveBeenCalledTimes(1)
    expect(m.get).toHaveBeenCalledWith(`${base}/adjustments/preview`, { params: Q })
  })
  it('un 4xx no se reintenta (es determinista: sin permiso, motivo corto…)', async () => {
    m.get.mockRejectedValue({ response: { status: 403, data: { message: 'Sin permiso' } } })
    const qc = new QueryClient() // reintentos de fábrica: el hook decide
    const { result } = renderHook(() => useAdjustmentPreview(Q), { wrapper: envoltura(qc) })
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 3000 })
    expect(m.get).toHaveBeenCalledTimes(1)
  })
})
