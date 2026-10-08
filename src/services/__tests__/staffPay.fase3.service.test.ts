import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }))
vi.mock('@/api', () => ({ default: m }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
import { staffPayService } from '../staffPay.service'
import { useStaffPaySedes } from '@/hooks/useStaffPay'

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
