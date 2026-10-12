// RH 1a (Tarea 8): asignar/cambiar/terminar un puesto refresca TODO lo que lo lee — el módulo `['rh', sede]` y la lista del
// equipo `['team-members', sede, …]` (que trae `currentAssignments`) —; y `usePositions` no pide nada sin sede.
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { rhKeys, useAssignPosition, usePositions } from '../useRh'

const m = vi.hoisted(() => ({ venueId: 'v1' as string | null, positions: vi.fn(), assign: vi.fn() }))
vi.mock('../use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: m.venueId }) }))
vi.mock('@/services/rh.service', () => ({
  rhService: { positions: (...a: unknown[]) => m.positions(...a), assign: (...a: unknown[]) => m.assign(...a) },
}))

function montar<R>(usar: () => R) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
  return { cliente, ...renderHook(usar, { wrapper }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  m.venueId = 'v1'
})

describe('RH: capa de datos', () => {
  it('🔴 asignar un puesto invalida [rh, sede] y [team-members, sede] (la lista del equipo lee currentAssignments)', async () => {
    m.assign.mockResolvedValue({ id: 'a1' })
    const { result, cliente } = montar(() => useAssignPosition())
    // Sembramos lo que esas pantallas tendrían en caché: una por llave afectada y una de OTRA sede que no debe tocarse.
    cliente.setQueryData(rhKeys.positions('v1', {}), { data: [], total: 0, hasMore: false })
    cliente.setQueryData(['team-members', 'v1', 0, 20], { data: [] })
    cliente.setQueryData(['team-members', 'v2', 0, 20], { data: [] })
    cliente.setQueryData(rhKeys.positions('v2', {}), { data: [], total: 0, hasMore: false })
    const estado = (k: readonly unknown[]) => cliente.getQueryState(k)?.isInvalidated
    await act(() => result.current.mutateAsync({ staffId: 's1', body: { positionId: 'p1' } }))
    expect(m.assign).toHaveBeenCalledWith('v1', 's1', { positionId: 'p1' })
    await waitFor(() => expect(estado(rhKeys.positions('v1', {}))).toBe(true))
    expect(estado(['team-members', 'v1', 0, 20])).toBe(true)
    expect(estado(['team-members', 'v2', 0, 20])).toBe(false)
    expect(estado(rhKeys.positions('v2', {}))).toBe(false)
  })

  it('usePositions no pide nada sin sede, y con sede manda los filtros tal cual', async () => {
    m.venueId = null
    const sinSede = montar(() => usePositions({ includeArchived: true }))
    await new Promise(r => setTimeout(r, 20))
    expect(m.positions).not.toHaveBeenCalled()
    expect(sinSede.result.current.fetchStatus).toBe('idle')

    m.venueId = 'v1'
    m.positions.mockResolvedValue({ data: [], total: 0, hasMore: false })
    const conSede = montar(() => usePositions({ includeArchived: true, limit: 50, offset: 0 }))
    await waitFor(() => expect(conSede.result.current.data?.total).toBe(0))
    expect(m.positions).toHaveBeenCalledWith('v1', { includeArchived: true, limit: 50, offset: 0 })
  })
})
