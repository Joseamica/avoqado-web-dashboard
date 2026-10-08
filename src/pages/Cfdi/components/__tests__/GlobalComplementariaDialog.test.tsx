/**
 * C1 · Tarea 13 — el diálogo de la global complementaria. Se pide por el id de la principal (C1-25), enseña lo que entraría
 * ANTES de timbrar, y si el servidor dice que no se puede (año fuera: C1-33) no ofrece «Emitir».
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import es from '@/locales/es/cfdi.json'
import en from '@/locales/en/cfdi.json'
import type { GlobalComplementariaPreview } from '@/services/cfdi.service'

const traducir = (key: string, opts?: Record<string, unknown>) => {
  const raw = key.split('.').reduce<any>((o, k) => o?.[k], es as any)
  if (typeof raw !== 'string') return key
  return raw.replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => String(opts?.[k] ?? ''))
}
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: traducir, i18n: { language: 'es' } }),
}))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/utils/datetime', () => ({
  useVenueDateTime: () => ({ formatDate: (d: string) => `fecha(${d})`, formatDateTime: (d: string) => `fecha(${d})` }),
}))

const m = vi.hoisted(() => ({ getGlobalComplementariaPreview: vi.fn(), emitGlobalComplementaria: vi.fn(), toast: vi.fn() }))
vi.mock('@/services/cfdi.service', () => ({
  default: { getGlobalComplementariaPreview: m.getGlobalComplementariaPreview, emitGlobalComplementaria: m.emitGlobalComplementaria },
}))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))
vi.mock('../GlobalExcluidasDialog', () => ({
  GlobalExcluidasDialog: ({ open, emisorId, principalId }: { open: boolean; emisorId: string | null; principalId?: string }) =>
    open ? <div data-testid="excluidas">{`${emisorId}:${principalId}`}</div> : null,
}))

import { GlobalComplementariaDialog } from '../GlobalComplementariaDialog'

const g = es.globalInvoice
const vista = (over: Partial<GlobalComplementariaPreview> = {}): GlobalComplementariaPreview => ({
  periodo: { desde: '2026-09-04T06:00:00.000Z', hasta: '2026-09-05T06:00:00.000Z', meses: '09', anio: 2026 },
  estadoPrincipal: 'TIMBRADA',
  corregidasPendientes: { n: 2, completo: true },
  siguienteLlave: 'cfdi-global-e1-2026-09-04-c2',
  motivo: null,
  ...over,
})

function pintar(onOpenChange = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <GlobalComplementariaDialog emisorId="e1" principalId="g1" onOpenChange={onOpenChange} />
    </QueryClientProvider>,
  )
  return onOpenChange
}

describe('GlobalComplementariaDialog', () => {
  it('🔴 pide la vista previa por el id de la principal, enseña periodo, estado y cuántas entrarían; «Emitir» emite por ese id y avisa', async () => {
    m.getGlobalComplementariaPreview.mockResolvedValue(vista())
    m.emitGlobalComplementaria.mockResolvedValue({
      complementariaDe: 'g1',
      excluidas: {},
      cfdi: { id: 'g1c2', uuid: 'U', serie: 'G', folio: '11', globalPeriod: null, pdfUrl: null },
    })
    const onOpenChange = pintar()
    await waitFor(() =>
      expect(screen.getByRole('dialog')).toHaveTextContent(traducir('globalInvoice.complementaryDialog.salesCount', { count: 2 })),
    )
    expect(m.getGlobalComplementariaPreview).toHaveBeenCalledWith('v1', 'e1', 'g1')
    // I3 (ronda 1): el periodo en la zona fiscal (CDMX).
    expect(screen.getByRole('dialog')).toHaveTextContent(/4 sept?\.? 2026/)
    expect(screen.getByRole('button', { name: g.complementaryDialog.cancel })).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toHaveTextContent(g.periods.stamped)

    fireEvent.click(screen.getByRole('button', { name: g.complementaryDialog.issue }))
    await waitFor(() => expect(m.emitGlobalComplementaria).toHaveBeenCalledWith('v1', 'e1', 'g1'))
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining(g.periods.complementaryHelp) }))
  })

  it('🔴 un 400 muestra su texto en el diálogo y no lo cierra', async () => {
    const TEXTO = 'Este periodo ya tiene 20 facturas globales complementarias; pide ayuda a soporte.'
    m.getGlobalComplementariaPreview.mockResolvedValue(vista())
    m.emitGlobalComplementaria.mockRejectedValue({ response: { status: 400, data: { error: TEXTO } } })
    const onOpenChange = pintar()
    fireEvent.click(await screen.findByRole('button', { name: g.complementaryDialog.issue }))
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveTextContent(TEXTO))
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })

  it('🔴 C1-33: con `motivo` en la vista previa (año fuera) muestra el motivo y NO ofrece «Emitir»', async () => {
    const MOTIVO = 'Ese periodo es de un año que ya no se puede facturar desde aquí; pídela a soporte.'
    m.getGlobalComplementariaPreview.mockResolvedValue(vista({ motivo: MOTIVO }))
    pintar()
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveTextContent(MOTIVO))
    expect(screen.queryByRole('button', { name: g.complementaryDialog.issue })).not.toBeInTheDocument()
  })

  it('🔴 C1-27: { n: 0, completo: false } dice «Hay más de 200…» (nunca «200 o más») y deja emitir', async () => {
    m.getGlobalComplementariaPreview.mockResolvedValue(vista({ corregidasPendientes: { n: 0, completo: false } }))
    pintar()
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveTextContent(g.periods.complementaryUnknown))
    expect(screen.getByRole('button', { name: g.complementaryDialog.issue })).toBeEnabled()
  })

  it('«al menos 3» cuando el servidor no terminó de revisar', async () => {
    m.getGlobalComplementariaPreview.mockResolvedValueOnce(vista({ corregidasPendientes: { n: 3, completo: false } }))
    pintar()
    await waitFor(() =>
      expect(screen.getByRole('dialog')).toHaveTextContent(traducir('globalInvoice.complementaryDialog.salesAtLeast', { count: 3 })),
    )
  })

  it('sin ventas pendientes (n: 0, completo) lo dice y no ofrece «Emitir»', async () => {
    m.getGlobalComplementariaPreview.mockResolvedValue(vista({ corregidasPendientes: { n: 0, completo: true } }))
    pintar()
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveTextContent(g.complementaryDialog.none))
    expect(screen.queryByRole('button', { name: g.complementaryDialog.issue })).not.toBeInTheDocument()
  })

  it('🔴 C1-32: «Ver ventas que no entraron» abre el listado con el id de la principal', async () => {
    m.getGlobalComplementariaPreview.mockResolvedValue(vista())
    pintar()
    fireEvent.click(await screen.findByRole('button', { name: g.complementaryDialog.seeExcluded }))
    expect(screen.getByTestId('excluidas').textContent).toBe('e1:g1')
  })

  it('un 400 al pedir la vista previa (la principal no está timbrada) muestra el texto y no ofrece «Emitir»', async () => {
    const TEXTO = 'La factura global principal de este periodo todavía no está timbrada; emítela primero.'
    m.getGlobalComplementariaPreview.mockRejectedValue({ response: { status: 400, data: { error: TEXTO } } })
    pintar()
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveTextContent(TEXTO))
    expect(screen.queryByRole('button', { name: g.complementaryDialog.issue })).not.toBeInTheDocument()
  })

  it('🔴 M6: sin «Emitir» (con `motivo` o sin ventas pendientes) el botón de salir dice «Cerrar», no «Cancelar»', async () => {
    m.getGlobalComplementariaPreview.mockResolvedValue(
      vista({ motivo: 'Ese periodo es de un año que ya no se puede facturar desde aquí; pídela a soporte.' }),
    )
    pintar()
    expect(await screen.findByRole('button', { name: g.complementaryDialog.close })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: g.complementaryDialog.cancel })).not.toBeInTheDocument()
  })

  it('🔴 I4: un 524 al pedir la vista previa dice el texto de la pantalla, nunca «Request failed…»', async () => {
    m.getGlobalComplementariaPreview.mockRejectedValue({
      response: { status: 524, data: 'error code: 524' },
      message: 'Request failed with status code 524',
    })
    pintar()
    expect(await screen.findByText(g.complementaryDialog.loadError, undefined, { timeout: 3_000 })).toBeInTheDocument()
    expect(screen.getByRole('dialog')).not.toHaveTextContent(/Request failed/)
  })

  it('🔴 I4: un 524 al emitir dice «No sabemos si se emitió», nunca «Request failed…»', async () => {
    m.getGlobalComplementariaPreview.mockResolvedValue(vista())
    m.emitGlobalComplementaria.mockRejectedValue({
      response: { status: 524, data: 'error code: 524' },
      message: 'Request failed with status code 524',
    })
    pintar()
    fireEvent.click(await screen.findByRole('button', { name: g.complementaryDialog.issue }))
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveTextContent(g.toast.uncertainTitle))
    expect(screen.getByRole('dialog')).not.toHaveTextContent(/Request failed/)
  })

  it('🔴 M3 (ola final): el aviso de «no sabemos» no manda a «Actualizar», que no existe si el diálogo se abrió desde la lista de facturas', async () => {
    m.getGlobalComplementariaPreview.mockResolvedValue(vista())
    m.emitGlobalComplementaria.mockRejectedValue({ response: { status: 524, data: 'error code: 524' } })
    pintar()
    fireEvent.click(await screen.findByRole('button', { name: g.complementaryDialog.issue }))
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveTextContent(g.toast.uncertainDescription))
    expect(screen.getByRole('dialog')).not.toHaveTextContent(g.periods.refresh)
    // El mismo texto sirve en los dos lugares (también en el panel y en el botón de hoy): en ningún idioma nombra ese botón.
    expect(g.toast.uncertainDescription).not.toContain(g.periods.refresh)
    expect(en.globalInvoice.toast.uncertainDescription).not.toContain(en.globalInvoice.periods.refresh)
  })

  it('🔴 ronda 2 (T11 m4): si la complementaria YA estaba timbrada, el aviso lo dice; nunca «timbrada» a secas', async () => {
    m.getGlobalComplementariaPreview.mockResolvedValue(vista())
    m.emitGlobalComplementaria.mockResolvedValue({
      status: 'YA_TIMBRADA',
      yaTimbrada: true,
      message: 'Esta factura global complementaria ya estaba timbrada; no se emitió otra.',
      excluidas: {},
      complementariaDe: 'g1',
      cfdi: { id: 'g1c2', uuid: 'U', serie: 'G', folio: '11', globalPeriod: null, pdfUrl: null },
    })
    pintar()
    fireEvent.click(await screen.findByRole('button', { name: g.complementaryDialog.issue }))
    await waitFor(() => expect(m.toast).toHaveBeenCalled())
    expect(m.toast.mock.calls[0][0].title).toBe(traducir('globalInvoice.toast.alreadyStampedTitle', { folio: 'G-11' }))
  })

  it('🔴 ronda 2 (T11): con `siguienteLlave: null` (ya hay 20) no ofrece «Emitir» y dice por qué', async () => {
    m.getGlobalComplementariaPreview.mockResolvedValue(vista({ siguienteLlave: null }))
    pintar()
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveTextContent(g.complementaryDialog.limitReached))
    expect(screen.queryByRole('button', { name: g.complementaryDialog.issue })).not.toBeInTheDocument()
  })
})
