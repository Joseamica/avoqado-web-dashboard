// G5 (guía E6c): un esquema de MONTO FIJO de $5 («Comisión Fija Cajeros») salía en la tarjeta como «Tasa por Defecto 500.00%»:
// `defaultRate` de un fijo es el monto en pesos (el servidor paga ese monto por venta), no una tasa. Y sus «tasas por rol», que el
// servidor ignora en un fijo, tapaban el monto.
import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import CommissionConfigCard from '../components/CommissionConfigCard'
import type { CommissionConfig } from '@/types/commission'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/x' }) }))
vi.mock('@/hooks/use-role-config', () => ({ useRoleConfig: () => ({ getDisplayName: (r: string) => r }) }))
vi.mock('@/hooks/useCommissions', () => ({ useDeleteCommissionConfig: () => ({ mutateAsync: vi.fn(), isPending: false }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/services/menu.service', () => ({ getMenuCategories: vi.fn(async () => []) }))
vi.mock('@/components/PermissionGate', () => ({ PermissionGate: ({ children }: { children: ReactNode }) => <>{children}</> }))

const BASE: CommissionConfig = {
  id: 'c1', venueId: 'v1', name: 'Esquema', priority: 1, recipient: 'SERVER', calcType: 'PERCENTAGE', defaultRate: 0.03,
  minAmount: null, maxAmount: null, includeTips: false, includeDiscount: false, includeTax: false, roleRates: null,
  filterByCategories: false, categoryIds: [], useGoalAsTier: false, goalBonusRate: null, attendanceLinked: false,
  attendanceLatePenaltyRate: null, effectiveFrom: '2026-09-01T06:00:00.000Z', effectiveTo: null, aggregationPeriod: 'MONTHLY',
  active: true, createdAt: '2026-09-01T06:00:00.000Z', updatedAt: '2026-09-01T06:00:00.000Z',
} as CommissionConfig

const pintar = (c: Partial<CommissionConfig>) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <CommissionConfigCard config={{ ...BASE, ...c }} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
const enPesos = (n: string) => (s: string) => s.replace(/\s/g, '') === n

describe('CommissionConfigCard: la tasa de un esquema fijo (G5)', () => {
  it('🔴 un monto fijo de $5 se muestra en pesos, nunca «500.00%»', () => {
    pintar({ calcType: 'FIXED', defaultRate: 5, name: 'Comisión Fija Cajeros' })
    expect(screen.queryByText('500.00%')).toBeNull()
    expect(screen.getByText(enPesos('$5.00'))).toBeInTheDocument()
    expect(screen.getByText('wizard.step2.fixedAmount')).toBeInTheDocument()
    expect(screen.queryByText('config.defaultRate')).toBeNull()
  })
  it('🔴 en un fijo, las tasas por rol (que el servidor no usa) no tapan el monto', () => {
    pintar({ calcType: 'FIXED', defaultRate: 5, roleRates: { WAITER: 0.03 } })
    expect(screen.getByText(enPesos('$5.00'))).toBeInTheDocument()
    expect(screen.queryByText('3.00%')).toBeNull()
    expect(screen.queryByText('config.roleRates')).toBeNull()
  })
  it('un porcentaje sigue en porcentaje, con sus tasas por rol', () => {
    pintar({ calcType: 'PERCENTAGE', defaultRate: 0.03 })
    expect(screen.getByText('3.00%')).toBeInTheDocument()
    expect(screen.getByText('config.defaultRate')).toBeInTheDocument()
    pintar({ calcType: 'PERCENTAGE', roleRates: { WAITER: 0.025 } })
    expect(screen.getByText('2.50%')).toBeInTheDocument()
    expect(screen.getByText('config.roleRates')).toBeInTheDocument()
  })
  it('un escalonado (por niveles) muestra su tasa base en porcentaje', () => {
    pintar({ calcType: 'TIERED', defaultRate: 0.02 })
    expect(screen.getByText('2.00%')).toBeInTheDocument()
  })
})
