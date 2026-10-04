import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PeriodoCerradoView } from '../components/PeriodoCerradoView'

const m = vi.hoisted(() => ({ can: vi.fn(), paid: vi.fn(), toast: vi.fn(), reporte: vi.fn(), extra: vi.fn(), preview: vi.fn(), refetchPreview: vi.fn(), ajuste: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: any) => (o ? `${k}:${JSON.stringify(o)}` : k) }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: m.can }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatDate: (d: string) => d.slice(0, 10), formatCalendarDate: (d: string) => d }) }))
vi.mock('../useNombreSede', () => ({ useNombreSede: () => (id: string) => id }))
vi.mock('../components/DesglosePersona', () => ({ DesglosePersona: () => null }))
vi.mock('../components/AjusteManualModal', () => ({
  AjusteManualModal: (p: unknown) => {
    m.ajuste(p)
    return null
  },
}))
vi.mock('@/hooks/useStaffPay', () => ({
  useStaffPayReport: () => ({ data: m.reporte(), isLoading: false, isPlaceholderData: false, ...m.extra() }),
  useMarkPaid: () => ({ mutateAsync: m.paid, isPending: false }),
  usePaidPreview: (...a: any[]) => m.preview(...a),
}))
const HUELLA_ANA = 'a'.repeat(64)
const HUELLA_TODOS = 'b'.repeat(64)
// El preview del server: `total` y `cantidad` de TODOS los pendientes (o del de esa persona), y su huella.
const previewDe = (staffId?: string) =>
  staffId
    ? { periodo: { start: '2026-09-01', end: '2026-09-30', estado: 'CLOSED' }, cantidad: 1, total: '570.00', recibos: [], huella: HUELLA_ANA }
    : { periodo: { start: '2026-09-01', end: '2026-09-30', estado: 'CLOSED' }, cantidad: 2, total: '1030.00', recibos: [], huella: HUELLA_TODOS }

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
  m.extra.mockReturnValue({ refetch: vi.fn() })
  m.preview.mockImplementation((_periodId: string, staffId: string | undefined, enabled: boolean) =>
    enabled ? { data: previewDe(staffId), isLoading: false, isFetching: false, isError: false, refetch: m.refetchPreview } : { data: undefined, isLoading: false },
  )
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
    // El monto y la huella salen del preview de ESA persona (server), no del renglón.
    expect(m.preview).toHaveBeenLastCalledWith('p9', 'a', true)
    await waitFor(() => expect(m.paid).toHaveBeenCalledWith({ staffId: 'a', huellaEsperada: HUELLA_ANA }))
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
  it('un total negativo lleva el mismo «−» que la columna de ajustes (QA defecto 14)', () => {
    m.can.mockReturnValue(true)
    m.reporte.mockReturnValue({ ...REPORTE, personas: { ...REPORTE.personas, items: [{ ...ANA, clases: 0, ajustes: '-150.00', total: '-150.00' }] } })
    render(<PeriodoCerradoView periodId="p9" fecha="2026-09-01" etiqueta="septiembre 2026" />)
    expect(screen.getAllByText('−$150.00')).toHaveLength(2)
    expect(screen.queryByText('-$150.00')).toBeNull()
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
  it('marcar todos dice CUÁNTO registra y de cuántos recibos (del server), y manda la huella sin staffId (Codex bloque A #6)', async () => {
    m.can.mockReturnValue(true)
    m.paid.mockResolvedValue({ marcados: 2 })
    render(<PeriodoCerradoView periodId="p9" fecha="2026-09-01" etiqueta="septiembre 2026" />)
    fireEvent.click(screen.getByRole('button', { name: /closed\.markAllPaid/ }))
    const confirmar = await screen.findByRole('button', { name: /closed\.markAllPaidConfirm/ })
    expect(m.preview).toHaveBeenLastCalledWith('p9', undefined, true)
    expect(confirmar).toHaveTextContent('"count":2')
    expect(confirmar).toHaveTextContent('$1,030.00')
    fireEvent.click(confirmar)
    await waitFor(() => expect(m.paid).toHaveBeenCalledWith({ huellaEsperada: HUELLA_TODOS }))
  })
  it('si los recibos cambiaron desde el preview, avisa, recarga el preview y no cierra el diálogo', async () => {
    m.can.mockReturnValue(true)
    m.paid.mockRejectedValue({ response: { status: 409, data: { code: 'HUELLA_CAMBIO', message: 'Los recibos cambiaron' } } })
    render(<PeriodoCerradoView periodId="p9" fecha="2026-09-01" etiqueta="septiembre 2026" />)
    fireEvent.click(screen.getByRole('button', { name: /closed\.markAllPaid/ }))
    fireEvent.click(await screen.findByRole('button', { name: /closed\.markAllPaidConfirm/ }))
    await waitFor(() => expect(m.refetchPreview).toHaveBeenCalled())
    expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'close.changed' }))
    expect(screen.getByRole('button', { name: /closed\.markAllPaidConfirm/ })).toBeInTheDocument()
  })
  it('tras HUELLA_CAMBIO también recarga la tabla de atrás, no sólo el diálogo (QA defecto 6)', async () => {
    const refetch = vi.fn()
    m.can.mockReturnValue(true)
    m.extra.mockReturnValue({ refetch })
    m.paid.mockRejectedValue({ response: { status: 409, data: { code: 'HUELLA_CAMBIO' } } })
    render(<PeriodoCerradoView periodId="p9" fecha="2026-09-01" etiqueta="septiembre 2026" />)
    fireEvent.click(screen.getByRole('button', { name: /closed\.markAllPaid/ }))
    fireEvent.click(await screen.findByRole('button', { name: /closed\.markAllPaidConfirm/ }))
    await waitFor(() => expect(refetch).toHaveBeenCalled())
    expect(m.refetchPreview).toHaveBeenCalled()
  })

  it('un ajuste desde el cerrado no se limita a las sedes de ESTE periodo: el modal lee las del periodo destino (QA defecto 7)', () => {
    m.can.mockReturnValue(true)
    render(<PeriodoCerradoView periodId="p9" fecha="2026-09-01" etiqueta="septiembre 2026" etiquetaAbierto="octubre de 2026" />)
    fireEvent.click(screen.getByRole('button', { name: /manualAdjust\.add/ }))
    const props = m.ajuste.mock.calls.at(-1)![0] as { fecha: string; sedes?: string[]; etiqueta?: string }
    expect(props.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(props.sedes).toBeUndefined()
    expect(props.etiqueta).toBeUndefined()
  })

  it('mientras el preview carga o recarga, el botón de confirmar está apagado', async () => {
    m.can.mockReturnValue(true)
    m.preview.mockImplementation((_p: string, _s: string | undefined, enabled: boolean) =>
      enabled ? { data: previewDe(), isLoading: false, isFetching: true, isError: false, refetch: m.refetchPreview } : { data: undefined },
    )
    render(<PeriodoCerradoView periodId="p9" fecha="2026-09-01" etiqueta="septiembre 2026" />)
    fireEvent.click(screen.getByRole('button', { name: /closed\.markAllPaid/ }))
    expect(await screen.findByRole('button', { name: /closed\.markAllPaidConfirm/ })).toBeDisabled()
  })
  it('si el preview falla, dice por qué, deja reintentar y no deja confirmar', async () => {
    m.can.mockReturnValue(true)
    m.preview.mockImplementation((_p: string, _s: string | undefined, enabled: boolean) =>
      enabled
        ? { data: undefined, isLoading: false, isFetching: false, isError: true, error: { response: { data: { message: 'Sin permiso en BSF' } } }, refetch: m.refetchPreview }
        : { data: undefined },
    )
    render(<PeriodoCerradoView periodId="p9" fecha="2026-09-01" etiqueta="septiembre 2026" />)
    fireEvent.click(screen.getByRole('button', { name: /closed\.markAllPaid/ }))
    expect(await screen.findByText('Sin permiso en BSF')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'period.retry' }))
    expect(m.refetchPreview).toHaveBeenCalled()
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
