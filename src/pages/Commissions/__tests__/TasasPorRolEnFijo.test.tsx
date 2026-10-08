// Duda 2 de la Parte 1b: el asistente ofrecía «Tasas por rol» también en un esquema de MONTO FIJO, donde el servidor las ignora (paga el
// monto fijo por venta, `commission-calculation.service.ts`: FIXED ⇒ `defaultRate`). Ofrecer algo que no tiene efecto es un defecto: en
// fijo no se ofrecen (se dice por qué) y no se guardan.
import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import type { CommissionConfig } from '@/types/commission'
import { tasasPorRolAGuardar } from '../tasaDelEsquema'
import CommissionAdvancedConfig from '../components/wizard/CommissionAdvancedConfig'
import RoleRatesCard from '../components/setup-panel/cards/RoleRatesCard'
import { initialState } from '../components/setup-panel/useSetupReducer'
import EditConfigDialog from '../components/EditConfigDialog'
import StepConfirm from '../components/wizard/StepConfirm'
import type { WizardData } from '../components/wizard/CreateCommissionWizard'

const m = vi.hoisted(() => ({ mutateAsync: vi.fn(async (_input: unknown) => ({})) }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/x' }) }))
vi.mock('@/hooks/use-role-config', () => {
  const activeRoles = [{ role: 'WAITER' }, { role: 'CASHIER' }, { role: 'MANAGER' }]
  const valor = { activeRoles, getDisplayName: (r: string) => r }
  return { useRoleConfig: () => valor, default: () => valor }
})
vi.mock('@/hooks/useCommissions', () => ({ useUpdateCommissionConfig: () => ({ mutateAsync: m.mutateAsync, isPending: false }) }))
vi.mock('@/services/team.service', () => ({ teamService: { getTeamMembers: vi.fn(async () => ({ data: [] })) } }))
vi.mock('../components/wizard/LiveExample', () => ({ default: () => null, TieredExample: () => null }))
vi.mock('../components/wizard/CategoryFilter', () => ({ default: () => null }))

const envolver = ({ children }: { children: ReactNode }) => <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>

const DATOS = {
  recipient: 'SERVER', calcType: 'PERCENTAGE', defaultRate: 0.03, fixedAmount: 5, includeTax: false, includeTips: false,
  includeDiscount: false, filterByCategories: false, categoryIds: [], useGoalAsTier: false, goalBonusRate: 0.06,
  attendanceLinked: false, attendanceLatePenaltyRate: 0.25, tiersEnabled: false, tierPeriod: 'MONTHLY', tiers: [],
  roleRatesEnabled: true, roleRates: { WAITER: 0.05 }, limitsEnabled: false, minAmount: null, maxAmount: null, overridesEnabled: false,
  overrides: [], name: 'Fijo', customValidityEnabled: false, effectiveFrom: '2026-10-01', effectiveTo: null,
  aggregationPeriod: 'MONTHLY', priority: 1,
} as WizardData

const seccionDeRoles = () => screen.getByText('wizard.advanced.roleRates.title').closest('.rounded-xl') as HTMLElement

describe('Tasas por rol en un esquema de monto fijo (duda 2 de la Parte 1b)', () => {
  it('🔴 sólo se guardan donde hay tasa: en un fijo, nunca', () => {
    expect(tasasPorRolAGuardar('FIXED', true, { WAITER: 0.05 })).toBeNull()
    expect(tasasPorRolAGuardar('PERCENTAGE', true, { WAITER: 0.05 })).toEqual({ WAITER: 0.05 })
    expect(tasasPorRolAGuardar('PERCENTAGE', false, { WAITER: 0.05 })).toBeNull()
  })

  it('🔴 la configuración avanzada del asistente no ofrece el interruptor en un fijo, y dice por qué', () => {
    const { rerender } = render(
      <CommissionAdvancedConfig data={{ ...DATOS, calcType: 'FIXED' }} updateData={() => {}} isOpen onOpenChange={() => {}} />,
      { wrapper: envolver },
    )
    expect(within(seccionDeRoles()).queryByRole('switch')).toBeNull()
    expect(within(seccionDeRoles()).getByText('wizard.advanced.roleRates.onlyPercentage')).toBeInTheDocument()
    expect(within(seccionDeRoles()).queryByText('WAITER')).toBeNull()
    rerender(<CommissionAdvancedConfig data={DATOS} updateData={() => {}} isOpen onOpenChange={() => {}} />)
    expect(within(seccionDeRoles()).getByRole('switch')).toBeChecked()
    expect(within(seccionDeRoles()).queryByText('wizard.advanced.roleRates.onlyPercentage')).toBeNull()
  })

  it('🔴 la tarjeta del panel de configuración se ve apagada en un fijo, explica por qué y no abre', () => {
    const fijo = initialState()
    fijo.rate.calcType = 'FIXED'
    const { unmount } = render(<RoleRatesCard state={fijo} dispatch={() => {}} />)
    const tarjeta = screen.getByRole('button', { name: /setup\.roleRates\.title/ })
    expect(tarjeta).toBeDisabled()
    expect(within(tarjeta).getByText('setup.roleRates.onlyPercentage')).toBeInTheDocument()
    unmount()
    render(<RoleRatesCard state={initialState()} dispatch={() => {}} />)
    expect(screen.getByRole('button', { name: /setup\.roleRates\.title/ })).toBeEnabled()
  })

  it('🔴 el resumen del asistente no las enseña en un fijo', () => {
    const props = { updateData: () => {}, onPrevious: () => {}, onSubmit: () => {}, isSubmitting: false, hideNavigation: true }
    const { rerender } = render(<StepConfirm data={{ ...DATOS, calcType: 'FIXED' }} {...props} />)
    expect(screen.queryByText('wizard.step3.roleRates')).toBeNull()
    rerender(<StepConfirm data={DATOS} {...props} />)
    expect(screen.getByText('wizard.step3.roleRates')).toBeInTheDocument()
  })

  it('🔴 «Editar configuración» de un fijo que traía tasas por rol las limpia al guardar', async () => {
    const config = {
      id: 'c1', venueId: 'v1', name: 'Fijo', priority: 1, recipient: 'SERVER', calcType: 'FIXED', defaultRate: 5,
      minAmount: null, maxAmount: null, includeTips: false, includeDiscount: false, includeTax: false, roleRates: { WAITER: 0.05 },
      filterByCategories: false, categoryIds: [], useGoalAsTier: false, goalBonusRate: null, attendanceLinked: false,
      attendanceLatePenaltyRate: null, effectiveFrom: '2026-09-01T06:00:00.000Z', effectiveTo: null, aggregationPeriod: 'MONTHLY',
      active: true, createdAt: '2026-09-01T06:00:00.000Z', updatedAt: '2026-09-01T06:00:00.000Z',
    } as unknown as CommissionConfig
    render(<EditConfigDialog open onOpenChange={() => {}} config={config} />, { wrapper: envolver })
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }))
    await waitFor(() => expect(m.mutateAsync).toHaveBeenCalled())
    expect(m.mutateAsync.mock.calls[0][0]).toMatchObject({ configId: 'c1', data: { calcType: 'FIXED', defaultRate: 5, roleRates: null } })
  })
})
