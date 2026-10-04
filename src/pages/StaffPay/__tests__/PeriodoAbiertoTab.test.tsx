import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PeriodoAbiertoTab } from '../components/PeriodoAbiertoTab'

const m = vi.hoisted(() => ({ report: vi.fn(), can: vi.fn() }))

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: any) => (o ? `${k}:${JSON.stringify(o)}` : k) }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ allVenues: [{ id: 'v1', name: 'Prado Norte' }, { id: 'v2', name: 'BSF' }] }),
}))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatCalendarDate: (d: string) => d, formatDateTime: (d: string) => d }) }))
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

  it('con staffpay:close y sin vista parcial se ve «Cerrar periodo» y abre el cierre de ESE periodo', () => {
    m.report.mockReturnValue({ data: { ...base, parcial: false }, isLoading: false, isError: false, refetch: vi.fn() })
    render(<PeriodoAbiertoTab activa fecha="2026-10-01" etiqueta="octubre 2026" />)
    expect(m.report).toHaveBeenLastCalledWith({ offset: 0, limit: 50, sede: undefined, fecha: '2026-10-01' }, true)
    fireEvent.click(screen.getByRole('button', { name: 'period.close' }))
    expect(screen.getByText('cerrar-modal 2026-10-01')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /manualAdjust\.add/ }))
    expect(screen.getByText('ajuste-modal 2026-10-01')).toBeInTheDocument()
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

  it('la columna «Ajustes» muestra el bono o descuento de cada persona', () => {
    const conAjuste = { ...base.personas.items[0], ajustes: '-150.00' }
    m.report.mockReturnValue({ data: { ...base, personas: { ...base.personas, items: [conAjuste] } }, isLoading: false, isError: false, refetch: vi.fn() })
    render(<PeriodoAbiertoTab activa fecha="2026-10-01" />)
    expect(screen.getByText('period.columns.adjustments')).toBeInTheDocument()
    expect(screen.getByText(/-\$150\.00|−\$150\.00|\$-150\.00/)).toBeInTheDocument()
  })
})
