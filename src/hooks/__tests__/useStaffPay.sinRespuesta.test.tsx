// E6a-fix2 D1 y C4 (full-testing E6a): sin respuesta, el ajuste o el cierre pudieron haberse aplicado en el servidor. El periodo
// se vuelve a leer, como en el éxito: la tabla dice cómo quedó. Con un rechazo con desenlace (4xx) nada cambió: no se relee.
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAddAdjustment, useClosePeriod, useStaffPayReport } from '../useStaffPay'

const m = vi.hoisted(() => ({ report: vi.fn(), add: vi.fn(), close: vi.fn() }))
vi.mock('../use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/services/staffPay.service', () => ({
  staffPayService: {
    report: (...a: unknown[]) => m.report(...a),
    addAdjustment: (...a: unknown[]) => m.add(...a),
    close: (...a: unknown[]) => m.close(...a),
  },
}))

function montar<R>(usar: () => R) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
  return renderHook(() => ({ periodo: useStaffPayReport({ offset: 0, limit: 50 }), accion: usar() }), { wrapper })
}
const ajuste = { staffId: 's1', sede: 'v1', amount: 25, reason: 'Bono', fecha: '2026-10-08', clientKey: 'clave-0001' }

beforeEach(() => {
  vi.clearAllMocks()
  m.report.mockResolvedValue({ periodo: { estado: 'OPEN' } })
})

describe('sin respuesta, el periodo se vuelve a leer', () => {
  it('🔴 un ajuste sin respuesta (pudo guardarse) relee el periodo', async () => {
    m.add.mockRejectedValue(new Error('Network Error'))
    const { result } = montar(() => useAddAdjustment())
    await waitFor(() => expect(result.current.periodo.data).toBeDefined())
    await act(() => result.current.accion.mutateAsync(ajuste).catch(() => undefined))
    await waitFor(() => expect(m.report).toHaveBeenCalledTimes(2))
  })

  it('🔴 un ajuste con 502 (un proxy pudo cortar después de guardar) también relee', async () => {
    m.add.mockRejectedValue({ response: { status: 502 } })
    const { result } = montar(() => useAddAdjustment())
    await waitFor(() => expect(result.current.periodo.data).toBeDefined())
    await act(() => result.current.accion.mutateAsync(ajuste).catch(() => undefined))
    await waitFor(() => expect(m.report).toHaveBeenCalledTimes(2))
  })

  it('un rechazo con desenlace (409, nada cambió) no relee', async () => {
    m.add.mockRejectedValue({ response: { status: 409, data: { code: 'PERIODO_CERRADO' } } })
    m.close.mockRejectedValue({ response: { status: 409, data: { code: 'HUELLA_CAMBIO' } } })
    const a = montar(() => useAddAdjustment())
    await waitFor(() => expect(a.result.current.periodo.data).toBeDefined())
    await act(() => a.result.current.accion.mutateAsync(ajuste).catch(() => undefined))
    const c = montar(() => useClosePeriod())
    await waitFor(() => expect(c.result.current.periodo.data).toBeDefined())
    await act(() => c.result.current.accion.mutateAsync({ fecha: '2026-09-01', huellaEsperada: 'h', confirmarHuerfanas: false }).catch(() => undefined))
    await new Promise(r => setTimeout(r, 20))
    expect(m.report).toHaveBeenCalledTimes(2)
  })
})
