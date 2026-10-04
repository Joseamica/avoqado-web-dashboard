import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DesglosePersona } from '../components/DesglosePersona'
import { ExcepcionesSheet, HuerfanasSheet } from '../components/ListasDelPeriodo'

const m = vi.hoisted(() => ({ detail: vi.fn(), exceptions: vi.fn(), orphans: vi.fn(), receipt: vi.fn(), download: vi.fn() }))

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: any) => (o ? `${k}:${JSON.stringify(o)}` : k) }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/x' }) }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ allVenues: [{ id: 'v1', name: 'Prado Norte' }] }) }))
vi.mock('@/utils/datetime', () => ({
  useVenueDateTime: () => ({ formatCalendarDate: (d: string) => d, formatDateTime: (d: string) => d }),
}))
vi.mock('@/hooks/useStaffPay', () => ({
  useStaffPayDetail: (...a: any[]) => m.detail(...a),
  useStaffPayExceptions: (...a: any[]) => m.exceptions(...a),
  useStaffPayOrphans: (...a: any[]) => m.orphans(...a),
  useStaffReceipt: (...a: any[]) => m.receipt(...a),
}))
vi.mock('@/services/staffPay.service', () => ({ staffPayService: { downloadReceipt: (...a: any[]) => m.download(...a) } }))

const clase = (id: string, extra: Record<string, unknown> = {}) => ({
  classSessionId: id,
  venueId: 'v1',
  productName: 'Spinning',
  startsAt: '2026-10-02T13:00:00Z',
  fechaLocal: '2026-10-02',
  staffId: 's1',
  staffName: 'Ana López',
  payLevelName: 'Head Coach',
  countMode: 'BOOKED',
  conteoCalculado: 8,
  conteo: 8,
  tieneAjuste: false,
  estado: 'OK',
  motivo: null,
  monto: '570.00',
  ...extra,
})
const q = (pages: any[], extra: Record<string, unknown> = {}) => ({
  data: { pages },
  isLoading: false,
  isError: false,
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: vi.fn(),
  refetch: vi.fn(),
  ...extra,
})

const renglon = (concepto: string, monto: string, tipo = 'CLASE') => ({ tipo, fecha: '2026-09-02', hora: '07:00', sede: 'Prado Norte', concepto, lugares: tipo === 'CLASE' ? 8 : null, monto })
const recibo = (renglones: any[], extra: Record<string, unknown> = {}) => ({
  data: { persona: 'Ana López', periodo: { id: 'p9', start: '2026-09-01', end: '2026-09-30', estado: 'CLOSED' }, renglones, total: '0.00', cantidad: renglones.length, siguiente: null, pagadoEn: null, parcial: false },
  isLoading: false,
  isError: false,
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: vi.fn(),
  refetch: vi.fn(),
  ...extra,
})

describe('DesglosePersona', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.receipt.mockReturnValue({ data: undefined, isLoading: false, isError: false, hasNextPage: false })
  })

  it('pide el desglose con la sede del filtro y une páginas sin repetir clases', () => {
    m.detail.mockReturnValue(
      q([
        { items: [clase('c1'), clase('c2', { estado: 'EXCEPCION', motivo: 'SIN_TABLA', monto: null })], nextCursor: 'x' },
        { items: [clase('c2', { estado: 'EXCEPCION', motivo: 'SIN_TABLA', monto: null })], nextCursor: null },
      ]),
    )
    render(<DesglosePersona staffId="s1" staffName="Ana López" clases={5} total="999.00" sede="v1" onClose={() => {}} />)
    expect(m.detail).toHaveBeenCalledWith('s1', 'v1', undefined, true)
    // El total viene del renglón del reporte, no de sumar las filas cargadas (la lista es paginada).
    expect(screen.getByText(/period\.detailSummary/)).toHaveTextContent('"count":5')
    expect(screen.getByText(/period\.detailSummary/)).toHaveTextContent('999.00')
    expect(screen.getAllByText('Spinning')).toHaveLength(2)
    expect(screen.getByText('reasons.SIN_TABLA')).toBeInTheDocument()
    expect(screen.getAllByText('Prado Norte').length).toBeGreaterThan(0)
  })

  it('si falla, explica y deja reintentar', () => {
    const refetch = vi.fn()
    m.detail.mockReturnValue(q([], { data: undefined, isError: true, refetch }))
    render(<DesglosePersona staffId="s1" staffName="Ana López" clases={0} total="0" onClose={() => {}} />)
    expect(screen.getByText('period.listError')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'period.retry' }))
    expect(refetch).toHaveBeenCalled()
  })

  it('cerrado lee el recibo, muestra el total del recibo ENTERO y ofrece «Cargar más» (Codex R2-R1-20)', () => {
    const fetchNextPage = vi.fn()
    m.detail.mockReturnValue(q([]))
    m.receipt.mockReturnValue(
      recibo([renglon('Spinning', '480.00'), renglon('Bono por cubrir', '100.00', 'AJUSTE')], { hasNextPage: true, fetchNextPage, data: { ...recibo([]).data, renglones: [renglon('Spinning', '480.00'), renglon('Bono por cubrir', '100.00', 'AJUSTE')], total: '680.00', cantidad: 3 } }),
    )
    render(<DesglosePersona staffId="s1" staffName="Ana López" clases={2} total="680.00" fecha="2026-09-01" cerrado onClose={() => {}} />)
    expect(m.receipt).toHaveBeenCalledWith('s1', '2026-09-01', true, undefined)
    expect(screen.getByText('Bono por cubrir')).toBeInTheDocument()
    expect(screen.getByText('+$100.00')).toBeInTheDocument()
    expect(screen.getByText('$680.00')).toBeInTheDocument()
    expect(screen.queryByText('$580.00')).toBeNull()
    expect(screen.getByText(/period\.shownOf/)).toHaveTextContent('"shown":2,"total":3')
    fireEvent.click(screen.getByRole('button', { name: 'period.loadMore' }))
    expect(fetchNextPage).toHaveBeenCalled()
  })

  it('un recibo de vista parcial NO se presenta como completo: «Total (vista parcial)» y por qué', () => {
    m.detail.mockReturnValue(q([]))
    m.receipt.mockReturnValue(recibo([renglon('Spinning', '480.00')], { data: { ...recibo([]).data, renglones: [renglon('Spinning', '480.00')], total: '480.00', cantidad: 1, parcial: true } }))
    render(<DesglosePersona staffId="s1" staffName="Ana López" clases={1} total="480.00" fecha="2026-09-01" cerrado onClose={() => {}} />)
    expect(screen.getByText('period.totalPartial')).toBeInTheDocument()
    expect(screen.queryByText('period.total')).toBeNull()
    expect(screen.getByText('period.receiptPartial')).toBeInTheDocument()
  })

  it('periodo abierto y recibo parcial: los ajustes también avisan que faltan sedes', () => {
    m.detail.mockReturnValue(q([{ items: [clase('c1')], nextCursor: null }]))
    m.receipt.mockReturnValue(recibo([renglon('Bono', '100.00', 'AJUSTE')], { data: { ...recibo([]).data, renglones: [renglon('Bono', '100.00', 'AJUSTE')], parcial: true } }))
    render(<DesglosePersona staffId="s1" staffName="Ana López" clases={1} total="670.00" fecha="2026-10-01" onClose={() => {}} />)
    expect(screen.getByText('period.receiptPartial')).toBeInTheDocument()
  })

  it('con filtro de sede, el recibo (ajustes) se pide con ESA sede: encabezado y renglones del mismo alcance (Codex bloque A #5)', () => {
    m.detail.mockReturnValue(q([{ items: [clase('c1')], nextCursor: null }]))
    m.receipt.mockReturnValue(recibo([]))
    render(<DesglosePersona staffId="s1" staffName="Ana López" clases={1} total="670.00" sede="v1" fecha="2026-10-01" onClose={() => {}} />)
    expect(m.receipt).toHaveBeenCalledWith('s1', '2026-10-01', true, 'v1')
    expect(m.detail).toHaveBeenCalledWith('s1', 'v1', '2026-10-01', true)
  })

  it('con periodo cerrado no pide el desglose en vivo (Codex R2-R1-21)', () => {
    m.detail.mockReturnValue(q([]))
    m.receipt.mockReturnValue(recibo([]))
    render(<DesglosePersona staffId="s1" staffName="Ana López" clases={0} total="0" fecha="2026-09-01" cerrado onClose={() => {}} />)
    expect(m.detail).toHaveBeenCalledWith('s1', undefined, '2026-09-01', false)
  })

  it('cerrado y con error del recibo: nunca un recibo de $0, explica y deja reintentar', () => {
    const refetch = vi.fn()
    m.detail.mockReturnValue(q([]))
    m.receipt.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: { response: { data: { message: 'Falló el recibo' } } }, hasNextPage: false, refetch })
    render(<DesglosePersona staffId="s1" staffName="Ana López" clases={0} total="0" fecha="2026-09-01" cerrado onClose={() => {}} />)
    expect(screen.getByText('Falló el recibo')).toBeInTheDocument()
    expect(screen.queryByText('$0.00')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'period.retry' }))
    expect(refetch).toHaveBeenCalled()
  })

  it('abierto conserva el desglose en vivo y agrega al final «Ajustes del periodo»', () => {
    m.detail.mockReturnValue(q([{ items: [clase('c1')], nextCursor: null }]))
    m.receipt.mockReturnValue(recibo([renglon('Spinning', '570.00'), renglon('Llegó tarde', '-150.00', 'AJUSTE')]))
    render(<DesglosePersona staffId="s1" staffName="Ana López" clases={1} total="420.00" fecha="2026-10-01" onClose={() => {}} />)
    expect(screen.getByText('period.periodAdjustments')).toBeInTheDocument()
    expect(screen.getByText('Llegó tarde')).toBeInTheDocument()
    expect(screen.getByText('−$150.00')).toBeInTheDocument()
  })

  it('recibo: «Concepto», un ajuste con su fecha de captura y las fechas con el formato del desglose en vivo (QA 9, 14, 15)', () => {
    m.detail.mockReturnValue(q([]))
    const ajuste = { ...renglon('Llegó tarde', '-150.00', 'AJUSTE'), fecha: '2026-10-03', hora: null }
    m.receipt.mockReturnValue(recibo([renglon('Spinning', '480.00'), ajuste], { data: { ...recibo([]).data, renglones: [renglon('Spinning', '480.00'), ajuste], total: '-150.00', cantidad: 2 } }))
    render(<DesglosePersona staffId="s1" staffName="Ana López" clases={1} total="-150.00" fecha="2026-09-01" cerrado onClose={() => {}} />)
    expect(screen.getByRole('columnheader', { name: 'period.detailColumns.concept' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'period.detailColumns.class' })).toBeNull()
    // El ajuste no es de un día de servicio: su fecha es la de captura, sin hora.
    expect(screen.getByText(/period\.capturedOn/)).toHaveTextContent('"fecha":"2026-10-03"')
    // La clase: «2 sep 2026, 7:00 a.m.», como formatDateTime del desglose en vivo (no «2 sep 2026 07:00»).
    expect(screen.getByText(/^2 sep 2026, 7:00/)).toBeInTheDocument()
    expect(screen.queryByText(/07:00/)).toBeNull()
    // El mismo «−» en el renglón y en el total (nunca el guion de Intl).
    expect(screen.getAllByText('−$150.00')).toHaveLength(2)
    expect(screen.queryByText('-$150.00')).toBeNull()
  })

  it('PDF y Excel se descargan con un clic explícito, del recibo de esa persona y ese periodo', async () => {
    m.detail.mockReturnValue(q([]))
    m.receipt.mockReturnValue(recibo([]))
    m.download.mockResolvedValue(undefined)
    render(<DesglosePersona staffId="s1" staffName="Ana López" clases={0} total="0" fecha="2026-09-01" cerrado onClose={() => {}} />)
    expect(m.download).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'period.receiptExcel' }))
    await waitFor(() => expect(m.download).toHaveBeenCalledWith('v1', 's1', '2026-09-01', 'xlsx', expect.stringContaining('Ana')))
  })

  it('en vista parcial el aviso de la exportación dice que sólo trae las sedes que puedes ver', () => {
    m.detail.mockReturnValue(q([]))
    m.receipt.mockReturnValue(recibo([], { data: { ...recibo([]).data, parcial: true } }))
    render(<DesglosePersona staffId="s1" staffName="Ana López" clases={0} total="0" sede="v1" fecha="2026-10-01" onClose={() => {}} />)
    expect(screen.getByText('period.receiptExportPartial')).toBeInTheDocument()
    expect(screen.queryByText('period.receiptAllVenues')).toBeNull()
  })

  it('con filtro de sede avisa que el PDF/Excel trae el recibo completo (no promete «sólo esta sede»)', () => {
    m.detail.mockReturnValue(q([]))
    m.receipt.mockReturnValue(recibo([]))
    render(<DesglosePersona staffId="s1" staffName="Ana López" clases={0} total="0" sede="v1" fecha="2026-10-01" onClose={() => {}} />)
    expect(screen.getByText('period.receiptAllVenues')).toBeInTheDocument()
  })
})

describe('ExcepcionesSheet', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lista cada clase con su motivo y «Cargar más» pide la siguiente página', () => {
    const fetchNextPage = vi.fn()
    m.exceptions.mockReturnValue(
      q([{ items: [clase('c3', { estado: 'EXCEPCION', motivo: 'COACH_SIN_NIVEL', monto: null })], nextCursor: 'n' }], {
        hasNextPage: true,
        fetchNextPage,
      }),
    )
    render(
      <MemoryRouter>
        <ExcepcionesSheet sede="v1" onClose={() => {}} />
      </MemoryRouter>,
    )
    expect(m.exceptions).toHaveBeenCalledWith('v1', undefined)
    expect(screen.getByText('reasons.COACH_SIN_NIVEL')).toBeInTheDocument()
    expect(screen.getByText('Ana López')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'period.loadMore' }))
    expect(fetchNextPage).toHaveBeenCalled()
  })

  it('cada excepción dice dónde se resuelve: la tabla lleva a la pestaña y cierra el panel; sin coach, al calendario', () => {
    const onClose = vi.fn()
    m.exceptions.mockReturnValue(
      q([
        {
          items: [
            clase('c4', { estado: 'EXCEPCION', motivo: 'SIN_MONTO_PARA_ESE_CONTEO', monto: null }),
            clase('c5', { estado: 'EXCEPCION', motivo: 'SIN_COACH', monto: null, staffId: null, staffName: null }),
          ],
          nextCursor: null,
        },
      ]),
    )
    render(
      <MemoryRouter>
        <ExcepcionesSheet onClose={onClose} />
      </MemoryRouter>,
    )
    const enlace = screen.getByRole('link', { name: 'period.resolveInTable' })
    expect(enlace).toHaveAttribute('href', '/venues/x/servicio-pago#tabla')
    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.getByText('period.resolveNoCoach')).toBeInTheDocument()
    fireEvent.click(enlace)
    expect(onClose).toHaveBeenCalled()
  })
})

describe('HuerfanasSheet', () => {
  it('muestra cuántas de cuántas y cada reserva', () => {
    m.orphans.mockReturnValue(
      q(
        [
          {
            items: [{ reservationId: 'r1', startsAt: '2026-10-03T15:00:00Z', venueId: 'v1', productName: 'Yoga', guestName: null }],
            total: 3,
          },
        ],
        { hasNextPage: true },
      ),
    )
    render(<HuerfanasSheet onClose={() => {}} />)
    expect(m.orphans).toHaveBeenCalledWith(undefined, undefined)
    expect(screen.getByText('Yoga')).toBeInTheDocument()
    expect(screen.getByText('period.noGuest')).toBeInTheDocument()
    expect(screen.getByText(/period.shownOf/)).toHaveTextContent('"shown":1,"total":3')
  })
})
