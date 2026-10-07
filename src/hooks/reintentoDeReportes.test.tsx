import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getIsrProvisional } from '@/services/fiscal/isr.service'
import { getIvaCashflow } from '@/services/fiscal/ivaFlujo.service'
import { fetchBusinessSummary } from '@/services/reports/accounting.service'
import { fetchIncomeStatement } from '@/services/reports/incomeStatement.service'
import { useBusinessSummary } from './useAccounting'
import { useIncomeStatement } from './useIncomeStatement'
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
vi.mock('@/services/reports/incomeStatement.service', async importOriginal => ({
  ...(await importOriginal<typeof import('@/services/reports/incomeStatement.service')>()),
  fetchIncomeStatement: vi.fn(),
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

/**
 * I1 (revisión final de B4b): `retry` cubre los reintentos inmediatos, no éstos. react-query vuelve a pedir una consulta en error
 * cuando la ventana recupera el foco (en la v5 escucha `visibilitychange`) y cuando vuelve la red (`online`): sin datos siempre está
 * «vieja». Para REPORT_TOO_LARGE / REPORT_TIMEOUT y el corte del proxy eso relanzaba solo una foto de hasta 90 s.
 */
describe('I1 (revisión final) · un reporte en REPORT_TOO_LARGE / REPORT_TIMEOUT o en un corte del proxy no se vuelve a pedir al recuperar el foco ni al reconectar', () => {
  // Sin espera entre reintentos (el hook no fija `retryDelay`), para que el control no tarde segundos.
  const sinEspera = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } })}>{children}</QueryClientProvider>
  )
  const unRato = () => new Promise(r => setTimeout(r, 50))
  const volverALaVentana = async () => {
    act(() => {
      window.dispatchEvent(new Event('visibilitychange'))
    })
    await unRato()
  }
  const reconectar = async () => {
    act(() => {
      window.dispatchEvent(new Event('offline'))
      window.dispatchEvent(new Event('online'))
    })
    await unRato()
  }
  const periodo = { from: '2026-06-01', to: '2026-06-30' }
  const reportes: Array<{ nombre: string; servicio: () => ReturnType<typeof vi.fn>; useReporte: () => { isError: boolean } }> = [
    { nombre: 'IVA en flujo', servicio: () => vi.mocked(getIvaCashflow), useReporte: () => useIvaCashflow('2026-06') },
    { nombre: 'ISR', servicio: () => vi.mocked(getIsrProvisional), useReporte: () => useIsrProvisional('2026-06', 'RESICO') },
    { nombre: 'Estado de resultados', servicio: () => vi.mocked(fetchIncomeStatement), useReporte: () => useIncomeStatement(periodo) },
    { nombre: 'Resumen', servicio: () => vi.mocked(fetchBusinessSummary), useReporte: () => useBusinessSummary(periodo) },
  ]

  beforeEach(() => {
    vi.mocked(getIsrProvisional).mockReset()
    vi.mocked(getIvaCashflow).mockReset()
    vi.mocked(fetchBusinessSummary).mockReset()
    vi.mocked(fetchIncomeStatement).mockReset()
  })

  it.each(reportes)('🔴 $nombre · REPORT_TIMEOUT: ni el foco ni la reconexión lo vuelven a pedir', async ({ servicio, useReporte }) => {
    servicio().mockRejectedValue(delServidor('REPORT_TIMEOUT'))
    const { result } = renderHook(useReporte, { wrapper: sinEspera })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(servicio()).toHaveBeenCalledTimes(1)
    await volverALaVentana()
    await reconectar()
    expect(servicio()).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['REPORT_TOO_LARGE', delServidor('REPORT_TOO_LARGE')],
    ['el corte del proxy (524)', { response: { status: 524, data: 'error code: 524' } }],
    ['el corte del proxy (504)', { response: { status: 504, data: '' } }],
  ])('🔴 IVA en flujo · %s tampoco', async (_nombre, error) => {
    vi.mocked(getIvaCashflow).mockRejectedValue(error)
    const { result } = renderHook(() => useIvaCashflow('2026-06'), { wrapper: sinEspera })
    await waitFor(() => expect(result.current.isError).toBe(true))
    await volverALaVentana()
    await reconectar()
    expect(getIvaCashflow).toHaveBeenCalledTimes(1)
  })

  it('control · otro error SÍ se vuelve a pedir al recuperar el foco y al reconectar (lo de siempre)', async () => {
    vi.mocked(fetchBusinessSummary).mockRejectedValue(new Error('Network Error'))
    const { result } = renderHook(() => useBusinessSummary(periodo), { wrapper: sinEspera })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(fetchBusinessSummary).toHaveBeenCalledTimes(2) // el intento y su único reintento
    await volverALaVentana()
    await waitFor(() => expect(fetchBusinessSummary).toHaveBeenCalledTimes(4)) // el foco: otro intento y su reintento
    await waitFor(() => expect(result.current.isError).toBe(true))
    await reconectar()
    await waitFor(() => expect(fetchBusinessSummary).toHaveBeenCalledTimes(6)) // la red: otro intento y su reintento
  })
})
