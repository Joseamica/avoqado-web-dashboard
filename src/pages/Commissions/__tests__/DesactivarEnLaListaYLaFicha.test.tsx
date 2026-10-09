// ft-graves, B1 (hermanos): «desactiva esta configuración» no tenía ningún botón. Ahora se desactiva (con confirmación) desde la
// ficha, la tarjeta de la lista y el editor; y un esquema desactivado no desaparece en silencio: queda en «Desactivados», donde se
// puede reactivar. Desactivar manda sólo `active`.
import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CommissionConfig } from '@/types/commission'
import CommissionConfigCard from '../components/CommissionConfigCard'
import CommissionConfigList from '../components/CommissionConfigList'
import CommissionConfigDetailPage from '../CommissionConfigDetailPage'

const m = vi.hoisted(() => ({
  editar: vi.fn(async (_input: unknown) => ({})),
  configs: [] as unknown[],
  config: null as unknown,
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/x', venue: null }) }))
vi.mock('@/hooks/use-role-config', () => ({ useRoleConfig: () => ({ getDisplayName: (r: string) => r }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/hooks/useCommissions', () => ({
  useUpdateCommissionConfig: () => ({ mutateAsync: m.editar, isPending: false }),
  useDeleteCommissionConfig: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCommissionConfigs: () => ({ data: m.configs }),
  useCommissionConfig: () => ({ data: m.config, isLoading: false }),
  useCommissionTiers: () => ({ data: [], isLoading: false }),
  useCommissionOverrides: () => ({ data: [], isLoading: false }),
}))
vi.mock('@/services/menu.service', () => ({ getMenuCategories: vi.fn(async () => []) }))
vi.mock('@/components/PermissionGate', () => ({ PermissionGate: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('@/components/billing/FeatureGate', () => ({ FeatureGate: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('../components/CommissionTierList', () => ({ default: () => null }))
vi.mock('../components/CommissionOverrideList', () => ({ default: () => null }))
vi.mock('../components/EditConfigDialog', () => ({ default: () => null }))

const ESQUEMA = {
  id: 'c1', venueId: 'v1', name: 'Bebidas 10%', priority: 1, recipient: 'SERVER', calcType: 'PERCENTAGE', defaultRate: 0.1,
  minAmount: null, maxAmount: null, includeTips: false, includeDiscount: false, includeTax: false, roleRates: null,
  filterByCategories: false, categoryIds: [], useGoalAsTier: false, goalBonusRate: null, attendanceLinked: false,
  attendanceLatePenaltyRate: null, effectiveFrom: '2026-09-01T06:00:00.000Z', effectiveTo: null, aggregationPeriod: 'MONTHLY',
  active: true, createdAt: '', updatedAt: '',
} as CommissionConfig

const enRuta = (elemento: ReactNode, entrada = '/venues/x/commissions') =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[entrada]}>
        <Routes>
          <Route path="/venues/x/commissions" element={elemento} />
          <Route path="/venues/x/commissions/config/:configId" element={<p>FICHA</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )

beforeEach(() => {
  vi.clearAllMocks()
  m.configs = []
  m.config = null
})

describe('desactivar desde la tarjeta de la lista', () => {
  it('🔴 pide confirmación, manda sólo `active: false` y NO abre la ficha', async () => {
    enRuta(<CommissionConfigCard config={ESQUEMA} source="venue" />)
    fireEvent.click(screen.getByRole('button', { name: 'config.deactivate' }))
    expect(m.editar).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByRole('button', { name: 'config.deactivateConfirm' }))
    await waitFor(() => expect(m.editar).toHaveBeenCalledWith({ configId: 'c1', data: { active: false } }))
    expect(screen.queryByText('FICHA')).toBeNull()
  })
})

describe('un esquema desactivado no desaparece en silencio', () => {
  it('🔴 sale en «Desactivados» con su tasa y se puede reactivar', async () => {
    m.configs = [ESQUEMA, { ...ESQUEMA, id: 'c2', name: 'Viejo 8%', defaultRate: 0.08, active: false }]
    enRuta(<CommissionConfigList effectiveConfigs={[{ config: ESQUEMA, source: 'venue' }]} isLoading={false} />)
    expect(screen.getByText('config.inactiveSection')).toBeInTheDocument()
    expect(screen.getByText('Viejo 8%')).toBeInTheDocument()
    expect(screen.getByText(/8\.00%/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'config.reactivate' }))
    fireEvent.click(await screen.findByRole('button', { name: 'config.reactivateConfirm' }))
    await waitFor(() => expect(m.editar).toHaveBeenCalledWith({ configId: 'c2', data: { active: true } }))
  })

  it('también cuando no queda ninguno activo (la lista vacía lo muestra)', () => {
    m.configs = [{ ...ESQUEMA, active: false }]
    enRuta(<CommissionConfigList effectiveConfigs={[]} isLoading={false} />)
    expect(screen.getByText('config.noConfigs')).toBeInTheDocument()
    expect(screen.getByText('Bebidas 10%')).toBeInTheDocument()
  })
})

describe('desactivar y reactivar desde la ficha', () => {
  const ficha = () =>
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/venues/x/commissions/config/c1']}>
          <Routes>
            <Route path="/venues/x/commissions/config/:configId" element={<CommissionConfigDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

  it('🔴 un esquema activo ofrece «Desactivar»', async () => {
    m.config = ESQUEMA
    ficha()
    fireEvent.click(screen.getByRole('button', { name: 'config.deactivate' }))
    fireEvent.click(await screen.findByRole('button', { name: 'config.deactivateConfirm' }))
    await waitFor(() => expect(m.editar).toHaveBeenCalledWith({ configId: 'c1', data: { active: false } }))
  })

  it('🔴 uno desactivado ofrece «Reactivar»', () => {
    m.config = { ...ESQUEMA, active: false }
    ficha()
    expect(screen.getByRole('button', { name: 'config.reactivate' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'config.deactivate' })).toBeNull()
  })
})
