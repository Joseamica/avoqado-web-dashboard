import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PeriodoCerradoView } from '../components/PeriodoCerradoView'

const m = vi.hoisted(() => ({ can: vi.fn(), paid: vi.fn(), toast: vi.fn(), reporte: vi.fn(), extra: vi.fn(), preview: vi.fn(), refetchPreview: vi.fn(), ajuste: vi.fn(), difs: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: any) => (o ? `${k}:${JSON.stringify(o)}` : k) }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: m.can }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatDate: (d: string) => d.slice(0, 10), formatCalendarDate: (d: string) => d }) }))
vi.mock('../useNombreSede', () => ({ useNombreSede: () => (id: string) => id }))
vi.mock('../components/DesglosePersona', () => ({ DesglosePersona: () => null }))
// La sección pide su propia lista (useDifferences); aquí sólo importa que se monte con el periodo y el mes abierto.
vi.mock('../components/DiferenciasSection', () => ({
  DiferenciasSection: ({ periodId, etiquetaAbierto }: { periodId: string; etiquetaAbierto?: string }) => (
    <div>
      <h3 id="staffpay-diferencias" tabIndex={-1}>
        seccion
      </h3>
      diferencias {periodId} {etiquetaAbierto}
    </div>
  ),
}))
vi.mock('../components/AjusteManualModal', () => ({
  AjusteManualModal: (p: unknown) => {
    m.ajuste(p)
    return null
  },
}))
vi.mock('@/hooks/useStaffPay', () => ({
  useStaffPayReport: () => ({ data: m.reporte(), isLoading: false, isPlaceholderData: false, ...m.extra() }),
  // La MISMA consulta que usa la sección (aquí, para el aviso de arriba).
  useDifferences: () => m.difs(),
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
  m.difs.mockReturnValue({ data: undefined, hasNextPage: false })
  m.preview.mockImplementation((_periodId: string, staffId: string | undefined, enabled: boolean) =>
    enabled ? { data: previewDe(staffId), isLoading: false, isFetching: false, isError: false, refetch: m.refetchPreview } : { data: undefined, isLoading: false },
  )
})

describe('PeriodoCerradoView', () => {
  it('muestra quién está pagado y cuántos faltan', () => {
    m.can.mockReturnValue(true)
    render(<PeriodoCerradoView periodId="p9" fecha="2026-09-01" etiqueta="septiembre 2026" etiquetaAbierto="octubre de 2026" />)
    expect(screen.getByText(/closed\.paidOf/)).toHaveTextContent('"pagadas":1')
    // Debajo de los recibos, las diferencias de ESTE periodo, que se liquidan en el mes abierto.
    expect(screen.getByText('diferencias p9 octubre de 2026')).toBeInTheDocument()
    // El estado de pago va en su columna y, en el celular (columna oculta), debajo del nombre: el mismo texto dos veces.
    expect(screen.getAllByText(/closed\.paidOn/)).toHaveLength(2)
    expect(screen.getAllByText('closed.pending')).toHaveLength(2)
  })

  it('en el celular la tabla deja Persona (con su estado de pago), Total y la acción; lo demás se oculta (QA defecto 3)', () => {
    m.can.mockReturnValue(true)
    render(<PeriodoCerradoView periodId="p9" fecha="2026-09-01" etiqueta="septiembre 2026" />)
    const visiblesEnCelular = screen.getAllByRole('columnheader').filter(th => !th.className.includes('hidden'))
    expect(visiblesEnCelular.map(th => th.textContent)).toEqual(['period.columns.person', 'period.columns.total', ''])
    // Dentro de la celda de Persona va el estado, sólo para el celular.
    const ana = screen.getByText('Ana').closest('td')!
    expect(ana.querySelector('.md\\:hidden')).toHaveTextContent('closed.pending')
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
  it('doble clic en «Registrar $X» manda UNA sola vez (candado síncrono, full-testing C6)', async () => {
    m.can.mockReturnValue(true)
    let soltar: (v: unknown) => void = () => undefined
    m.paid.mockReturnValue(new Promise(r => (soltar = r)))
    render(<PeriodoCerradoView periodId="p9" fecha="2026-09-01" etiqueta="septiembre 2026" />)
    fireEvent.click(screen.getByRole('button', { name: /closed\.markPaidFor/ }))
    const confirmar = await screen.findByRole('button', { name: /closed\.markPaidConfirm/ })
    fireEvent.click(confirmar)
    fireEvent.click(confirmar)
    expect(m.paid).toHaveBeenCalledTimes(1)
    soltar({ marcados: 1 })
    await waitFor(() => expect(m.toast).toHaveBeenCalledTimes(1))
  })

  // E6a-fix2 C4 (full-testing E6a): recuperado de una respuesta perdida, el diálogo preguntaba «¿Registrar que le pagaste $0.00…?»
  // con «Ya no hay recibos pendientes». Si al releer ya está pagado, se cierra diciendo que ya estaba registrado.
  it('🔴 marcar pagado con la respuesta perdida y al releer YA está pagado: se cierra con «Ya estaba registrado»', async () => {
    m.can.mockReturnValue(true)
    m.paid.mockRejectedValue(new Error('Network Error'))
    m.refetchPreview.mockResolvedValue({ data: { ...previewDe('a'), cantidad: 0, total: '0.00' }, isError: false })
    render(<PeriodoCerradoView periodId="p9" fecha="2026-09-01" etiqueta="septiembre 2026" />)
    fireEvent.click(screen.getByRole('button', { name: /closed\.markPaidFor/ }))
    fireEvent.click(await screen.findByRole('button', { name: /closed\.markPaidConfirm/ }))
    await waitFor(() => expect(m.toast).toHaveBeenCalledWith({ title: 'closed.alreadyRecorded' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(m.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'closed.networkCheck' }))
  })

  it('🔴 un recibo ya pagado (nada pendiente) nunca pregunta «¿Registrar que le pagaste $0.00…?»', async () => {
    m.can.mockReturnValue(true)
    m.preview.mockImplementation((_p: string, staffId: string | undefined, enabled: boolean) =>
      enabled ? { data: { ...previewDe(staffId), cantidad: 0, total: '0.00' }, isLoading: false, isFetching: false, isError: false, refetch: m.refetchPreview } : { data: undefined, isLoading: false },
    )
    render(<PeriodoCerradoView periodId="p9" fecha="2026-09-01" etiqueta="septiembre 2026" />)
    fireEvent.click(screen.getByRole('button', { name: /closed\.markPaidFor/ }))
    const dialogo = await screen.findByRole('alertdialog')
    expect(dialogo).toHaveTextContent('closed.alreadyRecorded')
    expect(dialogo).not.toHaveTextContent(/closed\.markPaidTitle/)
    expect(dialogo).not.toHaveTextContent('$0.00')
  })

  it('«Marcar todos» con la respuesta PERDIDA: vuelve a pedir la tabla y el preview para mostrar lo que de verdad quedó (C7)', async () => {
    m.can.mockReturnValue(true)
    const refetchTabla = vi.fn()
    m.extra.mockReturnValue({ refetch: refetchTabla })
    m.paid.mockRejectedValue(new Error('Network Error'))
    render(<PeriodoCerradoView periodId="p9" fecha="2026-09-01" etiqueta="septiembre 2026" />)
    fireEvent.click(screen.getByRole('button', { name: 'closed.markAllPaid' }))
    fireEvent.click(await screen.findByRole('button', { name: /closed\.markAllPaidConfirm/ }))
    await waitFor(() => expect(m.refetchPreview).toHaveBeenCalled())
    expect(refetchTabla).toHaveBeenCalled()
    expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'closed.networkCheck' }))
    // El diálogo se queda: el preview nuevo dice cómo quedó (si ya se marcó, «Ya no hay recibos pendientes»).
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
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

  it('un recibo en NEGATIVO lo dice en su fila y «Marcar pagado» lo registra como saldado, sin «le pagaste −$360» (QA B-6)', async () => {
    m.can.mockReturnValue(true)
    const CARLOS = { ...ANA, staffId: 'c', staffName: 'Carlos Rodríguez', clases: 0, ajustes: '-360.00', total: '-360.00' }
    m.reporte.mockReturnValue({ ...REPORTE, personas: { ...REPORTE.personas, items: [CARLOS] } })
    m.preview.mockImplementation((_p: string, staffId: string | undefined, enabled: boolean) =>
      enabled ? { data: { ...previewDe(staffId), total: '-360.00' }, isLoading: false, isFetching: false, isError: false, refetch: m.refetchPreview } : { data: undefined },
    )
    m.paid.mockResolvedValue({ marcados: 1 })
    render(<PeriodoCerradoView periodId="p9" fecha="2026-09-01" etiqueta="septiembre 2026" />)
    expect(screen.getByText('period.negativeShort')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /closed\.markPaidFor/ }))
    expect(await screen.findByText(/closed\.settleNegativeTitle/)).toHaveTextContent('"nombre":"Carlos Rodríguez","monto":"−$360.00"')
    expect(screen.getByText('closed.settleNegativeHelp')).toBeInTheDocument()
    expect(screen.queryByText(/closed\.markPaidTitle/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'closed.settleNegativeConfirm' }))
    await waitFor(() => expect(m.paid).toHaveBeenCalledWith({ staffId: 'c', huellaEsperada: HUELLA_ANA }))
  })

  it('«Marcar todos» con un recibo en contra no enseña el neto: a quién se paga y quién queda en contra (pulido 3)', async () => {
    m.can.mockReturnValue(true)
    const mezcla = {
      periodo: { start: '2026-09-01', end: '2026-09-30', estado: 'CLOSED' },
      cantidad: 2,
      total: '210.00',
      recibos: [
        { staffId: 'a', nombre: 'Ana Martínez', total: '570.00' },
        { staffId: 'c', nombre: 'Carlos Rodríguez', total: '-360.00' },
      ],
      huella: HUELLA_TODOS,
    }
    m.preview.mockImplementation((_p: string, staffId: string | undefined, enabled: boolean) =>
      enabled && !staffId ? { data: mezcla, isLoading: false, isFetching: false, isError: false, refetch: m.refetchPreview } : { data: undefined },
    )
    m.paid.mockResolvedValue({ marcados: 2 })
    render(<PeriodoCerradoView periodId="p9" fecha="2026-09-01" etiqueta="septiembre 2026" />)
    fireEvent.click(screen.getByRole('button', { name: 'closed.markAllPaid' }))
    const dialogo = await screen.findByRole('alertdialog')
    expect(dialogo).toHaveTextContent('closed.paysOne:{"monto":"$570.00","nombre":"Ana Martínez"}')
    expect(dialogo).toHaveTextContent('closed.owesOne:{"nombre":"Carlos Rodríguez","monto":"$360.00"}')
    expect(dialogo).not.toHaveTextContent('$210.00')
    const boton = screen.getByRole('button', { name: /closed\.markAllMixedConfirm/ })
    expect(boton).toHaveTextContent('"count":2')
    fireEvent.click(boton)
    await waitFor(() => expect(m.paid).toHaveBeenCalledWith({ huellaEsperada: HUELLA_TODOS }))
  })

  it('«Marcar todos» con muchos recibos en cada signo da totales separados', async () => {
    m.can.mockReturnValue(true)
    const r = (staffId: string, total: string) => ({ staffId, nombre: staffId, total })
    const mezcla = {
      periodo: { start: '2026-09-01', end: '2026-09-30', estado: 'CLOSED' },
      cantidad: 4,
      total: '400.00',
      recibos: [r('a', '500.00'), r('b', '300.00'), r('c', '-150.00'), r('d', '-250.00')],
      huella: HUELLA_TODOS,
    }
    m.preview.mockImplementation((_p: string, staffId: string | undefined, enabled: boolean) =>
      enabled && !staffId ? { data: mezcla, isLoading: false, isFetching: false, isError: false, refetch: m.refetchPreview } : { data: undefined },
    )
    render(<PeriodoCerradoView periodId="p9" fecha="2026-09-01" etiqueta="septiembre 2026" />)
    fireEvent.click(screen.getByRole('button', { name: 'closed.markAllPaid' }))
    const dialogo = await screen.findByRole('alertdialog')
    expect(dialogo).toHaveTextContent('closed.paysMany:{"count":2,"monto":"$800.00"}')
    expect(dialogo).toHaveTextContent('closed.owesMany:{"count":2,"monto":"$400.00"}')
  })

  it('con diferencias por liquidar, un aviso arriba las cuenta (por clase) y lleva a la sección (QA B-12)', () => {
    m.can.mockReturnValue(true)
    const f = (classSessionId: string, persona: string) => ({ classSessionId, persona })
    m.difs.mockReturnValue({ data: { pages: [{ items: [f('c1', 'a'), f('c1', 's'), f('c2', 'a')], nextCursor: null, parcial: false }] }, hasNextPage: false })
    render(<PeriodoCerradoView periodId="p9" fecha="2026-09-01" etiqueta="septiembre 2026" />)
    const aviso = screen.getByRole('button', { name: /differences\.banner/ })
    expect(aviso).toHaveTextContent('"count":2')
    fireEvent.click(aviso)
    expect(document.activeElement).toHaveTextContent('seccion')
  })

  it('sin diferencias no hay aviso; con más páginas dice «más de»', () => {
    m.can.mockReturnValue(true)
    const { unmount } = render(<PeriodoCerradoView periodId="p9" fecha="2026-09-01" etiqueta="septiembre 2026" />)
    expect(screen.queryByRole('button', { name: /differences\.banner/ })).not.toBeInTheDocument()
    unmount()
    m.difs.mockReturnValue({ data: { pages: [{ items: [{ classSessionId: 'c1', persona: 'a' }], nextCursor: 'x', parcial: false }] }, hasNextPage: true })
    render(<PeriodoCerradoView periodId="p9" fecha="2026-09-01" etiqueta="septiembre 2026" />)
    expect(screen.getByRole('button', { name: /differences\.bannerMore/ })).toHaveTextContent('"n":1')
  })

  it('el encabezado del periodo (ancla del foco) enseña el foco con teclado (QA B-11)', () => {
    m.can.mockReturnValue(true)
    render(<PeriodoCerradoView periodId="p9" fecha="2026-09-01" etiqueta="septiembre 2026" />)
    expect(document.querySelector('[data-staffpay-ancla]')!.className).toMatch(/focus-visible:ring-2/)
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
    const props = m.ajuste.mock.calls[m.ajuste.mock.calls.length - 1][0] as { fecha: string; sedes?: string[]; etiqueta?: string }
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

  it('con comisiones, su tarjeta y su columna; sin propinas, ninguna de las dos; sin nombre, «Persona dada de baja»', () => {
    m.can.mockReturnValue(true)
    m.reporte.mockReturnValue({
      ...REPORTE,
      tarjetas: { ...REPORTE.tarjetas, comisiones: '90.00', propinas: '0.00' },
      personas: { ...REPORTE.personas, items: [{ ...ANA, comisiones: '90.00', propinas: '0.00' }, { ...SOFIA, staffName: '' }] },
    })
    render(<PeriodoCerradoView periodId="p9" fecha="2026-09-01" etiqueta="septiembre 2026" etiquetaAbierto="octubre de 2026" />)
    expect(screen.getByText('period.cards.commissions')).toBeInTheDocument()
    expect(screen.getByText('period.columns.commissions')).toBeInTheDocument()
    expect(screen.queryByText('period.columns.tips')).toBeNull()
    expect(screen.queryByText('period.cards.tips')).toBeNull()
    expect(screen.getByText('period.formerStaff')).toBeInTheDocument()
  })
  it('una persona sin comisiones dice «—» en la columna; una devolución neta sale con «−» (pre-flight E5a)', () => {
    m.can.mockReturnValue(true)
    m.reporte.mockReturnValue({
      ...REPORTE,
      tarjetas: { ...REPORTE.tarjetas, comisiones: '50.00', propinas: '0.00' },
      personas: { ...REPORTE.personas, items: [{ ...ANA, comisiones: '-40.00' }, { ...SOFIA, comisiones: '0.00' }] },
    })
    render(<PeriodoCerradoView periodId="p9" fecha="2026-09-01" etiqueta="septiembre 2026" />)
    const col = screen.getAllByRole('columnheader').findIndex(th => th.textContent === 'period.columns.commissions')
    const celda = (nombre: string) => screen.getByText(nombre).closest('tr')!.querySelectorAll('td')[col]
    expect(celda('Ana')).toHaveTextContent('−$40.00')
    expect(celda('Sofía').textContent).toBe('—')
  })
  it('el literal «Persona dada de baja» del server se traduce en la fila, en el «Desglose» y en «Marcar pagado» (pre-flight E5a #2)', () => {
    m.can.mockReturnValue(true)
    m.reporte.mockReturnValue({ ...REPORTE, personas: { ...REPORTE.personas, items: [{ ...ANA, staffName: 'Persona dada de baja' }] } })
    render(<PeriodoCerradoView periodId="p9" fecha="2026-09-01" etiqueta="septiembre 2026" />)
    expect(screen.queryByText('Persona dada de baja')).toBeNull()
    expect(screen.getByRole('button', { name: /period\.detailTitle/ })).toHaveAccessibleName(/period\.formerStaff/)
    expect(screen.getByRole('button', { name: /closed\.markPaidFor/ })).toHaveAccessibleName(/period\.formerStaff/)
  })
  it('un 409 con texto del server (LECTURA_VENCIDA) dice ESE texto, no el genérico (pre-flight E5a #4)', () => {
    m.can.mockReturnValue(true)
    m.reporte.mockReturnValue(undefined)
    const error = { response: { status: 409, data: { code: 'LECTURA_VENCIDA', message: 'La consulta tardó demasiado y se canceló; intenta de nuevo en un momento' } } }
    m.extra.mockReturnValue({ isError: true, error, refetch: vi.fn() })
    render(<PeriodoCerradoView periodId="p9" fecha="2026-09-01" etiqueta="septiembre 2026" />)
    expect(screen.getByRole('alert')).toHaveTextContent('La consulta tardó demasiado y se canceló; intenta de nuevo en un momento')
    expect(screen.queryByText('period.error')).toBeNull()
  })
})
