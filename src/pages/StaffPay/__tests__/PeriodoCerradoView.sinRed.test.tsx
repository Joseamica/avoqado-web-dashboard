// E6a-fix2 C5 (full-testing E6a): sin red, TanStack deja «marcar pagado» EN PAUSA y lo manda solo al volver la red; el diálogo
// se congelaba con «Cancelar» y «Registrar» apagados, sin decir nada y sin salida. Con los hooks REALES y un QueryClient real
// (sólo el servicio es simulado) y la red apagada con `onlineManager`, como la apaga el navegador.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
const PREVIEW = { periodo: { start: '2026-09-01', end: '2026-09-30', estado: 'CLOSED' }, cantidad: 1, total: '570.00', recibos: [], huella: 'a'.repeat(64) }

beforeEach(() => {
  vi.clearAllMocks()
  m.report.mockResolvedValue(REPORTE)
  m.preview.mockResolvedValue(PREVIEW)
  m.paid.mockResolvedValue({ marcados: 1 })
})
afterEach(() => onlineManager.setOnline(true))

const abrirDialogo = async () => {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <PeriodoCerradoView periodId="p9" fecha="2026-09-01" etiqueta="septiembre 2026" />
    </QueryClientProvider>,
  )
  fireEvent.click(await screen.findByRole('button', { name: /closed\.markPaidFor/ }))
  const registrar = await screen.findByRole('button', { name: /closed\.markPaidConfirm/ })
  await waitFor(() => expect(registrar).toBeEnabled())
  return registrar
}

describe('marcar pagado sin red (C5)', () => {
  it('🔴 en pausa dice que se enviará al volver la red, y «Cancelar» sigue disponible', async () => {
    const registrar = await abrirDialogo()
    onlineManager.setOnline(false)
    fireEvent.click(registrar)
    expect(await screen.findByText('offline.willSend')).toBeInTheDocument()
    expect(m.paid).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'closed.cancel' })).toBeEnabled()
  })

  it('🔴 cancelar en pausa es de verdad: al volver la red NO se registra', async () => {
    const registrar = await abrirDialogo()
    onlineManager.setOnline(false)
    fireEvent.click(registrar)
    await screen.findByText('offline.willSend')
    fireEvent.click(screen.getByRole('button', { name: 'closed.cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await act(async () => {
      onlineManager.setOnline(true)
      await new Promise(r => setTimeout(r, 50))
    })
    expect(m.paid).not.toHaveBeenCalled()
    // Y se puede volver a marcar: el candado se soltó.
    fireEvent.click(screen.getByRole('button', { name: /closed\.markPaidFor/ }))
    const otra = await screen.findByRole('button', { name: /closed\.markPaidConfirm/ })
    await waitFor(() => expect(otra).toBeEnabled())
    fireEvent.click(otra)
    await waitFor(() => expect(m.paid).toHaveBeenCalledTimes(1))
  })

  it('sin cancelar, al volver la red se manda una vez y se dice', async () => {
    const registrar = await abrirDialogo()
    onlineManager.setOnline(false)
    fireEvent.click(registrar)
    await screen.findByText('offline.willSend')
    await act(async () => {
      onlineManager.setOnline(true)
      await new Promise(r => setTimeout(r, 50))
    })
    await waitFor(() => expect(m.paid).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(m.toast).toHaveBeenCalledWith({ title: expect.stringContaining('closed.markedPaid') }))
  })
})

// G2 (hermano): abrir «marcar pagado» YA sin red dejaba el diálogo con «…» y el botón apagado, sin decir por qué.
describe('abrir marcar pagado ya sin red (G2)', () => {
  it('🔴 dice que el monto se calcula al volver la red, y al volver la red deja registrar', async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        <PeriodoCerradoView periodId="p9" fecha="2026-09-01" etiqueta="septiembre 2026" />
      </QueryClientProvider>,
    )
    const marcar = await screen.findByRole('button', { name: /closed\.markPaidFor/ })
    onlineManager.setOnline(false)
    fireEvent.click(marcar)
    expect(await screen.findByText('offline.willCalculate')).toBeInTheDocument()
    expect(m.preview).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /closed\.markPaidConfirm/ })).toBeDisabled()
    await act(async () => {
      onlineManager.setOnline(true)
      await new Promise(r => setTimeout(r, 50))
    })
    await waitFor(() => expect(screen.getByRole('button', { name: /closed\.markPaidConfirm/ })).toBeEnabled())
    expect(screen.queryByText('offline.willCalculate')).toBeNull()
  })
})
