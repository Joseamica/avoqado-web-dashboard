import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PeriodoCerradoView } from '../components/PeriodoCerradoView'

const m = vi.hoisted(() => ({ can: vi.fn(), paid: vi.fn(), toast: vi.fn(), reporte: vi.fn(), extra: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: any) => (o ? `${k}:${JSON.stringify(o)}` : k) }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: m.can }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatDate: (d: string) => d.slice(0, 10), formatCalendarDate: (d: string) => d }) }))
vi.mock('../useNombreSede', () => ({ useNombreSede: () => (id: string) => id }))
vi.mock('../components/DesglosePersona', () => ({ DesglosePersona: () => null }))
vi.mock('../components/AjusteManualModal', () => ({ AjusteManualModal: () => null }))
vi.mock('@/hooks/useStaffPay', () => ({
  useStaffPayReport: () => ({ data: m.reporte(), isLoading: false, isPlaceholderData: false, ...m.extra() }),
  useMarkPaid: () => ({ mutateAsync: m.paid, isPending: false }),
}))

const ANA = { staffId: 'a', staffName: 'Ana', payLevelName: 'Head Coach', venueIds: ['v1'], clases: 1, promedioLugares: 8, ajustes: '0.00', total: '570.00', pagadoEn: null }
const SOFIA = { staffId: 's', staffName: 'Sofía', payLevelName: 'Coach', venueIds: ['v1'], clases: 1, promedioLugares: 8, ajustes: '0.00', total: '480.00', pagadoEn: '2026-10-03T15:00:00Z' }
const REPORTE = {
  periodo: { start: '2026-09-01', end: '2026-09-30', estado: 'CLOSED', id: 'p9', periodicidad: 'MONTHLY' }, parcial: false, venueIds: ['v1'], truncado: false, huerfanas: 0,
  // `pagadas` es del periodo ENTERO (Codex R1-23); el fixture lo trae como el server (Codex R2-Nuevo 7).
  tarjetas: { total: '1050.00', clases: 2, personas: 2, pagadas: 1, excepciones: 0, excluidas: 0 },
  personas: { items: [ANA, SOFIA], total: 2, offset: 0, limit: 50 },
}

beforeEach(() => {
  vi.clearAllMocks()
  m.reporte.mockReturnValue(REPORTE)
  m.extra.mockReturnValue({})
})

describe('PeriodoCerradoView', () => {
  it('muestra quién está pagado y cuántos faltan', () => {
    m.can.mockReturnValue(true)
    render(<PeriodoCerradoView periodId="p9" fecha="2026-09-01" etiqueta="septiembre 2026" />)
    expect(screen.getByText(/closed\.paidOf/)).toHaveTextContent('"pagadas":1')
    expect(screen.getByText(/closed\.paidOn/)).toBeInTheDocument()
    expect(screen.getByText('closed.pending')).toBeInTheDocument()
  })
  it('marcar pagado pide confirmación CON el monto y manda el staffId', async () => {
    m.can.mockReturnValue(true)
    m.paid.mockResolvedValue({ marcados: 1 })
    render(<PeriodoCerradoView periodId="p9" fecha="2026-09-01" etiqueta="septiembre 2026" />)
    // El botón del renglón dice a quién (aria-label con el nombre).
    const boton = screen.getByRole('button', { name: /closed\.markPaidFor/ })
    expect(boton).toHaveAccessibleName(/Ana/)
    fireEvent.click(boton)
    expect(await screen.findByText(/closed\.markPaidTitle/)).toHaveTextContent('$570.00')
    const confirmar = screen.getByRole('button', { name: /closed\.markPaidConfirm/ })
    expect(confirmar).toHaveTextContent('$570.00')
    fireEvent.click(confirmar)
    await waitFor(() => expect(m.paid).toHaveBeenCalledWith({ staffId: 'a' }))
    expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringMatching(/closed\.markedPaid/) }))
  })
  it('si ya estaban marcados (marcados: 0), lo dice en vez de «0 recibos marcados»', async () => {
    m.can.mockReturnValue(true)
    m.paid.mockResolvedValue({ marcados: 0 })
    render(<PeriodoCerradoView periodId="p9" fecha="2026-09-01" etiqueta="septiembre 2026" />)
    fireEvent.click(screen.getByRole('button', { name: /closed\.markPaidFor/ }))
    fireEvent.click(await screen.findByRole('button', { name: /closed\.markPaidConfirm/ }))
    await waitFor(() => expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'closed.alreadyPaid' })))
  })
  it('el «Desglose» de cada renglón dice de quién es', () => {
    m.can.mockReturnValue(true)
    render(<PeriodoCerradoView periodId="p9" fecha="2026-09-01" etiqueta="septiembre 2026" />)
    expect(screen.getAllByRole('button', { name: /period\.detailTitle/ })[0]).toHaveAccessibleName(/Ana/)
  })
  it('en vista parcial no hay «Marcar todos» y una línea dice por qué', () => {
    m.can.mockReturnValue(true)
    m.reporte.mockReturnValue({ ...REPORTE, parcial: true })
    render(<PeriodoCerradoView periodId="p9" fecha="2026-09-01" etiqueta="septiembre 2026" />)
    expect(screen.queryByRole('button', { name: /closed\.markAllPaid/ })).toBeNull()
    expect(screen.getByText('closed.markAllPartial')).toBeInTheDocument()
  })
  it('marcar todos dice en el botón cuántos recibos se marcan y no manda staffId', async () => {
    m.can.mockReturnValue(true)
    m.paid.mockResolvedValue({ marcados: 1 })
    render(<PeriodoCerradoView periodId="p9" fecha="2026-09-01" etiqueta="septiembre 2026" />)
    fireEvent.click(screen.getByRole('button', { name: /closed\.markAllPaid/ }))
    const confirmar = await screen.findByRole('button', { name: /closed\.markAllPaidConfirm/ })
    expect(confirmar).toHaveTextContent('"count":1')
    fireEvent.click(confirmar)
    await waitFor(() => expect(m.paid).toHaveBeenCalledWith({}))
  })
  it('sin staffpay:close no hay acciones de pago, y lo explica', () => {
    m.can.mockImplementation((p: string) => p !== 'staffpay:close')
    render(<PeriodoCerradoView periodId="p9" fecha="2026-09-01" etiqueta="septiembre 2026" />)
    expect(screen.queryByRole('button', { name: /closed\.markPaidFor/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /closed\.markAllPaid/ })).toBeNull()
    expect(screen.getByText('closed.noPermission')).toBeInTheDocument()
  })
  it('el contador de pagadas es el GLOBAL del periodo aunque la página no traiga a nadie pagado (Codex R2-Nuevo 7)', () => {
    m.can.mockReturnValue(true)
    // Página con UNA persona pendiente (0 pagadas en la página); en el periodo entero hay 1 pagada de 3.
    m.reporte.mockReturnValue({ ...REPORTE, tarjetas: { ...REPORTE.tarjetas, personas: 3, pagadas: 1 }, personas: { items: [ANA], total: 3, offset: 0, limit: 50 } })
    render(<PeriodoCerradoView periodId="p9" fecha="2026-09-01" etiqueta="septiembre 2026" />)
    expect(screen.getByText(/closed\.paidOf/)).toHaveTextContent('"pagadas":1')
    expect(screen.getByText(/closed\.paidOf/)).toHaveTextContent('"personas":3')
  })
  it('recién cerrado, el reporte EN VIVO que queda en caché (misma llave) no se pinta como cerrado', () => {
    m.can.mockReturnValue(true)
    m.reporte.mockReturnValue({ ...REPORTE, periodo: { ...REPORTE.periodo, estado: 'OPEN' } })
    render(<PeriodoCerradoView periodId="p9" fecha="2026-09-01" etiqueta="septiembre 2026" />)
    expect(screen.queryByRole('button', { name: /closed\.markPaidFor/ })).toBeNull()
    expect(screen.queryByText(/closed\.paidOf/)).toBeNull()
  })
  it('si el reporte falla, explica y deja reintentar (nunca un esqueleto eterno)', () => {
    const refetch = vi.fn()
    m.can.mockReturnValue(true)
    m.reporte.mockReturnValue(undefined)
    m.extra.mockReturnValue({ isError: true, refetch })
    render(<PeriodoCerradoView periodId="p9" fecha="2026-09-01" etiqueta="septiembre 2026" />)
    expect(screen.getByText('period.error')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'period.retry' }))
    expect(refetch).toHaveBeenCalled()
  })
})
