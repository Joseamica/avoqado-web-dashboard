import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchIncomeStatement } from '@/services/reports/incomeStatement.service'
import { useIncomeStatement } from './useIncomeStatement'

vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/services/reports/incomeStatement.service', async importOriginal => ({
  ...(await importOriginal<typeof import('@/services/reports/incomeStatement.service')>()),
  fetchIncomeStatement: vi.fn(),
}))
const conCliente = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
)

describe('useIncomeStatement · reintento (Codex r5 R5-8)', () => {
  // Con llaves: un `beforeEach` que DEVUELVE una función hace que Vitest la llame como limpieza tras cada prueba; sin ellas
  // devolvería el doble y, en el hook, su promesa rechazada tumbaba la prueba después de pasar.
  beforeEach(() => {
    vi.mocked(fetchIncomeStatement).mockReset()
  })

  it('🔴 REPORT_TIMEOUT no se repite solo: una sola llamada', async () => {
    vi.mocked(fetchIncomeStatement).mockRejectedValue({ response: { data: { code: 'REPORT_TIMEOUT', message: 'x' } } })
    const { result } = renderHook(() => useIncomeStatement({ from: '2026-06-01', to: '2026-06-30' }), { wrapper: conCliente })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(fetchIncomeStatement).toHaveBeenCalledTimes(1)
  })

  it('control · otro error se reintenta una vez, como hoy', async () => {
    vi.mocked(fetchIncomeStatement).mockRejectedValue(new Error('Network Error'))
    const { result } = renderHook(() => useIncomeStatement({ from: '2026-06-01', to: '2026-06-30' }), { wrapper: conCliente })
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5_000 })
    expect(fetchIncomeStatement).toHaveBeenCalledTimes(2)
  })
})
