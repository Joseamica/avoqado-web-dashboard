import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DiferenciasSection } from '../components/DiferenciasSection'
import { LiquidarDialog } from '../components/LiquidarDialog'
import type { FilaDiferenciaDto, PreviewLiquidacionDto } from '@/types/staffPay'

const m = vi.hoisted(() => ({
  can: vi.fn(),
  settle: vi.fn(),
  settleHook: vi.fn(),
  preview: vi.fn(),
  refetch: vi.fn(),
  toast: vi.fn(),
  lista: vi.fn(),
  fetchNextPage: vi.fn(),
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: any) => (o ? `${k}:${JSON.stringify(o)}` : k) }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: m.can }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/x' }) }))
vi.mock('@/utils/datetime', () => ({
  useVenueDateTime: () => ({ formatDateTime: (d: string) => `fecha(${d})`, formatCalendarDate: (d: string) => `dia(${d})` }),
}))
vi.mock('../useNombreSede', () => ({
  useNombreSede: () => (id: string) => `sede-${id}`,
  // La ruta de OTRA sede por su slug (Codex C4): el enlace a la clase va a SU sede.
  useRutaDeSede: () => (id: string) => `/venues/slug-${id}`,
}))
vi.mock('@/hooks/useStaffPay', () => ({
  useDifferences: (...a: unknown[]) => m.lista(...a),
  // Capturan sus argumentos (Preflight): así se puede afirmar con qué sede piden.
  useClassDifference: (...a: unknown[]) => m.preview(...a),
  useSettleDifference: (...a: unknown[]) => (m.settleHook(...a), { mutateAsync: m.settle, isPending: false }),
}))

// La clase es de OTRA sede ('v2'): el diálogo la pide y la liquida bajo su sede, no la del URL (Codex R1-18).
const fila = (extra: Partial<FilaDiferenciaDto> = {}): FilaDiferenciaDto => ({
  classSessionId: 'c1',
  venueId: 'v2',
  productName: 'Reformer',
  startsAt: '2026-08-04T14:00:00Z',
  fechaLocal: '2026-08-04',
  fechaValoracion: '2026-08-04',
  periodoOrigenId: 'p8',
  persona: 'a',
  personaNombre: 'Ana Martínez',
  coachActual: 'a',
  estadoClase: 'OK',
  motivo: null,
  corresponde: '610.00',
  congelado: '570.00',
  conciliado: '0.00',
  pendiente: '40.00',
  payLevelId: 'l',
  payLevelName: 'HC',
  tableVersionId: 'tv',
  countMode: 'BOOKED',
  conteo: 9,
  ...extra,
})
const HUELLA = 'h'.repeat(64)
const vista = (extra: Partial<PreviewLiquidacionDto> = {}): PreviewLiquidacionDto => ({
  periodoOrigen: { id: 'p8', start: '2026-08-01', end: '2026-08-31' },
  destino: { start: '2026-10-01', end: '2026-10-31', venueIds: ['v1', 'v2'] },
  sedeEnDestino: true,
  filas: [fila()],
  total: '40.00',
  bloqueada: false,
  huella: HUELLA,
  ...extra,
})
const lista = (items: FilaDiferenciaDto[], extra: Record<string, unknown> = {}) => ({
  data: { pages: [{ items, nextCursor: null, parcial: false }] },
  isLoading: false,
  isError: false,
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: m.fetchNextPage,
  refetch: vi.fn(),
  ...extra,
})
const conVista = (v: PreviewLiquidacionDto) =>
  m.preview.mockImplementation((_v: string, _s: string, enabled: boolean) =>
    enabled ? { data: v, isLoading: false, isFetching: false, isError: false, refetch: m.refetch } : { data: undefined, isLoading: false },
  )
const pintar = () =>
  render(
    <MemoryRouter>
      <DiferenciasSection periodId="p8" etiquetaAbierto="octubre de 2026" />
    </MemoryRouter>,
  )
const abrir = () => fireEvent.click(screen.getByRole('button', { name: /differences\.settleFor/ }))
const confirmar = async () =>
  fireEvent.click(await screen.findByRole('button', { name: /differences\.settleIn|differences\.addVenueAndSettle/ }))

beforeEach(() => {
  vi.clearAllMocks()
  m.can.mockReturnValue(true)
  m.lista.mockReturnValue(lista([fila()]))
  conVista(vista())
})

describe('DiferenciasSection', () => {
  it('lista la diferencia con signo, clase, fecha, sede y persona, y liquida con la huella del preview', async () => {
    m.settle.mockResolvedValue({ lineas: [{ staffId: 'a', amount: '40.00' }], yaLiquidada: false })
    pintar()
    expect(m.lista).toHaveBeenCalledWith('p8', true)
    expect(screen.getByText('+$40.00')).toBeInTheDocument()
    expect(screen.getByText('Ana Martínez')).toBeInTheDocument()
    // Clase, fecha (formato del módulo) y la sede por NOMBRE porque no es la del URL.
    expect(screen.getByText(/differences\.classLineVenue/)).toHaveTextContent(
      '"clase":"Reformer","fecha":"fecha(2026-08-04T14:00:00Z)","sede":"sede-v2"',
    )
    // El botón dice a qué mes va; su nombre accesible, de qué clase es.
    const boton = screen.getByRole('button', { name: /differences\.settleFor/ })
    expect(boton).toHaveTextContent('octubre de 2026')
    // WCAG 2.5.3: el nombre accesible lleva el texto visible («Liquidar en octubre de 2026») y luego la clase.
    expect(boton).toHaveAccessibleName(/differences\.settleFor.*"accion":"differences\.settleIn.*octubre de 2026.*Reformer/)
    abrir()
    // El diálogo nombra persona, monto y el mes destino; el recibo del origen no cambia.
    const dialogo = await screen.findByRole('alertdialog')
    expect(dialogo).toHaveTextContent('Ana Martínez')
    expect(dialogo).toHaveTextContent('+$40.00')
    // Positiva: se SUMA al recibo del mes destino; el del origen no cambia.
    expect(dialogo).toHaveTextContent('differences.addsTo:{"destino":"octubre de 2026"}')
    expect(dialogo).toHaveTextContent('differences.originUnchanged:{"origen":"agosto de 2026"}')
    expect(dialogo).not.toHaveTextContent('differences.subtractsFrom')
    await confirmar()
    await waitFor(() => expect(m.settle).toHaveBeenCalledWith(expect.objectContaining({ periodoOrigenId: 'p8', huellaEsperada: HUELLA })))
    expect(m.settle.mock.calls[0][0].solicitudId).toMatch(/^[A-Za-z0-9_.-]{8,100}$/)
    expect(m.settle.mock.calls[0][0].ampliarAlcance).toBeFalsy()
    // R1-18: el preview y la liquidación van bajo la sede de la CLASE ('v2').
    expect(m.preview).toHaveBeenCalledWith('v2', 'c1', true)
    expect(m.settleHook).toHaveBeenCalledWith('v2', 'c1')
    expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringMatching(/differences\.settled/) }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  })

  it('cada vez que se abre el diálogo nace otra clave: reabrir la misma clase no reusa la anterior', async () => {
    m.settle.mockResolvedValue({ lineas: [{ staffId: 'a', amount: '40.00' }], yaLiquidada: false })
    pintar()
    abrir()
    await confirmar()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    abrir()
    await confirmar()
    await waitFor(() => expect(m.settle).toHaveBeenCalledTimes(2))
    expect(m.settle.mock.calls[1][0].solicitudId).not.toBe(m.settle.mock.calls[0][0].solicitudId)
  })

  it('respuesta PERDIDA y reintento con la misma clave: «ya liquidada» es ÉXITO de este clic, con sus líneas (full-testing C11)', async () => {
    m.settle.mockRejectedValueOnce(new Error('Network Error'))
    m.settle.mockResolvedValueOnce({ lineas: [{ staffId: 'a', amount: '40.00' }], yaLiquidada: true })
    pintar()
    abrir()
    await confirmar()
    await waitFor(() => expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'differences.networkRetry' })))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    await confirmar()
    await waitFor(() => expect(m.settle).toHaveBeenCalledTimes(2))
    expect(m.settle.mock.calls[1][0].solicitudId).toBe(m.settle.mock.calls[0][0].solicitudId)
    await waitFor(() =>
      expect(m.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringMatching(/^differences\.settled:/),
          description: expect.stringContaining('Ana Martínez'),
        }),
      ),
    )
    expect(m.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'differences.alreadySettledElsewhere' }))
  })

  it('doble clic síncrono en confirmar manda UNA sola vez (candado síncrono)', async () => {
    let soltar: (v: unknown) => void = () => undefined
    m.settle.mockReturnValue(new Promise(r => (soltar = r)))
    pintar()
    abrir()
    const boton = await screen.findByRole('button', { name: /differences\.settleIn/ })
    fireEvent.click(boton)
    fireEvent.click(boton)
    expect(m.settle).toHaveBeenCalledTimes(1)
    soltar({ lineas: [], yaLiquidada: false })
  })

  it('«ya liquidada» SIN líneas (no había nada nuevo que pagar): aviso neutro, no un pago nuevo', async () => {
    m.settle.mockResolvedValue({ lineas: [], yaLiquidada: true })
    pintar()
    abrir()
    await confirmar()
    await waitFor(() => expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'differences.alreadySettledElsewhere' })))
    expect(m.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringMatching(/differences\.settled/) }))
    expect(m.toast.mock.calls[0][0].variant).toBeUndefined()
  })

  it('si los montos cambiaron, avisa, vuelve a pedir el preview, deja el diálogo abierto y reusa la MISMA clave', async () => {
    m.settle.mockRejectedValueOnce({ response: { status: 409, data: { code: 'HUELLA_CAMBIO' } } })
    pintar()
    abrir()
    await confirmar()
    await waitFor(() => expect(m.refetch).toHaveBeenCalled())
    expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'differences.changed' }))
    expect(screen.getByRole('alertdialog')).toHaveTextContent('differences.changedHelp')
    m.settle.mockResolvedValueOnce({ lineas: [], yaLiquidada: false })
    await confirmar()
    await waitFor(() => expect(m.settle).toHaveBeenCalledTimes(2))
    expect(m.settle.mock.calls[1][0].solicitudId).toBe(m.settle.mock.calls[0][0].solicitudId)
  })

  it('con el preview nuevo en la respuesta (details.preview) no hace otra vuelta al server', async () => {
    m.settle.mockRejectedValueOnce({
      response: { status: 409, data: { code: 'HUELLA_CAMBIO', details: { preview: vista({ total: '90.00' }) } } },
    })
    pintar()
    abrir()
    await confirmar()
    await waitFor(() => expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'differences.changed' })))
    expect(m.refetch).not.toHaveBeenCalled()
    // El título no se repite en la descripción; dice cuánto era y cuánto es (QA B-7).
    const aviso = m.toast.mock.calls.find(([a]) => a.title === 'differences.changed')![0]
    expect(aviso.description).toBe('differences.changedFromTo:{"antes":"+$40.00","ahora":"+$90.00"}')
    expect(screen.getByRole('alertdialog')).toHaveTextContent('"antes":"+$40.00","ahora":"+$90.00"')
  })

  it('si otra pantalla ya la liquidó (HUELLA_CAMBIO con nada pendiente), lo dice y cierra, sin «revisa»', async () => {
    const yaPagada = vista({ filas: [fila({ pendiente: '0.00', conciliado: '40.00' })], total: '0.00' })
    m.settle.mockRejectedValueOnce({ response: { status: 409, data: { code: 'HUELLA_CAMBIO', details: { preview: yaPagada } } } })
    pintar()
    abrir()
    await confirmar()
    await waitFor(() => expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'differences.alreadySettledElsewhere' })))
    expect(m.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'differences.changed' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  })

  it('si la lista se vacía con el diálogo abierto (otra pantalla liquidó), el diálogo NO desaparece con la sección', async () => {
    const r = pintar()
    abrir()
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    m.lista.mockReturnValue(lista([]))
    r.rerender(
      <MemoryRouter>
        <DiferenciasSection periodId="p8" etiquetaAbierto="octubre de 2026" />
      </MemoryRouter>,
    )
    expect(screen.queryByText('differences.title')).not.toBeInTheDocument()
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  })

  it('si la sede de la clase no está en el periodo destino, lo dice desde el principio y el botón suma la sede', async () => {
    conVista(vista({ sedeEnDestino: false }))
    m.settle.mockResolvedValue({ lineas: [{ staffId: 'a', amount: '40.00' }], yaLiquidada: false })
    pintar()
    abrir()
    const dialogo = await screen.findByRole('alertdialog')
    expect(dialogo).toHaveTextContent(/differences\.venueOutside/)
    expect(dialogo).toHaveTextContent('"sede":"sede-v2","destino":"octubre de 2026"')
    fireEvent.click(screen.getByRole('button', { name: 'differences.addVenueAndSettle' }))
    await waitFor(() => expect(m.settle).toHaveBeenCalledWith(expect.objectContaining({ ampliarAlcance: true })))
  })

  it('si la sede salió del destino entre el preview y la confirmación (400), ofrece sumarla y la segunda vez la suma', async () => {
    m.settle.mockRejectedValueOnce({ response: { status: 400, data: { code: 'SEDE_FUERA_DEL_PERIODO', message: 'Esa sede no está' } } })
    pintar()
    abrir()
    await confirmar()
    const sumar = await screen.findByRole('button', { name: 'differences.addVenueAndSettle' })
    expect(screen.getByRole('alertdialog')).toHaveTextContent(/differences\.venueOutside/)
    m.settle.mockResolvedValueOnce({ lineas: [{ staffId: 'a', amount: '40.00' }], yaLiquidada: false })
    fireEvent.click(sumar)
    await waitFor(() => expect(m.settle).toHaveBeenLastCalledWith(expect.objectContaining({ ampliarAlcance: true })))
  })

  it('si la clase se movió de periodo, avisa (con la lista) y cierra el diálogo', async () => {
    m.settle.mockRejectedValueOnce({ response: { status: 409, data: { code: 'ORIGEN_CAMBIO' } } })
    pintar()
    abrir()
    await confirmar()
    await waitFor(() =>
      expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'differences.moved', description: 'differences.movedHelp' })),
    )
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  })

  it('abierto desde la tarjeta de la clase, ORIGEN_CAMBIO no habla de una lista que no hay', async () => {
    m.settle.mockRejectedValueOnce({ response: { status: 409, data: { code: 'ORIGEN_CAMBIO' } } })
    const onClose = vi.fn()
    render(
      <MemoryRouter>
        <LiquidarDialog classVenueId="v2" sessionId="c1" desde="clase" onClose={onClose} />
      </MemoryRouter>,
    )
    await confirmar()
    await waitFor(() =>
      expect(m.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'differences.moved', description: 'differences.movedHelpClass' }),
      ),
    )
    expect(onClose).toHaveBeenCalled()
  })

  it('abierto desde la tarjeta con la clase bloqueada: dice qué botón usar AQUÍ, sin enlace a la misma clase', async () => {
    conVista(vista({ bloqueada: true, filas: [fila({ estadoClase: 'EXCEPCION', motivo: 'SIN_MONTO_PARA_ESE_CONTEO', pendiente: null })] }))
    render(
      <MemoryRouter>
        <LiquidarDialog classVenueId="v1" sessionId="c1" desde="clase" onClose={vi.fn()} />
      </MemoryRouter>,
    )
    const dialogo = await screen.findByRole('alertdialog')
    expect(dialogo).toHaveTextContent('differences.exitClassHere')
    expect(within(dialogo).queryByRole('link')).not.toBeInTheDocument()
  })

  it('una diferencia NEGATIVA se descuenta del recibo del mes destino; una mixta lo dice por persona', async () => {
    conVista(vista({ filas: [fila({ pendiente: '-570.00' })], total: '-570.00' }))
    const { unmount } = pintar()
    abrir()
    let dialogo = await screen.findByRole('alertdialog')
    expect(dialogo).toHaveTextContent('−$570.00')
    expect(dialogo).toHaveTextContent('differences.subtractsFrom:{"destino":"octubre de 2026"}')
    expect(dialogo).not.toHaveTextContent('differences.addsTo')
    unmount()
    const filas = [
      fila({ persona: 'a', personaNombre: 'Ana Martínez', pendiente: '-480.00' }),
      fila({ persona: 's', personaNombre: 'Sofía Ruiz', pendiente: '480.00' }),
    ]
    conVista(vista({ filas, total: '0.00' }))
    pintar()
    abrir()
    dialogo = await screen.findByRole('alertdialog')
    const personas = within(dialogo).getAllByRole('listitem')
    expect(personas[0]).toHaveTextContent('Ana Martínez')
    expect(personas[0]).toHaveTextContent('differences.subtractsFrom')
    expect(personas[1]).toHaveTextContent('Sofía Ruiz')
    expect(personas[1]).toHaveTextContent('differences.addsTo')
  })

  it('tras liquidar la ÚLTIMA diferencia (la sección desaparece), el foco va al encabezado del periodo, nunca al <body>', async () => {
    // La recarga llega ANTES de que resuelva la liquidación (el hook espera sus invalidaciones).
    m.settle.mockImplementation(async () => {
      m.lista.mockReturnValue(lista([]))
      return { lineas: [{ staffId: 'a', amount: '40.00' }], yaLiquidada: false }
    })
    render(
      <MemoryRouter>
        <h2 tabIndex={-1} data-staffpay-ancla>
          periodo
        </h2>
        <DiferenciasSection periodId="p8" etiquetaAbierto="octubre de 2026" />
      </MemoryRouter>,
    )
    const boton = screen.getByRole('button', { name: /differences\.settleFor/ })
    boton.focus()
    abrir()
    await confirmar()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(screen.queryByText('differences.title')).not.toBeInTheDocument()
    await waitFor(() => expect(document.activeElement).toHaveAttribute('data-staffpay-ancla'))
    expect(document.activeElement).not.toBe(document.body)
  })

  it('si quedan otras diferencias, el foco va al encabezado de la sección (la fila liquidada ya no está)', async () => {
    const otra = fila({ classSessionId: 'c2', productName: 'Barre', startsAt: '2026-08-05T14:00:00Z' })
    m.lista.mockReturnValue(lista([fila(), otra]))
    m.settle.mockImplementation(async () => {
      m.lista.mockReturnValue(lista([otra]))
      return { lineas: [{ staffId: 'a', amount: '40.00' }], yaLiquidada: false }
    })
    render(
      <MemoryRouter>
        <h2 tabIndex={-1} data-staffpay-ancla>
          periodo
        </h2>
        <DiferenciasSection periodId="p8" etiquetaAbierto="octubre de 2026" />
      </MemoryRouter>,
    )
    const boton = screen.getAllByRole('button', { name: /differences\.settleFor/ })[0]
    expect(boton).toHaveAccessibleName(/Reformer/)
    boton.focus()
    fireEvent.click(boton)
    await confirmar()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    await waitFor(() => expect(document.activeElement).toHaveTextContent('differences.title'))
  })

  it('si el server dice que la clase quedó en excepción, lo explica, ofrece resolver y no deja confirmar', async () => {
    m.settle.mockRejectedValueOnce({
      response: { status: 400, data: { code: 'CLASE_EN_EXCEPCION', message: 'Esta clase no se puede pagar todavía' } },
    })
    pintar()
    abrir()
    await confirmar()
    const dialogo = await screen.findByRole('alertdialog')
    await waitFor(() => expect(dialogo).toHaveTextContent('differences.blockedGeneric'))
    // La tabla no arregla una clase de un periodo cerrado (Codex C3): se resuelve en la clase, en SU sede (Codex C4).
    expect(dialogo).toHaveTextContent('differences.exitClass')
    expect(screen.queryByRole('link', { name: 'period.resolveInTable' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'differences.openClass' })).toHaveAttribute(
      'href',
      '/venues/slug-v2/reservations/calendar?clase=c1',
    )
    expect(screen.getByRole('button', { name: /differences\.settleIn/ })).toBeDisabled()
  })

  it('sin nivel: nombra a QUIÉN y desde cuándo, y lleva a la clase (no a la tabla) en su sede (QA B-5, Codex C3/C4)', () => {
    // Carlos sustituyó a Ana y no tenía nivel ese día: Ana (la original) primero, y el mensaje habla de Carlos.
    m.lista.mockReturnValue(
      lista([
        fila({
          persona: 'c',
          personaNombre: 'Carlos Rodríguez',
          coachActual: 'c',
          congelado: '0.00',
          estadoClase: 'EXCEPCION',
          motivo: 'COACH_SIN_NIVEL',
          pendiente: null,
          corresponde: null,
          fechaValoracion: '2026-07-15',
        }),
        fila({
          persona: 'a',
          personaNombre: 'Ana Martínez',
          coachActual: 'c',
          estadoClase: 'EXCEPCION',
          motivo: 'COACH_SIN_NIVEL',
          pendiente: null,
          corresponde: null,
          fechaValoracion: '2026-07-15',
        }),
      ]),
    )
    pintar()
    expect(screen.getByText('differences.noLevelFor:{"persona":"Carlos Rodríguez","fecha":"dia(2026-07-15)"}')).toBeInTheDocument()
    expect(screen.getByText('differences.exitClass')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'differences.openClass' })).toHaveAttribute(
      'href',
      '/venues/slug-v2/reservations/calendar?clase=c1',
    )
    expect(screen.queryByRole('link', { name: 'period.resolveInTable' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /differences\.settleFor/ })).not.toBeInTheDocument()
    const nombres = screen.getAllByText(/^(Ana Martínez|Carlos Rodríguez)$/).map(e => e.textContent)
    expect(nombres).toEqual(['Ana Martínez', 'Carlos Rodríguez'])
  })

  it('sin permiso para ajustar la clase, la trabada dice qué permiso falta (sin «Ajustar monto» ni enlace)', () => {
    m.can.mockImplementation((p: string) => p === 'staffpay:read')
    m.lista.mockReturnValue(lista([fila({ estadoClase: 'EXCEPCION', motivo: 'SIN_TABLA', pendiente: null, corresponde: null })]))
    pintar()
    expect(screen.getByText('differences.exitNoPermission')).toBeInTheDocument()
    expect(screen.queryByText('differences.exitClass')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'differences.openClass' })).not.toBeInTheDocument()
  })

  it('una clase que llegó tarde (sin ancla) se ajusta con staffpay:manage: ahí sí ofrece la salida', () => {
    m.can.mockImplementation((p: string) => p !== 'staffpay:close')
    m.lista.mockReturnValue(
      lista([fila({ periodoOrigenId: null, estadoClase: 'EXCEPCION', motivo: 'SIN_TABLA', pendiente: null, corresponde: null })]),
    )
    pintar()
    expect(screen.getByText('differences.exitClass')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'differences.openClass' })).toBeInTheDocument()
  })

  it('una diferencia dice POR QUÉ existe: conteo corregido (antes → ahora) y cambio de coach (QA B-4)', async () => {
    const filas = [
      fila({
        persona: 'c',
        personaNombre: 'Carlos Rodríguez',
        pendiente: '-440.00',
        causa: 'COACH_SALE',
        coachActualNombre: 'Ana Martínez',
      }),
      fila({
        persona: 'a',
        personaNombre: 'Ana Martínez',
        congelado: '0.00',
        pendiente: '530.00',
        causa: 'COACH_ENTRA',
        coachActualNombre: 'Ana Martínez',
      }),
      fila({
        classSessionId: 'c2',
        productName: 'Pilates',
        persona: 'a',
        personaNombre: 'Ana Martínez',
        causa: 'CONTEO',
        conteoCongelado: 8,
        conteo: 9,
      }),
    ]
    m.lista.mockReturnValue(lista(filas))
    conVista(vista({ filas: filas.slice(0, 2), total: '90.00' }))
    pintar()
    expect(screen.getByText('differences.cause.COACH_SALE:{"coach":"Ana Martínez"}')).toBeInTheDocument()
    expect(screen.getByText('differences.cause.COACH_ENTRA')).toBeInTheDocument()
    expect(screen.getByText('differences.cause.CONTEO:{"antes":8,"ahora":9}')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: /differences\.settleFor/ })[0])
    // Y en el diálogo, por persona; primero quien tenía la clase al cerrar (Carlos, congelado ≠ 0).
    const personas = within(await screen.findByRole('alertdialog')).getAllByRole('listitem')
    expect(personas[0]).toHaveTextContent('Carlos Rodríguez')
    expect(personas[0]).toHaveTextContent('differences.cause.COACH_SALE')
    expect(personas[1]).toHaveTextContent('differences.cause.COACH_ENTRA')
  })

  it('sin causa (server previo) no pinta nada de más', () => {
    pintar()
    expect(screen.queryByText(/differences\.cause\./)).not.toBeInTheDocument()
  })

  it('en el celular: clase → persona y monto → botón (el botón va DESPUÉS del monto, QA B-10)', () => {
    pintar()
    const monto = screen.getByText('+$40.00')
    const boton = screen.getByRole('button', { name: /differences\.settleFor/ })
    expect(monto.compareDocumentPosition(boton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('el encabezado que recibe el foco lo enseña con teclado (anillo focus-visible, QA B-11)', () => {
    pintar()
    const h = screen.getByText('differences.title')
    expect(h).toHaveAttribute('tabindex', '-1')
    expect(h.className).toMatch(/focus-visible:ring-2/)
  })

  it('el diálogo de una clase bloqueada dice el motivo y no deja confirmar', async () => {
    conVista(
      vista({
        bloqueada: true,
        filas: [fila({ estadoClase: 'EXCEPCION', motivo: 'SIN_COACH', pendiente: null, persona: null, personaNombre: null })],
      }),
    )
    pintar()
    abrir()
    const dialogo = await screen.findByRole('alertdialog')
    expect(dialogo).toHaveTextContent('differences.blocked')
    expect(dialogo).toHaveTextContent('reasons.SIN_COACH')
    expect(dialogo).toHaveTextContent('differences.exitNoCoach')
    expect(within(dialogo).getByRole('link', { name: 'differences.openClass' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /differences\.settleIn/ })).toBeDisabled()
  })

  it('una sustitución (−$480 y +$480, total cero) muestra a las dos personas y sí deja liquidar', async () => {
    const filas = [
      fila({ persona: 'a', personaNombre: 'Ana Martínez', pendiente: '-480.00' }),
      fila({ persona: 's', personaNombre: 'Sofía Ruiz', pendiente: '480.00' }),
    ]
    m.lista.mockReturnValue(lista(filas))
    conVista(vista({ filas, total: '0.00' }))
    pintar()
    expect(screen.getByText('−$480.00')).toBeInTheDocument()
    expect(screen.getByText('+$480.00')).toBeInTheDocument()
    // Un solo botón por clase, aunque tenga dos personas.
    expect(screen.getAllByRole('button', { name: /differences\.settleFor/ })).toHaveLength(1)
    abrir()
    expect(await screen.findByRole('button', { name: /differences\.settleIn/ })).toBeEnabled()
  })

  it('sin staffpay:close se ven los montos pero no el botón, y dice por qué', () => {
    m.can.mockImplementation((p: string) => p !== 'staffpay:close')
    pintar()
    expect(screen.getByText('+$40.00')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /differences\.settleFor/ })).not.toBeInTheDocument()
    expect(screen.getByText('differences.noPermission')).toBeInTheDocument()
  })

  it('sin diferencias no pinta nada; mientras carga tampoco', () => {
    m.lista.mockReturnValue(lista([]))
    const { container, unmount } = pintar()
    expect(container).toBeEmptyDOMElement()
    unmount()
    m.lista.mockReturnValue({ ...lista([]), data: undefined, isLoading: true })
    expect(pintar().container).toBeEmptyDOMElement()
  })

  it('si la lista falla, lo dice y deja reintentar (no se confunde con «no hay diferencias»)', () => {
    const refetch = vi.fn()
    m.lista.mockReturnValue({ ...lista([]), data: undefined, isError: true, refetch })
    pintar()
    expect(screen.getByText('differences.title')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'period.retry' }))
    expect(refetch).toHaveBeenCalled()
  })

  it('vista parcial: lo dice; y «Cargar más» pide la página siguiente', () => {
    m.lista.mockReturnValue({
      ...lista([fila()]),
      data: { pages: [{ items: [fila()], nextCursor: 'v2:c1:a', parcial: true }] },
      hasNextPage: true,
    })
    pintar()
    expect(screen.getByText('period.partial')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'period.loadMore' }))
    expect(m.fetchNextPage).toHaveBeenCalled()
  })

  it('si falla «Cargar más», lo dice junto al botón y deja reintentar (no es silencioso)', () => {
    m.lista.mockReturnValue({ ...lista([fila()]), hasNextPage: true, isError: true, isFetchNextPageError: true })
    pintar()
    // Lo cargado sigue a la vista; el aviso va abajo, con su «Reintentar».
    expect(screen.getByText('+$40.00')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('period.loadMoreError')
    fireEvent.click(screen.getByRole('button', { name: 'period.retry' }))
    expect(m.fetchNextPage).toHaveBeenCalled()
  })

  it('las clases salen por FECHA aunque el server las mande por id, también al «Cargar más»', () => {
    const tarde = fila({ classSessionId: 'c1', productName: 'Reformer', startsAt: '2026-08-20T14:00:00Z' })
    const temprano = fila({ classSessionId: 'c9', productName: 'Barre', startsAt: '2026-08-02T14:00:00Z' })
    const medio = fila({
      classSessionId: 'c5',
      productName: 'Yoga',
      startsAt: '2026-08-10T14:00:00Z',
      persona: 's',
      personaNombre: 'Sofía Ruiz',
    })
    m.lista.mockReturnValue({
      ...lista([]),
      data: {
        pages: [
          { items: [tarde, temprano], nextCursor: 'v2:c9:a', parcial: false },
          { items: [medio], nextCursor: null, parcial: false },
        ],
      },
    })
    pintar()
    const clases = screen.getAllByText(/differences\.classLine/).map(e => e.textContent)
    expect(clases.map(c => c?.match(/"clase":"(\w+)"/)?.[1])).toEqual(['Barre', 'Yoga', 'Reformer'])
  })

  it('una clase partida entre dos páginas se agrupa en un solo bloque y no repite personas', () => {
    m.lista.mockReturnValue({
      ...lista([]),
      data: {
        pages: [
          { items: [fila({ persona: 'a', personaNombre: 'Ana Martínez' })], nextCursor: 'v2:c1:a', parcial: false },
          {
            items: [
              fila({ persona: 'a', personaNombre: 'Ana Martínez' }),
              fila({ persona: 's', personaNombre: 'Sofía Ruiz', pendiente: '10.00' }),
            ],
            nextCursor: null,
            parcial: false,
          },
        ],
      },
    })
    pintar()
    expect(screen.getAllByText('Ana Martínez')).toHaveLength(1)
    expect(screen.getByText('Sofía Ruiz')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /differences\.settleFor/ })).toHaveLength(1)
  })
})
