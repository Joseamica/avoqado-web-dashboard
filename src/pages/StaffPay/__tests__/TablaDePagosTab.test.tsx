import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TablaDePagosTab } from '../components/TablaDePagosTab'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: any) => (o ? `${k}:${JSON.stringify(o)}` : k) }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ venueTimezone: 'America/Mexico_City' }) }))
vi.mock('@/components/PermissionGate', () => ({ PermissionGate: ({ children }: any) => <>{children}</> }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@tanstack/react-query', async () => ({ ...(await vi.importActual<any>('@tanstack/react-query')), useQuery: () => ({ data: { data: [] } }) }))
const PN_HC = [0, 430, 430, 430, 430, 460, 490, 530, 570, 610, 650]
vi.mock('@/hooks/useStaffPay', () => ({
  useStaffPayLevels: () => ({ data: [{ id: 'hc', name: 'Head Coach', sortOrder: 0, archivedAt: null }] }),
  useStaffPayAssignments: () => ({ data: [] }),
  useStaffPayTables: () => ({ data: [{ id: 't1', name: 'Todas', productIds: [], archivedFrom: null, vigente: { id: 'v', effectiveFrom: '2026-10-01', revision: 1, countMode: 'BOOKED', maxCount: 10, cells: PN_HC.map((amount, count) => ({ payLevelId: 'hc', count, amount })) } }] }),
  useCreateLevel: () => ({ mutate: vi.fn() }), useUpdateLevel: () => ({ mutate: vi.fn() }), useAssignLevel: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useCreateTable: () => ({ mutate: vi.fn() }), usePublishTable: () => ({ mutateAsync: vi.fn().mockResolvedValue({ clasesQueCambian: 14 }) }),
}))

describe('TablaDePagosTab', () => {
  beforeEach(() => vi.clearAllMocks())
  it('el simulador dice 8 lugares Head Coach = $570', () => {
    render(<TablaDePagosTab />)
    fireEvent.change(screen.getByLabelText('grid.simulatorSeats'), { target: { value: '8' } })
    expect(screen.getByTestId('simulator-result')).toHaveTextContent('570')
  })
  it('«Sólo quien llegó» se ve deshabilitado con su explicación', () => {
    render(<TablaDePagosTab />)
    expect(screen.getByLabelText('grid.attended')).toBeDisabled()
    expect(screen.getByText('grid.attendedHelp')).toBeInTheDocument()
  })
})
