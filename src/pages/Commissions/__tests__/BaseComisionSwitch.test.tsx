// Duda 1 de la Parte 1b (mismo defecto que G4): «Base de la comisión: Lo realmente cobrado» con el interruptor APAGADO a un lado se
// leía como «lo realmente cobrado: no». Con interruptor, la etiqueta es la ACCIÓN («Calcular sobre el precio de lista»: apagado = lo
// realmente cobrado, el de fábrica) y debajo dice cómo está AHORA. Mismo valor guardado (`includeDiscount`), sin cambio de contrato.
import type { ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import BaseComisionSwitch from '../components/BaseComisionSwitch'
import CalculationBaseCard from '../components/setup-panel/cards/CalculationBaseCard'
import { initialState } from '../components/setup-panel/useSetupReducer'
import StepAmount from '../components/wizard/StepAmount'
import EditConfigDialog from '../components/EditConfigDialog'
import type { WizardData } from '../components/wizard/CreateCommissionWizard'
import type { CommissionConfig } from '@/types/commission'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/hooks/useCommissions', () => ({ useUpdateCommissionConfig: () => ({ mutateAsync: vi.fn(), isPending: false }) }))
vi.mock('../components/wizard/LiveExample', () => ({ default: () => null, TieredExample: () => null }))
vi.mock('../components/wizard/CommissionAdvancedConfig', () => ({ default: () => null }))
vi.mock('../components/wizard/CategoryFilter', () => ({ default: () => null }))

const ACCION = 'wizard.step2.commissionBaseAction'

describe('BaseComisionSwitch (duda 1 de la Parte 1b, como G4)', () => {
  it('🔴 con interruptor, la etiqueta es la acción «Calcular sobre el precio de lista» y debajo cómo está ahora', () => {
    const { rerender } = render(<BaseComisionSwitch id="base" checked={false} onChange={() => {}} />)
    expect(screen.getByRole('switch', { name: ACCION })).not.toBeChecked()
    expect(screen.getByText('wizard.step2.commissionBaseNowNet')).toBeInTheDocument()
    expect(screen.getByText('wizard.step2.commissionBaseNetHint')).toBeInTheDocument()
    expect(screen.queryByText(/wizard\.step2\.commissionBaseNet$/)).toBeNull()
    rerender(<BaseComisionSwitch id="base" checked onChange={() => {}} />)
    expect(screen.getByRole('switch', { name: ACCION })).toBeChecked()
    expect(screen.getByText('wizard.step2.commissionBaseNowList')).toBeInTheDocument()
    expect(screen.getByText('wizard.step2.commissionBaseListHint')).toBeInTheDocument()
  })

  it('el interruptor cambia la base (`includeDiscount`)', () => {
    const onChange = vi.fn()
    render(<BaseComisionSwitch id="base" checked={false} onChange={onChange} />)
    fireEvent.click(screen.getByRole('switch', { name: ACCION }))
    expect(onChange).toHaveBeenCalledWith(true)
  })
})

describe('Los tres lugares donde se elige la base usan la acción, no la base vigente', () => {
  it('🔴 la tarjeta «Base de Cálculo» del panel de configuración', () => {
    render(<CalculationBaseCard state={initialState()} dispatch={() => {}} />)
    fireEvent.click(screen.getByText('setup.calcBase.title'))
    expect(screen.getByRole('switch', { name: ACCION })).not.toBeChecked()
    expect(screen.getByText('wizard.step2.commissionBaseNowNet')).toBeInTheDocument()
  })

  it('🔴 el paso «Monto» del asistente', () => {
    const data = {
      recipient: 'SERVER', calcType: 'PERCENTAGE', defaultRate: 0.03, fixedAmount: 10, includeTax: false, includeTips: false,
      includeDiscount: true, filterByCategories: false, categoryIds: [], useGoalAsTier: false, goalBonusRate: 0.06,
      attendanceLinked: false, attendanceLatePenaltyRate: 0.25, tiersEnabled: false, tierPeriod: 'MONTHLY', tiers: [],
      roleRatesEnabled: false, roleRates: {}, limitsEnabled: false, minAmount: null, maxAmount: null, overridesEnabled: false,
      overrides: [], name: '', customValidityEnabled: false, effectiveFrom: '2026-10-01', effectiveTo: null,
      aggregationPeriod: 'MONTHLY', priority: 1,
    } as WizardData
    render(<StepAmount data={data} updateData={() => {}} onNext={() => {}} hideNavigation />)
    expect(screen.getByRole('switch', { name: ACCION })).toBeChecked()
    expect(screen.getByText('wizard.step2.commissionBaseNowList')).toBeInTheDocument()
  })

  it('🔴 el diálogo «Editar configuración»', () => {
    const config = {
      id: 'c1', venueId: 'v1', name: 'Esquema', priority: 1, recipient: 'SERVER', calcType: 'PERCENTAGE', defaultRate: 0.03,
      minAmount: null, maxAmount: null, includeTips: false, includeDiscount: false, includeTax: false, roleRates: null,
      filterByCategories: false, categoryIds: [], useGoalAsTier: false, goalBonusRate: null, attendanceLinked: false,
      attendanceLatePenaltyRate: null, effectiveFrom: '2026-09-01T06:00:00.000Z', effectiveTo: null, aggregationPeriod: 'MONTHLY',
      active: true, createdAt: '2026-09-01T06:00:00.000Z', updatedAt: '2026-09-01T06:00:00.000Z',
    } as unknown as CommissionConfig
    const envolver = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
    )
    render(<EditConfigDialog open onOpenChange={() => {}} config={config} />, { wrapper: envolver })
    expect(screen.getByRole('switch', { name: ACCION })).not.toBeChecked()
    expect(screen.getByText('wizard.step2.commissionBaseNowNet')).toBeInTheDocument()
  })
})
