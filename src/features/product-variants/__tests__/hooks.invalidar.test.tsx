/**
 * Ronda final del bloque 2 (Codex C3): tras agrupar, renombrar, separar, archivar o crecer, TODA pantalla que lee nombres o familias de
 * productos de ese negocio se relee — no sólo la lista. Las de otro negocio no se tocan.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { useInvalidarCatalogo } from '../hooks'

const filtros = (venueId: string) => ({ venueId, startDate: '2026-10-01', endDate: '2026-10-15', reportType: 'SUMMARY', groupBy: 'none' })
const lectores = (venueId: string) => ({
  lista: ['products', venueId, 'orderBy:name'],
  familia: ['products', venueId, 'groups', 'detail', 'g1'],
  existencias: ['products', venueId, 'inventory-summary'],
  ficha: ['product', venueId, 'p1'],
  asistente: ['product-detail', venueId, 'p1'],
  ventasPorArticulo: ['salesByItem', 'report', filtros(venueId)],
  masVendidos: ['chart', 'best-selling-products', venueId, '2026-10-01T00:00:00.000Z', '2026-10-15T00:00:00.000Z'],
  ruteo: ['printRouting', venueId, 'products', 'c1', '', 1],
})

describe('useInvalidarCatalogo', () => {
  it('🔴 invalida cada pantalla que lee productos del negocio (reporte, más vendidos, ruteo, ficha, existencias) y no las de otro', async () => {
    const qc = new QueryClient()
    for (const venueId of ['v1', 'v2']) for (const key of Object.values(lectores(venueId))) qc.setQueryData(key, { algo: true })
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    const { result } = renderHook(() => useInvalidarCatalogo(), { wrapper })

    await act(() => result.current('v1'))

    const invalidada = (key: readonly unknown[]) => qc.getQueryState(key)?.isInvalidated
    for (const [pantalla, key] of Object.entries(lectores('v1'))) expect([pantalla, invalidada(key)]).toEqual([pantalla, true])
    for (const [pantalla, key] of Object.entries(lectores('v2'))) expect([pantalla, invalidada(key)]).toEqual([pantalla, false])
  })
})
