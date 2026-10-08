// E6a-fix3: el hook entrega los renglones Y el `total` del servidor (tope de «Resumen de Comisiones»). Con otra llave que
// `useCommissionSummaries`, para no mezclar un arreglo con `{ items, total }` en la misma caché.
import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { useCommissionSummaries, useCommissionSummariesPage } from '../useCommissions'

const m = vi.hoisted(() => ({ page: vi.fn() }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/services/commission.service', () => ({
  commissionService: {
    getSummariesPage: (...a: unknown[]) => m.page(...a),
    getSummaries: async (...a: unknown[]) => (await m.page(...a)).items,
  },
}))

const envolver = (qc: QueryClient) => ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>

describe('useCommissionSummariesPage', () => {
  it('🔴 entrega los renglones y el total del servidor', async () => {
    m.page.mockResolvedValue({ items: [{ id: 'a' }], total: 730 })
    const { result } = renderHook(() => useCommissionSummariesPage(), { wrapper: envolver(new QueryClient()) })
    await waitFor(() => expect(result.current.data).toEqual({ items: [{ id: 'a' }], total: 730 }))
  })
  it('no comparte caché con useCommissionSummaries (cada uno con su forma)', async () => {
    m.page.mockResolvedValue({ items: [{ id: 'a' }], total: 730 })
    const qc = new QueryClient()
    const a = renderHook(() => useCommissionSummaries(), { wrapper: envolver(qc) })
    const b = renderHook(() => useCommissionSummariesPage(), { wrapper: envolver(qc) })
    await waitFor(() => expect(a.result.current.data).toEqual([{ id: 'a' }]))
    await waitFor(() => expect(b.result.current.data).toEqual({ items: [{ id: 'a' }], total: 730 }))
  })
})
