import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useParams: () => ({ orgId: 'org-1' }),
  }
})

vi.mock('@/hooks/use-current-organization', () => ({
  useCurrentOrganization: () => ({
    organization: { name: 'PlayTelecom' },
    orgId: 'org-1',
    orgSlug: 'playtelecom',
    basePath: '/wl/organizations/playtelecom',
    venues: [{ id: 'v1', name: 'Sucursal 1' }],
    hasSerializedInventory: true,
    isLoading: false,
    isOwner: true,
    error: null,
  }),
}))

vi.mock('@/hooks/use-access', () => ({ useAccess: vi.fn() }))
vi.mock('@/context/AuthContext', () => ({ useAuth: vi.fn() }))

vi.mock('@/components/date-range-picker', () => ({ DateRangePicker: () => null }))
vi.mock('../StockControl/components/ExportButton', () => ({ ExportButton: () => null }))
vi.mock('../StockControl/components/AssignToSupervisorDialog', () => ({
  AssignToSupervisorDialog: () => null,
}))
vi.mock('../StockControl/components/OrgBulkUploadDialog', () => ({
  OrgBulkUploadDialog: () => null,
}))
vi.mock('../StockControl/components/ReassignPromoterDialog', () => ({
  ReassignPromoterDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="reassign-dialog-open" /> : null,
}))
vi.mock('../StockControl/tabs/OrgResumenTab', () => ({ OrgResumenTab: () => <div data-testid="resumen-tab" /> }))
vi.mock('../StockControl/tabs/OrgCargasTab', () => ({ OrgCargasTab: () => null }))
vi.mock('../StockControl/tabs/OrgDetalleSimsTab', () => ({ OrgDetalleSimsTab: () => null }))
vi.mock('../StockControl/tabs/OrgPorSucursalTab', () => ({ OrgPorSucursalTab: () => null }))
vi.mock('../StockControl/tabs/OrgPorCategoriaTab', () => ({ OrgPorCategoriaTab: () => null }))
vi.mock('../StockControl/tabs/OrgSolicitudesTab', () => ({ OrgSolicitudesTab: () => null }))

const mockStockOverview = {
  summary: {
    totalSims: 100,
    available: 50,
    sold: 40,
    damaged: 5,
    returned: 5,
    rotacionPct: 40,
    totalCargas: 3,
    sucursalesInvolucradas: 2,
    categoriasActivas: 2,
    dateRange: { from: '2026-01-01', to: '2026-07-01' },
    generatedAt: '2026-07-01T00:00:00.000Z',
    lastActivity: { timestamp: '2026-07-01T00:00:00.000Z', venueName: 'Sucursal 1', action: 'UPLOAD' },
  },
  items: [],
  bulkGroups: [],
  aggregatesBySucursal: [],
  aggregatesByCategoria: [],
}

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[0] === 'org-stock-control') {
      return { data: mockStockOverview, isLoading: false, isError: false, error: null, refetch: vi.fn() }
    }
    return { data: 0, isLoading: false }
  },
}))

import { useAccess } from '@/hooks/use-access'
import { useAuth } from '@/context/AuthContext'
import OrgStockControlPage from '../OrgStockControlPage'

function renderPage() {
  return render(
    <MemoryRouter>
      <OrgStockControlPage />
    </MemoryRouter>,
  )
}

describe('OrgStockControlPage — Reasignar SIMs header button', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({ user: { role: 'VIEWER' }, staffInfo: null } as any)
    vi.mocked(useAccess).mockReturnValue({ can: () => false } as any)
  })

  it('renders "Reasignar SIMs" immediately before "Asignar SIMs" for an OWNER', () => {
    vi.mocked(useAuth).mockReturnValue({ user: { role: 'OWNER' }, staffInfo: null } as any)

    renderPage()

    const reassign = screen.getByRole('button', { name: 'Reasignar SIMs' })
    const asignar = screen.getByRole('button', { name: 'Asignar SIMs' })
    expect(reassign.compareDocumentPosition(asignar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('hides "Reasignar SIMs" for a role without the permission', () => {
    renderPage()

    expect(screen.queryByRole('button', { name: 'Reasignar SIMs' })).not.toBeInTheDocument()
  })

  it('shows "Reasignar SIMs" via the explicit sim-custody:reassign permission alone', () => {
    vi.mocked(useAccess).mockReturnValue({ can: (perm: string) => perm === 'sim-custody:reassign' } as any)

    renderPage()

    expect(screen.getByRole('button', { name: 'Reasignar SIMs' })).toBeInTheDocument()
  })

  it('shows "Reasignar SIMs" for an ADMIN role even without the explicit permission', () => {
    vi.mocked(useAuth).mockReturnValue({ user: { role: 'ADMIN' }, staffInfo: null } as any)

    renderPage()

    expect(screen.getByRole('button', { name: 'Reasignar SIMs' })).toBeInTheDocument()
  })

  it('opens ReassignPromoterDialog when clicked', () => {
    vi.mocked(useAuth).mockReturnValue({ user: { role: 'OWNER' }, staffInfo: null } as any)

    renderPage()

    expect(screen.queryByTestId('reassign-dialog-open')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reasignar SIMs' }))
    expect(screen.getByTestId('reassign-dialog-open')).toBeInTheDocument()
  })
})
