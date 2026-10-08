import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StaffPayPage from '../StaffPayPage'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/x' }) }))
vi.mock('../components/TablaDePagosTab', () => ({ TablaDePagosTab: () => <div>tabla-tab</div> }))
vi.mock('../components/PeriodosTab', () => ({ PeriodosTab: () => <div>periodo-tab</div> }))
vi.mock('../components/SedesTab', () => ({ SedesTab: ({ activa }: { activa: boolean }) => <div>sedes-tab {String(activa)}</div> }))
vi.mock('@/components/billing/FeatureGate', () => ({
  FeatureGate: ({ feature, children }: any) => <div data-testid={`gate-${feature}`}>{children}</div>,
}))
const mockAccess = vi.fn()
vi.mock('@/hooks/useStaffPay', () => ({ useStaffPayAccess: () => mockAccess() }))

describe('StaffPayPage', () => {
  beforeEach(() => vi.clearAllMocks())
  it('apagado se VE y se EXPLICA (no desaparece)', () => {
    mockAccess.mockReturnValue({ data: { enabled: false }, isLoading: false })
    render(<MemoryRouter><StaffPayPage /></MemoryRouter>)
    expect(screen.getByRole('status')).toHaveTextContent('disabled.title')
    expect(screen.queryByText('tabla-tab')).toBeNull()
  })
  it('encendido muestra la pestaña de tabla por default', () => {
    mockAccess.mockReturnValue({ data: { enabled: true }, isLoading: false })
    render(<MemoryRouter><StaffPayPage /></MemoryRouter>)
    expect(screen.getByText('tabla-tab')).toBeInTheDocument()
  })
  it('sin el plan, lo apagado va dentro del cartel de planes de SERVICE_PAY (Pro o suelto, con su precio)', () => {
    mockAccess.mockReturnValue({ data: { enabled: false, activado: false, startDate: null, propinasEncendidas: false }, isLoading: false })
    render(<MemoryRouter><StaffPayPage /></MemoryRouter>)
    expect(screen.getByTestId('gate-SERVICE_PAY')).toContainElement(screen.getByRole('status'))
  })
  it('si el acceso no carga, no deja la página muda: aviso con el mensaje del servidor y Reintentar', () => {
    const refetch = vi.fn()
    mockAccess.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: { response: { data: { message: 'Sin permiso para ver esto' } } }, refetch })
    render(<MemoryRouter><StaffPayPage /></MemoryRouter>)
    expect(screen.getByRole('alert')).toHaveTextContent('Sin permiso para ver esto')
    fireEvent.click(screen.getByRole('button', { name: 'period.retry' }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })
  it('con el plan hay tres pestañas: Tabla, Periodos y Sedes', () => {
    mockAccess.mockReturnValue({ data: { enabled: true, activado: true, startDate: '2026-10-01', propinasEncendidas: false }, isLoading: false })
    render(<MemoryRouter initialEntries={['/x#sedes']}><StaffPayPage /></MemoryRouter>)
    expect(screen.getByRole('tab', { name: 'tabs.venues' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'tabs.table' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'tabs.periods' })).toBeInTheDocument()
    expect(screen.getByText('sedes-tab true')).toBeInTheDocument()
  })

  it('activado pero esta sede perdió el plan: el cartel y SÓLO la pestaña Sedes (desactivar no pide plan, r4.7)', () => {
    mockAccess.mockReturnValue({ data: { enabled: false, activado: true, startDate: '2026-10-01', propinasEncendidas: false }, isLoading: false })
    render(<MemoryRouter><StaffPayPage /></MemoryRouter>)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'tabs.table' })).toBeNull()
    expect(screen.getByText('sedes-tab true')).toBeInTheDocument()
  })

  it('sin el plan y sin activar: sólo el cartel, sin Sedes', () => {
    mockAccess.mockReturnValue({ data: { enabled: false, activado: false, startDate: null, propinasEncendidas: false }, isLoading: false })
    render(<MemoryRouter><StaffPayPage /></MemoryRouter>)
    expect(screen.queryByText(/sedes-tab/)).toBeNull()
  })

  it('si el acceso no carga y no hay mensaje del servidor, dice el genérico', () => {
    mockAccess.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: new Error('x'), refetch: vi.fn() })
    render(<MemoryRouter><StaffPayPage /></MemoryRouter>)
    expect(screen.getByRole('alert')).toHaveTextContent('errors.generic')
  })
})
