// G5 (hermano en la ficha del esquema): la ficha ya muestra el monto fijo en pesos, pero pintaba «Tasas por rol» en porcentaje
// también para un esquema FIJO, donde el servidor no las usa (paga el monto fijo por venta): se leían como si aplicaran.
import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CommissionConfigDetailPage from '../CommissionConfigDetailPage'

const m = vi.hoisted(() => ({ config: null as unknown }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/x' }) }))
vi.mock('@/hooks/use-role-config', () => ({ useRoleConfig: () => ({ getDisplayName: (r: string) => r }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/hooks/useCommissions', () => ({
  useCommissionConfig: () => ({ data: m.config, isLoading: false }),
  useCommissionTiers: () => ({ data: [], isLoading: false }),
  useCommissionOverrides: () => ({ data: [], isLoading: false }),
  useDeleteCommissionConfig: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('@/services/menu.service', () => ({ getMenuCategories: vi.fn(async () => []) }))
vi.mock('@/components/PermissionGate', () => ({ PermissionGate: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('@/components/billing/FeatureGate', () => ({ FeatureGate: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('../components/CommissionTierList', () => ({ default: () => null }))
vi.mock('../components/CommissionOverrideList', () => ({ default: () => null }))
vi.mock('../components/EditConfigDialog', () => ({ default: () => null }))

const BASE = {
  id: 'c1', venueId: 'v1', name: 'Esquema', priority: 1, recipient: 'SERVER', calcType: 'PERCENTAGE', defaultRate: 0.03,
  minAmount: null, maxAmount: null, includeTips: false, includeDiscount: false, includeTax: false, roleRates: null,
  filterByCategories: false, categoryIds: [], useGoalAsTier: false, goalBonusRate: null, attendanceLinked: false,
  attendanceLatePenaltyRate: null, effectiveFrom: '2026-09-01T06:00:00.000Z', effectiveTo: null, aggregationPeriod: 'MONTHLY',
  active: true, createdAt: '2026-09-01T06:00:00.000Z', updatedAt: '2026-09-01T06:00:00.000Z',
}
const pintar = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/venues/x/commissions/config/c1']}>
        <Routes>
          <Route path="/venues/x/commissions/config/:configId" element={<CommissionConfigDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )

beforeEach(() => {
  m.config = null
})

describe('ficha del esquema: tasas por rol (G5, hermano)', () => {
  it('🔴 un esquema fijo no muestra tasas por rol que el servidor no usa', () => {
    m.config = { ...BASE, calcType: 'FIXED', defaultRate: 5, roleRates: { WAITER: 0.03 } }
    pintar()
    expect(screen.queryByText('config.roleRates')).toBeNull()
    expect(screen.queryByText('3.00%')).toBeNull()
  })
  it('un esquema por porcentaje sí las muestra', () => {
    m.config = { ...BASE, roleRates: { WAITER: 0.025 } }
    pintar()
    expect(screen.getByText('config.roleRates')).toBeInTheDocument()
    expect(screen.getByText('2.50%')).toBeInTheDocument()
  })
})
