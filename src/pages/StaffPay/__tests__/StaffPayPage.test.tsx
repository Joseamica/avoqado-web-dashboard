import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StaffPayPage from '../StaffPayPage'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/x' }) }))
vi.mock('../components/TablaDePagosTab', () => ({ TablaDePagosTab: () => <div>tabla-tab</div> }))
vi.mock('../components/PeriodosTab', () => ({ PeriodosTab: () => <div>periodo-tab</div> }))
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
})
