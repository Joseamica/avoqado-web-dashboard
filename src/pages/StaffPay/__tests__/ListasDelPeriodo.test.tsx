import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DesglosePersona } from '../components/DesglosePersona'
import { ExcepcionesSheet, HuerfanasSheet } from '../components/ListasDelPeriodo'

const m = vi.hoisted(() => ({ detail: vi.fn(), exceptions: vi.fn(), orphans: vi.fn() }))

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
}))

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

describe('DesglosePersona', () => {
  beforeEach(() => vi.clearAllMocks())

  it('pide el desglose con la sede del filtro y une páginas sin repetir clases', () => {
    m.detail.mockReturnValue(
      q([
        { items: [clase('c1'), clase('c2', { estado: 'EXCEPCION', motivo: 'SIN_TABLA', monto: null })], nextCursor: 'x' },
        { items: [clase('c2', { estado: 'EXCEPCION', motivo: 'SIN_TABLA', monto: null })], nextCursor: null },
      ]),
    )
    render(<DesglosePersona staffId="s1" staffName="Ana López" clases={5} total="999.00" sede="v1" onClose={() => {}} />)
    expect(m.detail).toHaveBeenCalledWith('s1', 'v1')
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
    expect(m.exceptions).toHaveBeenCalledWith('v1')
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
    expect(m.orphans).toHaveBeenCalledWith(undefined)
    expect(screen.getByText('Yoga')).toBeInTheDocument()
    expect(screen.getByText('period.noGuest')).toBeInTheDocument()
    expect(screen.getByText(/period.shownOf/)).toHaveTextContent('"shown":1,"total":3')
  })
})
