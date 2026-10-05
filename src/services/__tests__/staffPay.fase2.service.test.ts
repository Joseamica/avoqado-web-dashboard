import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }))
vi.mock('@/api', () => ({ default: m }))
vi.mock('@/utils/export', () => ({ triggerDownload: vi.fn() }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
import { staffPayService } from '../staffPay.service'
import { triggerDownload } from '@/utils/export'
import { usePaidPreview, useStaffPayDetail, useStaffPayExceptions, useStaffPayOrphans, useStaffPayPeriods, useStaffPayReport, useStaffReceipt } from '@/hooks/useStaffPay'

const base = '/api/v1/dashboard/venues/v1/staff-pay'
beforeEach(() => vi.clearAllMocks())

describe('staffPayService — fase 2', () => {
  it('cerrar manda fecha, huella y la confirmación de huérfanas', async () => {
    m.post.mockResolvedValue({ data: { periodId: 'p1' } })
    await staffPayService.close('v1', { fecha: '2026-08-15', huellaEsperada: 'h', confirmarHuerfanas: true })
    expect(m.post).toHaveBeenCalledWith(`${base}/periods/close`, { fecha: '2026-08-15', huellaEsperada: 'h', confirmarHuerfanas: true })
  })
  it('el preview y el recibo van con la fecha del periodo en la query; el recibo, por páginas', async () => {
    m.get.mockResolvedValue({ data: {} })
    await staffPayService.closePreview('v1', '2026-08-15')
    expect(m.get).toHaveBeenCalledWith(`${base}/periods/close-preview`, { params: { fecha: '2026-08-15' } })
    await staffPayService.receipt('v1', 's1', '2026-08-15', { limit: 100 })
    expect(m.get).toHaveBeenCalledWith(`${base}/staff/s1/receipt`, { params: { fecha: '2026-08-15', limit: 100 } })
    // La página siguiente lleva el cursor que dio la anterior (Codex R2-R1-20).
    await staffPayService.receipt('v1', 's1', '2026-08-15', { cursor: '2026-08-04T14:00:00.000Z|c1', limit: 100 })
    expect(m.get).toHaveBeenLastCalledWith(`${base}/staff/s1/receipt`, { params: { fecha: '2026-08-15', cursor: '2026-08-04T14:00:00.000Z|c1', limit: 100 } })
  })
  it('el recibo con filtro de sede manda `sede` (Codex bloque A #5); sin filtro no la manda', async () => {
    m.get.mockResolvedValue({ data: {} })
    await staffPayService.receipt('v1', 's1', '2026-08-15', { limit: 100, sede: 'v2' })
    expect(m.get).toHaveBeenLastCalledWith(`${base}/staff/s1/receipt`, { params: { fecha: '2026-08-15', limit: 100, sede: 'v2' } })
    await staffPayService.receipt('v1', 's1', '2026-08-15', { limit: 100 })
    expect(m.get.mock.lastCall?.[1].params).not.toHaveProperty('sede')
  })
  it('preview de marcar pagado: sin staffId para «todos», con staffId para una persona (Codex bloque A #6)', async () => {
    m.get.mockResolvedValue({ data: {} })
    await staffPayService.paidPreview('v1', 'p1')
    expect(m.get).toHaveBeenLastCalledWith(`${base}/periods/p1/paid-preview`, { params: {} })
    await staffPayService.paidPreview('v1', 'p1', 's1')
    expect(m.get).toHaveBeenLastCalledWith(`${base}/periods/p1/paid-preview`, { params: { staffId: 's1' } })
  })
  it('marcar pagado manda la huella del preview que se vio', async () => {
    m.post.mockResolvedValue({ data: { marcados: 2 } })
    await staffPayService.markPaid('v1', 'p1', { huellaEsperada: 'a'.repeat(64) })
    expect(m.post).toHaveBeenLastCalledWith(`${base}/periods/p1/paid`, { huellaEsperada: 'a'.repeat(64) })
  })
  it('descargar el recibo pide un blob con el formato', async () => {
    const pdf = new Blob(['%PDF'])
    m.get.mockResolvedValue({ data: pdf })
    await staffPayService.downloadReceipt('v1', 's1', '2026-08-15', 'pdf', 'recibo-ana')
    expect(m.get).toHaveBeenCalledWith(`${base}/staff/s1/receipt/export`, { params: { fecha: '2026-08-15', format: 'pdf' }, responseType: 'blob' })
    expect(triggerDownload).toHaveBeenCalledWith(pdf, 'recibo-ana.pdf')
  })
  it('si la descarga falla, el cuerpo del error (un Blob) se deja como JSON y no se descarga nada', async () => {
    const cuerpo = { code: 'RECIBO_DEMASIADO_GRANDE', message: 'El recibo es demasiado grande para un PDF' }
    // jsdom no trae `Blob.text()` (los navegadores sí): se le pone a la instancia.
    const blob = Object.assign(new Blob([JSON.stringify(cuerpo)]), { text: async () => JSON.stringify(cuerpo) })
    m.get.mockRejectedValue(Object.assign(new Error('409'), { response: { status: 409, data: blob } }))
    const err = await staffPayService.downloadReceipt('v1', 's1', '2026-08-15', 'pdf', 'recibo-ana').catch(e => e)
    expect(err.response.data).toEqual(cuerpo)
    expect(triggerDownload).not.toHaveBeenCalled()
  })
  it('periodos: la primera página sin parámetros y las siguientes con antesDe; periodicidad y pagado por su ruta', async () => {
    m.get.mockResolvedValue({ data: {} })
    await staffPayService.periods('v1')
    expect(m.get).toHaveBeenLastCalledWith(`${base}/periods`, { params: {} })
    await staffPayService.periods('v1', '2026-06-01')
    expect(m.get).toHaveBeenLastCalledWith(`${base}/periods`, { params: { antesDe: '2026-06-01' } })
    m.patch.mockResolvedValue({ data: {} })
    await staffPayService.setPeriodicity('v1', 'SEMIMONTHLY')
    expect(m.patch).toHaveBeenCalledWith(`${base}/periodicity`, { periodicidad: 'SEMIMONTHLY' })
    m.post.mockResolvedValue({ data: { marcados: 1 } })
    await staffPayService.markPaid('v1', 'p1', { staffId: 's1' })
    expect(m.post).toHaveBeenLastCalledWith(`${base}/periods/p1/paid`, { staffId: 's1' })
    await staffPayService.addAdjustment('v1', { sede: 'v1', staffId: 's1', amount: -50, reason: 'Falta', clientKey: 'clave-12345' })
    expect(m.post).toHaveBeenLastCalledWith(`${base}/adjustments`, { sede: 'v1', staffId: 's1', amount: -50, reason: 'Falta', clientKey: 'clave-12345' })
  })
})

// ── Hooks de la fase 2 ──
function envoltorio() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children)
}
const renglon = (concepto: string) => ({ tipo: 'CLASE', fecha: '2026-08-04', hora: '09:00', sede: 'Centro', concepto, lugares: 8, monto: '100.00' })
const pagina = (renglones: string[], siguiente: string | null) => ({
  persona: 'Ana', periodo: { id: 'p1', start: '2026-08-01', end: '2026-08-31', estado: 'CLOSED' },
  renglones: renglones.map(renglon), total: '300.00', cantidad: 3, siguiente, pagadoEn: null, parcial: false,
})

describe('hooks de la fase 2', () => {
  it('el recibo se aplana por cursor y su total es el del recibo entero', async () => {
    m.get.mockImplementation(async (_url: string, { params }: { params: { cursor?: string } }) => ({
      data: params.cursor ? pagina(['c'], null) : pagina(['a', 'b'], 'cursor-1'),
    }))
    const { result } = renderHook(() => useStaffReceipt('s1', '2026-08-15'), { wrapper: envoltorio() })
    await waitFor(() => expect(result.current.data?.renglones).toHaveLength(2))
    expect(result.current.hasNextPage).toBe(true)
    expect(result.current.data?.total).toBe('300.00')
    await act(async () => { await result.current.fetchNextPage() })
    await waitFor(() => expect(result.current.data?.renglones.map(r => r.concepto)).toEqual(['a', 'b', 'c']))
    expect(m.get).toHaveBeenLastCalledWith(`${base}/staff/s1/receipt`, { params: { fecha: '2026-08-15', cursor: 'cursor-1', limit: 100 } })
    expect(result.current.hasNextPage).toBe(false)
  })

  it('el recibo con sede pide ESA sede y no comparte caché con el recibo sin filtro', async () => {
    m.get.mockResolvedValue({ data: pagina(['a'], null) })
    const env = envoltorio()
    renderHook(() => useStaffReceipt('s1', '2026-08-15'), { wrapper: env })
    renderHook(() => useStaffReceipt('s1', '2026-08-15', true, 'v2'), { wrapper: env })
    await waitFor(() => expect(m.get).toHaveBeenCalledTimes(2))
    expect(m.get.mock.calls.map(([, o]) => o.params.sede)).toEqual([undefined, 'v2'])
  })

  it('preview de marcar pagado: un 409 no se reintenta (es determinista)', async () => {
    m.get.mockRejectedValue(Object.assign(new Error('409'), { response: { status: 409, data: { code: 'HUELLA_CAMBIO' } } }))
    const { result } = renderHook(() => usePaidPreview('p1', undefined), { wrapper: envoltorio() })
    // Con reintento, `isError` llegaría hasta después del retraso del reintento (≥ 1 s), fuera del tiempo de waitFor.
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(m.get).toHaveBeenCalledTimes(1)
  })

  it('RECIBO_CAMBIO en la segunda página reinicia el recibo desde la primera, sin dejar el error', async () => {
    // El cursor sólo vale mientras no se haya vuelto a pedir la página 1: el 409 es determinista y NO se reintenta.
    let paginas1 = 0
    m.get.mockImplementation(async (_url: string, { params }: { params: { cursor?: string } }) => {
      if (!params.cursor) paginas1++
      if (params.cursor && paginas1 === 1) {
        throw Object.assign(new Error('409'), { response: { status: 409, data: { code: 'RECIBO_CAMBIO' } } })
      }
      return { data: params.cursor ? pagina(['c'], null) : pagina(['a', 'b'], 'cursor-1') }
    })
    const { result } = renderHook(() => useStaffReceipt('s1', '2026-08-15'), { wrapper: envoltorio() })
    await waitFor(() => expect(result.current.data?.renglones).toHaveLength(2))
    await act(async () => { await result.current.fetchNextPage().catch(() => undefined) })
    // Se reinició: otra vez la página 1 (sin cursor), el recibo vuelve a tener sus 2 renglones y ya no hay error.
    await waitFor(() => expect(paginas1).toBe(2))
    await waitFor(() => expect(result.current.isError).toBe(false))
    await waitFor(() => expect(result.current.data?.renglones).toHaveLength(2))
    expect(result.current.hasNextPage).toBe(true)
    // Una sola petición con el cursor viejo: el 409 no se reintentó.
    expect(m.get.mock.calls.filter(([, o]) => o.params.cursor)).toHaveLength(1)
  })

  it('reporte: paginar dentro del mismo periodo conserva lo anterior; cambiar de periodo NO', async () => {
    // Cada petición queda pendiente hasta que la prueba la resuelve, para mirar el placeholder.
    const pendientes: Array<(v: unknown) => void> = []
    m.get.mockImplementation(() => new Promise(r => pendientes.push(r)))
    const reporte = (estado: string) => ({ data: { periodo: { start: '2026-08-01', end: '2026-08-31', periodicidad: 'MONTHLY', estado }, personas: { items: [], total: 0, offset: 0, limit: 50 } } })
    const { result, rerender } = renderHook(({ p }) => useStaffPayReport(p), {
      wrapper: envoltorio(),
      initialProps: { p: { offset: 0, limit: 50, fecha: '2026-08-15' } },
    })
    await waitFor(() => expect(pendientes).toHaveLength(1))
    await act(async () => { pendientes[0](reporte('OPEN')) })
    await waitFor(() => expect(result.current.data?.periodo.estado).toBe('OPEN'))

    // Siguiente página del MISMO periodo: se ve lo anterior mientras llega.
    rerender({ p: { offset: 50, limit: 50, fecha: '2026-08-15' } })
    await waitFor(() => expect(pendientes).toHaveLength(2))
    expect(result.current.isPlaceholderData).toBe(true)
    expect(result.current.data?.periodo.estado).toBe('OPEN')
    await act(async () => { pendientes[1](reporte('OPEN')) })
    await waitFor(() => expect(result.current.isPlaceholderData).toBe(false))

    // OTRO periodo: nada del anterior (su `estado` no puede decidir qué pide la pantalla).
    rerender({ p: { offset: 0, limit: 50, fecha: '2026-07-15' } })
    await waitFor(() => expect(pendientes).toHaveLength(3))
    expect(result.current.isPlaceholderData).toBe(false)
    expect(result.current.data).toBeUndefined()
  })

  it('periodos: la segunda página pide antesDe y los items vienen aplanados', async () => {
    const item = (start: string) => ({ id: null, start, end: start, estado: 'OPEN', personas: 0, pagadas: 0, total: '0.00' })
    m.get.mockImplementation(async (_url: string, { params }: { params: { antesDe?: string } }) => ({
      data: params.antesDe
        ? { periodicidad: 'MONTHLY', puedeCambiarPeriodicidad: false, items: [item('2026-05-01')], antesDe: null }
        : { periodicidad: 'MONTHLY', puedeCambiarPeriodicidad: true, items: [item('2026-07-01'), item('2026-06-01')], antesDe: '2026-06-01' },
    }))
    const { result } = renderHook(() => useStaffPayPeriods(), { wrapper: envoltorio() })
    await waitFor(() => expect(result.current.data?.items).toHaveLength(2))
    expect(result.current.hasNextPage).toBe(true)
    expect(result.current.data?.puedeCambiarPeriodicidad).toBe(true)
    await act(async () => { await result.current.fetchNextPage() })
    await waitFor(() => expect(result.current.data?.items.map(i => i.start)).toEqual(['2026-07-01', '2026-06-01', '2026-05-01']))
    expect(m.get).toHaveBeenLastCalledWith(`${base}/periods`, { params: { antesDe: '2026-06-01' } })
    expect(result.current.hasNextPage).toBe(false)
  })

  it('desglose, excepciones y huérfanas mandan la fecha y NO piden nada con enabled=false (periodo cerrado)', async () => {
    m.get.mockResolvedValue({ data: { items: [], nextCursor: null, total: 0 } })
    renderHook(() => useStaffPayDetail('s1', undefined, '2026-08-15', false), { wrapper: envoltorio() })
    renderHook(() => useStaffPayExceptions(undefined, '2026-08-15', false), { wrapper: envoltorio() })
    renderHook(() => useStaffPayOrphans(undefined, '2026-08-15', false), { wrapper: envoltorio() })
    await new Promise(r => setTimeout(r, 20))
    expect(m.get).not.toHaveBeenCalled()

    renderHook(() => useStaffPayDetail('s1', undefined, '2026-08-15'), { wrapper: envoltorio() })
    renderHook(() => useStaffPayExceptions(undefined, '2026-08-15'), { wrapper: envoltorio() })
    renderHook(() => useStaffPayOrphans(undefined, '2026-08-15'), { wrapper: envoltorio() })
    await waitFor(() => expect(m.get).toHaveBeenCalledTimes(3))
    for (const [, o] of m.get.mock.calls) expect(o.params.fecha).toBe('2026-08-15')
  })
})
