import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DiferenciasSection } from '../components/DiferenciasSection'
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
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatDateTime: (d: string) => `fecha(${d})` }) }))
vi.mock('../useNombreSede', () => ({ useNombreSede: () => (id: string) => `sede-${id}` }))
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
    expect(boton).toHaveAccessibleName(/Reformer/)
    abrir()
    // El diálogo nombra persona, monto y el mes destino; el recibo del origen no cambia.
    const dialogo = await screen.findByRole('alertdialog')
    expect(dialogo).toHaveTextContent('Ana Martínez')
    expect(dialogo).toHaveTextContent('+$40.00')
    expect(dialogo).toHaveTextContent(/differences\.goesTo/)
    expect(dialogo).toHaveTextContent('"destino":"octubre de 2026","origen":"agosto de 2026"')
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

  it('si ya estaba liquidada, lo dice como aviso neutro, no como un pago nuevo', async () => {
    m.settle.mockResolvedValue({ lineas: [{ staffId: 'a', amount: '40.00' }], yaLiquidada: true })
    pintar()
    abrir()
    await confirmar()
    await waitFor(() => expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'differences.alreadySettled' })))
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

  it('si la clase se movió de periodo, avisa y cierra el diálogo', async () => {
    m.settle.mockRejectedValueOnce({ response: { status: 409, data: { code: 'ORIGEN_CAMBIO' } } })
    pintar()
    abrir()
    await confirmar()
    await waitFor(() => expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'differences.moved' })))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
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
    expect(screen.getByRole('link', { name: 'period.resolveInTable' })).toHaveAttribute('href', '/venues/x/servicio-pago#tabla')
    expect(screen.getByRole('button', { name: /differences\.settleIn/ })).toBeDisabled()
  })

  it('una clase en excepción dice el motivo en ámbar, ofrece resolver y no se ofrece liquidar', () => {
    m.lista.mockReturnValue(lista([fila({ estadoClase: 'EXCEPCION', motivo: 'COACH_SIN_NIVEL', pendiente: null, corresponde: null })]))
    pintar()
    expect(screen.getByText('reasons.COACH_SIN_NIVEL')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'period.resolveInTable' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /differences\.settleFor/ })).not.toBeInTheDocument()
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
    expect(dialogo).toHaveTextContent('period.resolveNoCoach')
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
