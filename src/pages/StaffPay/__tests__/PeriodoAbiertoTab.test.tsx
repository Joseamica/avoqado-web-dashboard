import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PeriodoAbiertoTab } from '../components/PeriodoAbiertoTab'

const m = vi.hoisted(() => ({ report: vi.fn(), can: vi.fn() }))

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: any) => (o ? `${k}:${JSON.stringify(o)}` : k) }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ allVenues: [{ id: 'v1', name: 'Prado Norte' }, { id: 'v2', name: 'BSF' }] }),
}))
vi.mock('@/utils/datetime', () => ({
  useVenueDateTime: () => ({ formatCalendarDate: (d: string) => d, formatDateTime: (d: string) => d, venueTimezone: 'America/Mexico_City' }),
}))
vi.mock('../components/DesglosePersona', () => ({ DesglosePersona: () => null }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: m.can }) }))
vi.mock('../components/CerrarPeriodoModal', () => ({ CerrarPeriodoModal: ({ fecha }: { fecha: string }) => <div>cerrar-modal {fecha}</div> }))
vi.mock('../components/AjusteManualModal', () => ({ AjusteManualModal: ({ fecha }: { fecha: string }) => <div>ajuste-modal {fecha}</div> }))
vi.mock('../components/ListasDelPeriodo', () => ({ ExcepcionesSheet: () => null, HuerfanasSheet: () => null, TABLA_PERIODO: 'w-full text-sm' }))
// Select nativo: el Select de Radix no se deja manejar en jsdom.
vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, children }: any) => (
    <select aria-label="venue-filter" value={value} onChange={e => onValueChange(e.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
}))
vi.mock('@/hooks/useStaffPay', () => ({ useStaffPayReport: (p: any, enabled: boolean) => m.report(p, enabled) }))

const base = {
  periodo: { start: '2026-10-01', end: '2026-10-31', periodicidad: 'MONTHLY' },
  parcial: true,
  truncado: false,
  venueIds: ['v1'],
  tarjetas: { total: '36620.00', clases: 72, personas: 4, excepciones: 2, excluidas: 0 },
  personas: {
    items: [{ staffId: 's1', staffName: 'Ana López', payLevelName: 'Head Coach', venueIds: ['v1'], clases: 20, promedioLugares: 8, total: '11370.00' }],
    total: 1,
    offset: 0,
    limit: 50,
  },
  huerfanas: 3,
}

describe('PeriodoAbiertoTab', () => {
  beforeEach(() => {
    m.report.mockReset()
    m.report.mockReturnValue({ data: base, isLoading: false, isError: false, refetch: vi.fn() })
    m.can.mockReturnValue(true)
  })

  it('muestra tarjetas, vista parcial, banner de excepciones y aviso de huérfanas', () => {
    render(<PeriodoAbiertoTab activa />)
    expect(screen.getByText('period.partial')).toBeInTheDocument()
    expect(screen.getByText(/period.exceptionsBanner/)).toHaveTextContent('"count":2')
    expect(screen.getByText(/period.orphans/)).toHaveTextContent('"count":3')
    expect(screen.getByText('Ana López')).toBeInTheDocument()
  })

  it('un recibo en negativo dice «Saldo en contra» y, sin clases, «Lugares promedio» es «—» (no 0) (QA B-6)', () => {
    const carlos = { staffId: 's2', staffName: 'Carlos Rodríguez', payLevelName: 'Coach', venueIds: ['v1'], clases: 0, promedioLugares: 0, total: '-360.00' }
    m.report.mockReturnValue({ data: { ...base, personas: { ...base.personas, items: [carlos] } }, isLoading: false, isError: false, refetch: vi.fn() })
    render(<PeriodoAbiertoTab activa />)
    const fila = screen.getByText('Carlos Rodríguez').closest('tr')!
    expect(fila).toHaveTextContent('period.negativeShort')
    expect(fila).toHaveTextContent('—')
    expect(fila).toHaveTextContent('−$360.00')
  })

  it('si el servidor truncó la lista de personas, lo dice (nunca lo esconde)', () => {
    m.report.mockReturnValue({ data: { ...base, truncado: true }, isLoading: false, isError: false, refetch: vi.fn() })
    render(<PeriodoAbiertoTab activa />)
    expect(screen.getByText('period.truncated')).toBeInTheDocument()
  })

  it('sin truncado no aparece el aviso', () => {
    render(<PeriodoAbiertoTab activa />)
    expect(screen.queryByText('period.truncated')).not.toBeInTheDocument()
  })

  it('el filtro de sede manda `sede` al reporte y «Todas» lo quita', () => {
    m.report.mockReturnValue({ data: { ...base, parcial: false, venueIds: ['v1', 'v2'] }, isLoading: false, isError: false, refetch: vi.fn() })
    render(<PeriodoAbiertoTab activa />)
    expect(m.report).toHaveBeenLastCalledWith({ offset: 0, limit: 50, sede: undefined }, true)
    const filtro = screen.getByLabelText('venue-filter')
    expect(screen.getByRole('option', { name: 'BSF' })).toBeInTheDocument()
    fireEvent.change(filtro, { target: { value: 'v2' } })
    expect(m.report).toHaveBeenLastCalledWith({ offset: 0, limit: 50, sede: 'v2' }, true)
    fireEvent.change(filtro, { target: { value: '__all__' } })
    expect(m.report).toHaveBeenLastCalledWith({ offset: 0, limit: 50, sede: undefined }, true)
  })

  it('si el reporte falla, explica y ofrece reintentar', () => {
    const refetch = vi.fn()
    m.report.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch })
    render(<PeriodoAbiertoTab activa />)
    expect(screen.getByText('period.error')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'period.retry' }))
    expect(refetch).toHaveBeenCalled()
  })

  it('con staffpay:close, sin vista parcial y el periodo ya terminado, «Cerrar periodo» abre el cierre de ESE periodo', () => {
    const terminado = { start: '2026-09-01', end: '2026-09-30', periodicidad: 'MONTHLY' }
    m.report.mockReturnValue({ data: { ...base, parcial: false, periodo: terminado }, isLoading: false, isError: false, refetch: vi.fn() })
    render(<PeriodoAbiertoTab activa fecha="2026-10-01" etiqueta="octubre 2026" />)
    expect(m.report).toHaveBeenLastCalledWith({ offset: 0, limit: 50, sede: undefined, fecha: '2026-10-01' }, true)
    fireEvent.click(screen.getByRole('button', { name: 'period.close' }))
    expect(screen.getByText('cerrar-modal 2026-10-01')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /manualAdjust\.add/ }))
    expect(screen.getByText('ajuste-modal 2026-10-01')).toBeInTheDocument()
  })

  it('si el periodo todavía no termina, «Cerrar» queda apagado y dice desde cuándo se podrá', () => {
    const enCurso = { start: '2099-12-01', end: '2099-12-31', periodicidad: 'MONTHLY' }
    m.report.mockReturnValue({ data: { ...base, parcial: false, periodo: enCurso }, isLoading: false, isError: false, refetch: vi.fn() })
    render(<PeriodoAbiertoTab activa fecha="2099-12-01" etiqueta="diciembre 2099" />)
    expect(screen.getByRole('button', { name: 'period.close' })).toBeDisabled()
    expect(screen.getByText(/period\.closeFrom/)).toHaveTextContent('2100-01-01')
  })

  it('si otro usuario ya lo cerró (el reporte llega CERRADO), avisa y pide refrescar la lista de periodos', () => {
    const onYaCerrado = vi.fn()
    m.report.mockReturnValue({ data: { ...base, periodo: { ...base.periodo, id: 'p10', estado: 'CLOSED' } }, isLoading: false, isError: false, refetch: vi.fn() })
    render(<PeriodoAbiertoTab activa fecha="2026-10-01" onYaCerrado={onYaCerrado} />)
    expect(onYaCerrado).toHaveBeenCalled()
    expect(screen.getByText('period.justClosed')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'period.close' })).toBeNull()
  })

  it('en vista parcial no se pinta «Cerrar periodo» y explica por qué', () => {
    render(<PeriodoAbiertoTab activa fecha="2026-10-01" etiqueta="octubre 2026" />)
    expect(screen.queryByRole('button', { name: 'period.close' })).toBeNull()
    expect(screen.getByText('period.closePartial')).toBeInTheDocument()
  })

  it('sin staffpay:close no hay «Cerrar» ni «Agregar ajuste», y dice a quién pedir el permiso', () => {
    m.can.mockImplementation((p: string) => p !== 'staffpay:close')
    m.report.mockReturnValue({ data: { ...base, parcial: false }, isLoading: false, isError: false, refetch: vi.fn() })
    render(<PeriodoAbiertoTab activa fecha="2026-10-01" etiqueta="octubre 2026" />)
    expect(screen.queryByRole('button', { name: 'period.close' })).toBeNull()
    expect(screen.queryByRole('button', { name: /manualAdjust\.add/ })).toBeNull()
    expect(screen.getByText('period.closeNoPermission')).toBeInTheDocument()
  })

  const vacio = (periodo: Record<string, unknown>) => ({
    data: { ...base, parcial: false, periodo, huerfanas: 0, tarjetas: { total: '0.00', clases: 0, personas: 0, excepciones: 0, excluidas: 0 }, personas: { items: [], total: 0, offset: 0, limit: 50 } },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  })

  it('un mes que ya pasó sin clases ni ajustes dice «Sin movimientos», no «Abierto» con trabajo pendiente (QA defecto 11)', () => {
    m.report.mockReturnValue(vacio({ start: '2025-11-01', end: '2025-11-30', periodicidad: 'MONTHLY' }))
    render(<PeriodoAbiertoTab activa fecha="2025-11-01" etiqueta="noviembre de 2025" />)
    expect(screen.getByText('period.noActivity')).toBeInTheDocument()
    expect(screen.getByText('period.noActivityEmpty')).toBeInTheDocument()
    expect(screen.queryByText('period.open')).toBeNull()
    expect(screen.queryByText('period.empty')).toBeNull()
  })

  it('el mes en curso sin clases todavía sigue «Abierto»', () => {
    m.report.mockReturnValue(vacio({ start: '2099-12-01', end: '2099-12-31', periodicidad: 'MONTHLY' }))
    render(<PeriodoAbiertoTab activa fecha="2099-12-01" />)
    expect(screen.getByText('period.open')).toBeInTheDocument()
    expect(screen.getByText('period.empty')).toBeInTheDocument()
  })

  it('un mes pasado con clases que no se pueden pagar NO es «Sin movimientos»', () => {
    const r = vacio({ start: '2025-11-01', end: '2025-11-30', periodicidad: 'MONTHLY' })
    r.data.tarjetas = { ...r.data.tarjetas, excepciones: 1 }
    m.report.mockReturnValue(r)
    render(<PeriodoAbiertoTab activa fecha="2025-11-01" />)
    expect(screen.getByText('period.open')).toBeInTheDocument()
  })

  it('la columna «Ajustes» muestra el bono o descuento de cada persona', () => {
    const conAjuste = { ...base.personas.items[0], ajustes: '-150.00' }
    m.report.mockReturnValue({ data: { ...base, personas: { ...base.personas, items: [conAjuste] } }, isLoading: false, isError: false, refetch: vi.fn() })
    render(<PeriodoAbiertoTab activa fecha="2026-10-01" />)
    expect(screen.getByText('period.columns.adjustments')).toBeInTheDocument()
    expect(screen.getByText(/-\$150\.00|−\$150\.00|\$-150\.00/)).toBeInTheDocument()
  })
})
