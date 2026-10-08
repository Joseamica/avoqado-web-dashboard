// E6a-fix4 K-n1 (re-prueba del 8-oct): al cerrarse, durante la animación de salida, el diálogo de «Marcar pagado» de UNA persona
// mostraba el texto de «todos» («¿Registrar el pago de todos en septiembre de 2026?», «Registrar … de 1 recibo»): el contenido
// dependía de `confirmar`, que se vaciaba al cerrar. Radix deja el contenido montado hasta que termina la animación; jsdom no
// pinta CSS, así que aquí la animación se simula como la ve Radix (`animationName` distinto al abrir y al cerrar, y
// `animationend` para terminarla). Hooks REALES y QueryClient real; sólo el servicio es simulado.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { simularAnimacionDeSalida, terminarAnimacion } from '@/test/animacionDeSalida'
import { PeriodoCerradoView } from '../components/PeriodoCerradoView'

const m = vi.hoisted(() => ({ report: vi.fn(), preview: vi.fn(), paid: vi.fn(), toast: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: unknown) => (o ? `${k}:${JSON.stringify(o)}` : k), i18n: { language: 'es' } }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatDate: (d: string) => d.slice(0, 10), formatCalendarDate: (d: string) => d }) }))
vi.mock('../useNombreSede', () => ({ useNombreSede: () => (id: string) => id }))
vi.mock('../components/DesglosePersona', () => ({ DesglosePersona: () => null }))
vi.mock('../components/DiferenciasSection', () => ({ DiferenciasSection: () => null }))
vi.mock('../components/AjusteManualModal', () => ({ AjusteManualModal: () => null }))
vi.mock('@/services/staffPay.service', () => ({
  staffPayService: {
    report: (...a: unknown[]) => m.report(...a),
    paidPreview: (...a: unknown[]) => m.preview(...a),
    markPaid: (...a: unknown[]) => m.paid(...a),
    differences: async () => ({ items: [], nextCursor: null }),
  },
}))

const ANA = { staffId: 'a', staffName: 'Ana', payLevelName: 'Coach', venueIds: ['v1'], clases: 1, promedioLugares: 8, ajustes: '0.00', total: '570.00', pagadoEn: null }
const REPORTE = {
  periodo: { start: '2026-09-01', end: '2026-09-30', estado: 'CLOSED', id: 'p9', periodicidad: 'MONTHLY' }, parcial: false, venueIds: ['v1'], truncado: false, huerfanas: 0,
  tarjetas: { total: '570.00', clases: 1, personas: 1, pagadas: 0, excepciones: 0, excluidas: 0 },
  personas: { items: [ANA], total: 1, offset: 0, limit: 50 },
}
const previewDe = (staffId?: string) => ({
  periodo: { start: '2026-09-01', end: '2026-09-30', estado: 'CLOSED' },
  cantidad: 1,
  total: '570.00',
  recibos: [],
  huella: (staffId ? 'a' : 'b').repeat(64),
})

beforeEach(() => {
  vi.clearAllMocks()
  m.report.mockResolvedValue(REPORTE)
  m.preview.mockImplementation(async (_v: string, _p: string, staffId?: string) => previewDe(staffId))
  m.paid.mockResolvedValue({ marcados: 1 })
  simularAnimacionDeSalida()
})
afterEach(() => vi.restoreAllMocks())

const abrirParaAna = async () => {
  fireEvent.click(await screen.findByRole('button', { name: /closed\.markPaidFor/ }))
  const registrar = await screen.findByRole('button', { name: /closed\.markPaidConfirm/ })
  await waitFor(() => expect(registrar).toBeEnabled())
  return registrar
}

describe('el diálogo de «Marcar pagado» de una persona al cerrarse (K-n1)', () => {
  it('🔴 durante la animación de salida sigue diciendo lo de esa persona, nunca lo de «todos»', async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        <PeriodoCerradoView periodId="p9" fecha="2026-09-01" etiqueta="septiembre 2026" />
      </QueryClientProvider>,
    )
    const registrar = await abrirParaAna()
    const dialogo = screen.getByRole('alertdialog')
    fireEvent.click(registrar)
    await waitFor(() => expect(m.toast).toHaveBeenCalledWith({ title: 'closed.markedPaid:{"count":1}' }))
    // Cerrándose: sigue montado (la animación de salida) y con el contenido de Ana.
    await waitFor(() => expect(dialogo).toHaveAttribute('data-state', 'closed'))
    expect(dialogo).toBeInTheDocument()
    expect(within(dialogo).getByText(/^closed\.markPaidTitle/)).toHaveTextContent('"nombre":"Ana","monto":"$570.00"')
    expect(within(dialogo).getByRole('button', { name: /^closed\.markPaidConfirm/ })).toHaveTextContent('$570.00')
    expect(within(dialogo).queryByText(/closed\.markAllPaid/)).toBeNull()
    terminarAnimacion(dialogo)
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('al terminar de cerrarse se suelta: volver a abrirlo pide otra vez la vista previa y no enseña la de antes', async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        <PeriodoCerradoView periodId="p9" fecha="2026-09-01" etiqueta="septiembre 2026" />
      </QueryClientProvider>,
    )
    await abrirParaAna()
    const dialogo = screen.getByRole('alertdialog')
    fireEvent.click(screen.getByRole('button', { name: 'closed.cancel' }))
    await waitFor(() => expect(dialogo).toHaveAttribute('data-state', 'closed'))
    terminarAnimacion(dialogo)
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    // La siguiente vista previa tarda: mientras llega, se dice que se está calculando, no el monto de la vez anterior.
    m.preview.mockImplementationOnce(() => new Promise(() => undefined))
    fireEvent.click(await screen.findByRole('button', { name: /closed\.markPaidFor/ }))
    expect(await screen.findByText('closed.previewLoading')).toBeInTheDocument()
    expect(within(screen.getByRole('alertdialog')).queryByText(/570/)).toBeNull()
  })
})
