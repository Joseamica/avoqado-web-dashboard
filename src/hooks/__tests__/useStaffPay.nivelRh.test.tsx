// RH 1a (Codex r1 #4): asignar el nivel de pago de clase a una persona refresca TAMBIÉN «Cómo se le paga hoy» de RH
// (`['rh', sede, 'pay-overview', persona]`). Vive en otra llave que `staff-pay`: sin esto la ficha decía dos niveles distintos.
// El nivel es de la organización: se refresca esa persona en TODAS las sedes, y sólo ella.
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { rhKeys } from '../useRh'
import { staffPayKeys, useAssignLevel, useUpdateLevel } from '../useStaffPay'

const m = vi.hoisted(() => ({ assign: vi.fn(), updateLevel: vi.fn() }))
vi.mock('../use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/services/staffPay.service', () => ({ staffPayService: { assign: (...a: unknown[]) => m.assign(...a), updateLevel: (...a: unknown[]) => m.updateLevel(...a) } }))

function montar<R>(usar: () => R) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
  // Lo que esas pantallas tendrían en caché.
  cliente.setQueryData(staffPayKeys.assignments('v1'), [])
  cliente.setQueryData(rhKeys.payOverview('v1', 's1'), { comisiones: [] })
  cliente.setQueryData(rhKeys.payOverview('v2', 's1'), { comisiones: [] }) // la MISMA persona en otra sede
  cliente.setQueryData(rhKeys.payOverview('v1', 's2'), { comisiones: [] }) // OTRA persona
  cliente.setQueryData(rhKeys.positions('v1', {}), { data: [], total: 0, hasMore: false })
  return { cliente, ...renderHook(usar, { wrapper }) }
}
const invalidada = (c: QueryClient, k: readonly unknown[]) => c.getQueryState(k)?.isInvalidated

beforeEach(() => {
  vi.clearAllMocks()
})

describe('asignar nivel de pago refresca la ficha de RH', () => {
  it('🔴 refresca «Cómo se le paga hoy» de ESA persona en todas las sedes (y lo de pago al personal), y nada más', async () => {
    m.assign.mockResolvedValue({})
    const { result, cliente } = montar(() => useAssignLevel())
    await act(() => result.current.mutateAsync({ staffId: 's1', payLevelId: 'nivel-b', effectiveFrom: '2026-10-12' }))
    await waitFor(() => expect(invalidada(cliente, rhKeys.payOverview('v1', 's1'))).toBe(true))
    expect(invalidada(cliente, rhKeys.payOverview('v2', 's1'))).toBe(true)
    expect(invalidada(cliente, staffPayKeys.assignments('v1'))).toBe(true)
    expect(invalidada(cliente, rhKeys.payOverview('v1', 's2'))).toBe(false)
    expect(invalidada(cliente, rhKeys.positions('v1', {}))).toBe(false)
  })

  it('la vista previa («cambia el pago de N clases») no escribe: no refresca nada', async () => {
    m.assign.mockResolvedValue({})
    const { result, cliente } = montar(() => useAssignLevel(true))
    await act(() => result.current.mutateAsync({ staffId: 's1', payLevelId: 'nivel-b', effectiveFrom: '2026-10-12', simular: true }))
    await act(() => new Promise(r => setTimeout(r, 20)))
    expect(invalidada(cliente, rhKeys.payOverview('v1', 's1'))).toBe(false)
    expect(invalidada(cliente, staffPayKeys.assignments('v1'))).toBe(false)
  })

  it('si el servidor rechaza, no refresca (nada cambió)', async () => {
    m.assign.mockRejectedValue({ response: { status: 400, data: { message: 'Fecha fuera de rango.' } } })
    const { result, cliente } = montar(() => useAssignLevel())
    await act(() => result.current.mutateAsync({ staffId: 's1', payLevelId: 'nivel-b', effectiveFrom: '2026-10-12' }).catch(() => undefined))
    await act(() => new Promise(r => setTimeout(r, 20)))
    expect(invalidada(cliente, rhKeys.payOverview('v1', 's1'))).toBe(false)
  })
})

describe('renombrar o archivar un nivel refresca la ficha de RH', () => {
  it('🔴 todos los «Cómo se le paga hoy» abiertos (de cualquier persona y sede) se vuelven a pedir; las demás pantallas de RH no', async () => {
    m.updateLevel.mockResolvedValue({})
    const { result, cliente } = montar(() => useUpdateLevel())
    await act(() => result.current.mutateAsync({ levelId: 'nivel-a', name: 'Nivel A+' }))
    await waitFor(() => expect(invalidada(cliente, rhKeys.payOverview('v1', 's1'))).toBe(true))
    expect(invalidada(cliente, rhKeys.payOverview('v2', 's1'))).toBe(true)
    expect(invalidada(cliente, rhKeys.payOverview('v1', 's2'))).toBe(true)
    expect(invalidada(cliente, staffPayKeys.assignments('v1'))).toBe(true)
    expect(invalidada(cliente, rhKeys.positions('v1', {}))).toBe(false)
  })
})
