import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PeriodosTab } from '../components/PeriodosTab'

const m = vi.hoisted(() => ({
  fetchNext: vi.fn(),
  periodicity: vi.fn(),
  lista: vi.fn(),
  estado: vi.fn(),
  refetch: vi.fn(),
  acceso: { actual: { enabled: true, activado: true, startDate: '2026-09-01', propinasEncendidas: false } as any },
  pedidos: vi.fn(),
}))

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: any) => (o ? `${k}:${JSON.stringify(o)}` : k) }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ venueTimezone: 'America/Mexico_City', formatCalendarDate: (d: string) => d }) }))
vi.mock('../components/PeriodoAbiertoTab', () => ({
  PeriodoAbiertoTab: ({ fecha, onYaCerrado }: { fecha: string; onYaCerrado?: () => void }) => (
    <div>
      abierto {fecha}
      <button type="button" onClick={onYaCerrado}>
        simular-ya-cerrado
      </button>
    </div>
  ),
}))
vi.mock('../components/PeriodoCerradoView', () => ({ PeriodoCerradoView: ({ periodId }: { periodId: string }) => <div>cerrado {periodId}</div> }))
// Select nativo: el Select de Radix no se deja manejar en jsdom.
vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, disabled, children }: any) => (
    <select aria-label="select" value={value} disabled={disabled} onChange={e => onValueChange(e.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
}))
vi.mock('@/hooks/useStaffPay', () => ({
  useStaffPayAccess: () => ({ data: m.acceso.actual }),
  useSetTips: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useStaffPayPeriods: (enabled: boolean) => {
    m.pedidos(enabled)
    return { data: m.lista(), isLoading: false, hasNextPage: true, fetchNextPage: m.fetchNext, isFetchingNextPage: false, refetch: m.refetch, ...m.estado() }
  },
  useSetPeriodicity: () => ({ mutateAsync: m.periodicity, isPending: false }),
}))
vi.mock('../components/ActivarPagoAlPersonal', () => ({ ActivarPagoAlPersonal: () => <div>activar</div> }))
vi.mock('../components/InterruptorPropinas', () => ({ InterruptorPropinas: ({ encendidas }: { encendidas: boolean }) => <div>propinas {String(encendidas)}</div> }))

const LISTA = {
  periodicidad: 'MONTHLY',
  puedeCambiarPeriodicidad: false,
  items: [
    { id: null, start: '2026-10-01', end: '2026-10-31', estado: 'OPEN', personas: 0, pagadas: 0, total: '0.00' },
    { id: 'p9', start: '2026-09-01', end: '2026-09-30', estado: 'CLOSED', personas: 4, pagadas: 2, total: '36620.00' },
  ],
  antesDe: '2026-09-01',
}

function VerUrl() {
  const l = useLocation()
  return <output data-testid="url">{`${l.search}${l.hash}`}</output>
}
const conUrl = (url = '/x#periodos') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <PeriodosTab activa />
      <VerUrl />
    </MemoryRouter>,
  )

beforeEach(() => {
  vi.clearAllMocks()
  m.lista.mockReturnValue(LISTA)
  m.estado.mockReturnValue({})
  m.acceso.actual = { enabled: true, activado: true, startDate: '2026-09-01', propinasEncendidas: false }
})

describe('PeriodosTab', () => {
  it('abre en el periodo abierto actual y explica por qué ya no se cambia la periodicidad', () => {
    conUrl()
    expect(screen.getByText('abierto 2026-10-01')).toBeInTheDocument()
    expect(screen.getByText('periods.periodicityLocked')).toBeInTheDocument()
  })

  it('con más de una página ofrece ver los periodos anteriores (nada se recorta en silencio)', () => {
    conUrl()
    fireEvent.click(screen.getByRole('button', { name: 'periods.loadOlder' }))
    expect(m.fetchNext).toHaveBeenCalled()
  })

  it('una quincena se nombra con sus días («1–15 de octubre de 2026»)', () => {
    m.lista.mockReturnValue({ ...LISTA, periodicidad: 'SEMIMONTHLY', items: [{ ...LISTA.items[0], end: '2026-10-15' }] })
    conUrl()
    expect(screen.getByRole('option', { name: /periods\.semimonthLabel/ })).toHaveTextContent('"desde":1,"hasta":15')
  })

  it('cambiar la frecuencia de pago pide confirmación antes de guardar', async () => {
    m.lista.mockReturnValue({ ...LISTA, puedeCambiarPeriodicidad: true })
    m.periodicity.mockResolvedValue({})
    conUrl()
    fireEvent.change(screen.getAllByLabelText('select')[1], { target: { value: 'SEMIMONTHLY' } })
    expect(m.periodicity).not.toHaveBeenCalled()
    expect(await screen.findByText('periods.changeHelp.SEMIMONTHLY')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /periods\.changeConfirm/ }))
    await waitFor(() => expect(m.periodicity).toHaveBeenCalledWith('SEMIMONTHLY'))
  })

  it('si el periodo se cerró y la lista ya se está recargando, no lanza otra recarga', () => {
    m.estado.mockReturnValue({ isFetching: true })
    conUrl()
    fireEvent.click(screen.getByRole('button', { name: 'simular-ya-cerrado' }))
    expect(m.refetch).not.toHaveBeenCalled()
  })

  it('si el periodo se cerró y nada recarga la lista, la recarga', () => {
    conUrl()
    fireEvent.click(screen.getByRole('button', { name: 'simular-ya-cerrado' }))
    expect(m.refetch).toHaveBeenCalled()
  })

  it('si recargar la lista falla con datos ya en pantalla, lo dice y deja reintentar (no un spinner eterno)', () => {
    m.estado.mockReturnValue({ isError: true })
    conUrl()
    expect(screen.getByText('periods.error')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'period.retry' }))
    expect(m.refetch).toHaveBeenCalled()
  })

  it('el periodo elegido se recuerda en la URL: al recargar con ?periodo= se ve ESE periodo (QA defecto 18)', () => {
    conUrl('/x?periodo=2026-09-01#periodos')
    expect(screen.getByText('cerrado p9')).toBeInTheDocument()
  })

  it('elegir un periodo lo escribe en la URL sin perder la pestaña', () => {
    conUrl()
    fireEvent.change(screen.getAllByLabelText('select')[0], { target: { value: '2026-09-01' } })
    expect(screen.getByText('cerrado p9')).toBeInTheDocument()
    expect(screen.getByTestId('url')).toHaveTextContent('?periodo=2026-09-01#periodos')
  })

  it('un ?periodo= que no está en la lista cae al periodo actual', () => {
    conUrl('/x?periodo=2020-01-01#periodos')
    expect(screen.getByText('abierto 2026-10-01')).toBeInTheDocument()
  })

  it('el selector cuenta los recibos pagados con plural por personas (QA defectos 13 y 16)', () => {
    conUrl()
    expect(screen.getByRole('option', { name: /periods\.closedPaid/ })).toHaveTextContent('"pagadas":2,"count":4')
  })

  it('un mes que ya terminó y no se cerró dice «Sin cerrar»; el periodo en curso sigue «Abierto»', () => {
    m.lista.mockReturnValue({
      ...LISTA,
      items: [
        { id: null, start: '2099-12-01', end: '2099-12-31', estado: 'OPEN', personas: 0, pagadas: 0, total: '0.00' },
        { id: null, start: '2025-11-01', end: '2025-11-30', estado: 'OPEN', personas: 0, pagadas: 0, total: '0.00' },
        { id: 'p8', start: '2025-10-01', end: '2025-10-31', estado: 'OPEN', personas: 1, pagadas: 0, total: '-150.00' },
      ],
    })
    conUrl()
    const opciones = screen.getAllByRole('option').map(o => [o.getAttribute('value'), o.textContent])
    expect(opciones).toContainEqual(['2099-12-01', expect.stringMatching(/periods\.open$/)])
    expect(opciones).toContainEqual(['2025-11-01', expect.stringMatching(/periods\.notClosed$/)])
    // Uno guardado (con un ajuste) que ya terminó tampoco está «Abierto»: falta cerrarlo.
    expect(opciones).toContainEqual(['2025-10-01', expect.stringMatching(/periods\.notClosed$/)])
  })

  it('sin activar, la pestaña explica y ofrece activar; no pide periodos (spec §11)', () => {
    m.acceso.actual = { enabled: true, activado: false, startDate: null, propinasEncendidas: false }
    conUrl()
    expect(screen.getByText('activar')).toBeInTheDocument()
    expect(m.pedidos).toHaveBeenCalledWith(false)
    expect(screen.queryByText(/abierto/)).toBeNull()
  })

  it('activado: dice desde cuándo y muestra el interruptor de propinas junto a la periodicidad', () => {
    m.lista.mockReturnValue(LISTA)
    conUrl()
    expect(screen.getByText(/activation\.activeSince/)).toHaveTextContent('2026-09-01')
    expect(screen.getByText('propinas false')).toBeInTheDocument()
    expect(m.pedidos).toHaveBeenCalledWith(true)
  })

  it('si la lista responde «sin activar» antes de que el acceso se refresque, ofrece activar en vez de un error (pre-flight E3a #3)', () => {
    m.lista.mockReturnValue(undefined)
    m.estado.mockReturnValue({ isError: true, error: { response: { status: 403, data: { error: 'not_activated', message: 'Activa pago al personal' } } } })
    conUrl()
    expect(screen.getByText('activar')).toBeInTheDocument()
    expect(screen.queryByText('periods.error')).toBeNull()
  })
})
