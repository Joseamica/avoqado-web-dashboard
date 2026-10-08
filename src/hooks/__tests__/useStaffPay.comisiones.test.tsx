// E6a-fix F2 (Codex bloque E #2): lo que cambia «Pagado» o `staffPayActive` en pago al personal refresca también las
// estadísticas de Comisiones. Sin esto, Comisiones decía «Pagado $0» dos minutos después de marcar pagado un recibo.
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCommissionStats } from '../useCommissions'
import { useActivateSede, useActivateStaffPay, useDeactivateSede, useMarkPaid } from '../useStaffPay'

const m = vi.hoisted(() => ({ venueId: 'v1', stats: vi.fn(), markPaid: vi.fn(), activate: vi.fn(), activateSede: vi.fn(), deactivateSede: vi.fn() }))
vi.mock('../use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: m.venueId }) }))
vi.mock('@/services/commission.service', () => ({ commissionService: { getStats: (...a: unknown[]) => m.stats(...a) } }))
vi.mock('@/services/staffPay.service', () => ({
  staffPayService: {
    markPaid: (...a: unknown[]) => m.markPaid(...a),
    activate: (...a: unknown[]) => m.activate(...a),
    activateSede: (...a: unknown[]) => m.activateSede(...a),
    deactivateSede: (...a: unknown[]) => m.deactivateSede(...a),
  },
}))

const stats = (totalPaid: number, staffPayActive = true) => ({ totalPaid, staffPayActive, totalPending: 0, totalApproved: 0, staffWithCommissions: 0, averageCommission: 0 })

/** UN cliente real por prueba, compartido por las dos pantallas (Comisiones y pago al personal). */
function montar<R>(usar: () => R) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
  return { cliente, ...renderHook(() => ({ stats: useCommissionStats(), accion: usar() }), { wrapper }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  m.venueId = 'v1'
})

describe('pago al personal refresca las estadísticas de Comisiones', () => {
  it('🔴 marcar pagado: «Pagado» pasa de $0 a $100 sin esperar los 2 minutos de frescura', async () => {
    m.stats.mockResolvedValueOnce(stats(0)).mockResolvedValue(stats(100))
    m.markPaid.mockResolvedValue({ marcados: 1 })
    const { result } = montar(() => useMarkPaid('p1'))
    await waitFor(() => expect(result.current.stats.data?.totalPaid).toBe(0))
    await act(() => result.current.accion.mutateAsync({ staffId: 's1' }))
    await waitFor(() => expect(result.current.stats.data?.totalPaid).toBe(100))
    expect(m.stats).toHaveBeenCalledTimes(2)
  })

  it('🔴 marcar pagado sin respuesta (pudo haberse marcado) también refresca Comisiones', async () => {
    m.stats.mockResolvedValueOnce(stats(0)).mockResolvedValue(stats(100))
    m.markPaid.mockRejectedValue(new Error('Network Error'))
    const { result } = montar(() => useMarkPaid('p1'))
    await waitFor(() => expect(result.current.stats.data?.totalPaid).toBe(0))
    await act(() => result.current.accion.mutateAsync({ staffId: 's1' }).catch(() => undefined))
    await waitFor(() => expect(result.current.stats.data?.totalPaid).toBe(100))
  })

  it('🔴 activar pago al personal: el aviso de Comisiones deja de decir «sin pago al personal»', async () => {
    m.stats.mockResolvedValueOnce(stats(0, false)).mockResolvedValue(stats(0, true))
    m.activate.mockResolvedValue({ startDate: '2026-10-01', yaActivado: false })
    const { result } = montar(() => useActivateStaffPay())
    await waitFor(() => expect(result.current.stats.data?.staffPayActive).toBe(false))
    await act(() => result.current.accion.mutateAsync({ periodicidad: 'MONTHLY', inicioEsperado: '2026-10-01', sedes: ['v1'] }))
    await waitFor(() => expect(result.current.stats.data?.staffPayActive).toBe(true))
  })

  it('🔴 activar sin respuesta (pudo haberse activado, el servidor es idempotente) también refresca Comisiones', async () => {
    m.stats.mockResolvedValueOnce(stats(0, false)).mockResolvedValue(stats(0, true))
    m.activate.mockRejectedValue(new Error('Network Error'))
    const { result } = montar(() => useActivateStaffPay())
    await waitFor(() => expect(result.current.stats.data?.staffPayActive).toBe(false))
    await act(() => result.current.accion.mutateAsync({ periodicidad: 'MONTHLY', inicioEsperado: '2026-10-01' }).catch(() => undefined))
    await waitFor(() => expect(result.current.stats.data?.staffPayActive).toBe(true))
  })

  it('un rechazo CON respuesta (409, nada cambió) no pide otra vez las estadísticas', async () => {
    m.stats.mockResolvedValue(stats(0, false))
    m.activate.mockRejectedValue({ response: { status: 409, data: { code: 'PERIODICIDAD_FIJA' } } })
    const { result } = montar(() => useActivateStaffPay())
    await waitFor(() => expect(result.current.stats.data).toBeDefined())
    await act(() => result.current.accion.mutateAsync({ periodicidad: 'MONTHLY', inicioEsperado: '2026-10-01' }).catch(() => undefined))
    await new Promise(r => setTimeout(r, 20))
    expect(m.stats).toHaveBeenCalledTimes(1)
  })

  it('🔴 activar o desactivar una sede refresca las estadísticas de TODAS las sedes (la otra sede también)', async () => {
    m.stats.mockResolvedValue(stats(0, true))
    m.activateSede.mockResolvedValue({ ventana: { desde: '2026-10-01', hasta: null } })
    m.deactivateSede.mockResolvedValue({ ventana: { desde: '2026-09-01', hasta: '2026-09-30' } })
    const { result, cliente } = montar(() => ({ activar: useActivateSede(), desactivar: useDeactivateSede() }))
    await waitFor(() => expect(result.current.stats.data).toBeDefined())
    // Las estadísticas de OTRA sede (v2), en caché desde que se visitó: también dependen de su ventana.
    cliente.setQueryData(['commissions', 'stats', 'v2'], stats(0, false))
    await act(() => result.current.accion.activar.mutateAsync({ sedeId: 'v2', desde: '2026-10-01', fechaEsperada: '2026-10-07' }))
    expect(cliente.getQueryState(['commissions', 'stats', 'v2'])?.isInvalidated).toBe(true)
    await waitFor(() => expect(m.stats).toHaveBeenCalledTimes(2))
    cliente.setQueryData(['commissions', 'stats', 'v2'], stats(0, true))
    await act(() => result.current.accion.desactivar.mutateAsync({ sedeId: 'v2', hasta: '2026-09-30', fechaEsperada: '2026-10-07' }))
    expect(cliente.getQueryState(['commissions', 'stats', 'v2'])?.isInvalidated).toBe(true)
    await waitFor(() => expect(m.stats).toHaveBeenCalledTimes(3))
  })
})
