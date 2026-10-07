import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getIsrProvisional } from '@/services/fiscal/isr.service'
import { getIvaCashflow } from '@/services/fiscal/ivaFlujo.service'
import { fetchBusinessSummary } from '@/services/reports/accounting.service'
import { useBusinessSummary } from './useAccounting'
import { useIsrProvisional } from './useIsr'
import { useIvaCashflow } from './useIvaCashflow'

/**
 * Prueba extra de la Tarea 7 de B4b (no venía en el brief): el sabotaje (j) dice que dejar el ISR con el reintento por defecto hace caer
 * una prueba, pero `Isr.test.tsx` simula el hook entero. Esto vigila el `retry` de los otros tres hooks de reportes (Codex r5 R5-8;
 * fallo 2 de la ronda 7): REPORT_TOO_LARGE / REPORT_TIMEOUT no se repiten solos; cualquier otro error se sigue reintentando.
 */
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/services/fiscal/isr.service', async importOriginal => ({
  ...(await importOriginal<typeof import('@/services/fiscal/isr.service')>()),
  getIsrProvisional: vi.fn(),
}))
vi.mock('@/services/fiscal/ivaFlujo.service', async importOriginal => ({
  ...(await importOriginal<typeof import('@/services/fiscal/ivaFlujo.service')>()),
  getIvaCashflow: vi.fn(),
}))
vi.mock('@/services/reports/accounting.service', async importOriginal => ({
  ...(await importOriginal<typeof import('@/services/reports/accounting.service')>()),
  fetchBusinessSummary: vi.fn(),
}))
const conCliente = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
)
const delServidor = (code: string) => ({ response: { data: { code, message: 'x' } } })

describe('reintento de los reportes mensuales y del Resumen (B4b · Codex r5 R5-8; fallo 2 de la ronda 7)', () => {
  beforeEach(() => {
    vi.mocked(getIsrProvisional).mockReset()
    vi.mocked(getIvaCashflow).mockReset()
    vi.mocked(fetchBusinessSummary).mockReset()
  })

  it('🔴 ISR · REPORT_TOO_LARGE no se repite solo: una sola llamada', async () => {
    vi.mocked(getIsrProvisional).mockRejectedValue(delServidor('REPORT_TOO_LARGE'))
    const { result } = renderHook(() => useIsrProvisional('2026-06', 'RESICO'), { wrapper: conCliente })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(getIsrProvisional).toHaveBeenCalledTimes(1)
  })

  it('🔴 IVA en flujo · REPORT_TIMEOUT no se repite solo: una sola llamada', async () => {
    vi.mocked(getIvaCashflow).mockRejectedValue(delServidor('REPORT_TIMEOUT'))
    const { result } = renderHook(() => useIvaCashflow('2026-06'), { wrapper: conCliente })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(getIvaCashflow).toHaveBeenCalledTimes(1)
  })

  it('🔴 Resumen · REPORT_TIMEOUT no se repite solo: una sola llamada', async () => {
    vi.mocked(fetchBusinessSummary).mockRejectedValue(delServidor('REPORT_TIMEOUT'))
    const { result } = renderHook(() => useBusinessSummary({ from: '2026-06-01', to: '2026-06-30' }), { wrapper: conCliente })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(fetchBusinessSummary).toHaveBeenCalledTimes(1)
  })

  it('control · ISR e IVA: otro error se sigue reintentando (el primer reintento llega al segundo)', async () => {
    vi.mocked(getIsrProvisional).mockRejectedValue(new Error('Network Error'))
    vi.mocked(getIvaCashflow).mockRejectedValue(new Error('Network Error'))
    renderHook(() => useIsrProvisional('2026-06', 'RESICO'), { wrapper: conCliente })
    renderHook(() => useIvaCashflow('2026-06'), { wrapper: conCliente })
    await waitFor(() => expect(getIsrProvisional).toHaveBeenCalledTimes(2), { timeout: 3_000 })
    await waitFor(() => expect(getIvaCashflow).toHaveBeenCalledTimes(2), { timeout: 3_000 })
  })
})
