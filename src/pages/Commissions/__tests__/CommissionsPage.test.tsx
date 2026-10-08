// src/pages/Commissions/__tests__/CommissionsPage.test.tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CommissionsPage from '../CommissionsPage'

const m = vi.hoisted(() => ({ can: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: m.can }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ fullBasePath: '/venues/x' }) }))
vi.mock('@/components/billing/FeatureGate', () => ({ FeatureGate: ({ children }: any) => <>{children}</> }))
vi.mock('@/components/PermissionGate', () => ({ PermissionGate: ({ children }: any) => <>{children}</> }))
vi.mock('@/components/PageTitleWithInfo', () => ({ PageTitleWithInfo: ({ title }: any) => <h1>{title}</h1> }))
vi.mock('@/hooks/useCommissions', () => ({
  useCommissionStats: () => ({ data: undefined, isLoading: false }),
  useEffectiveCommissionConfigs: () => ({ data: [], isLoading: false }),
}))
vi.mock('../components/CommissionKPICards', () => ({ default: () => <div>kpis</div> }))
vi.mock('../components/TeamCommissionTable', () => ({ default: () => <div>resumenes</div> }))
vi.mock('../components/CommissionConfigList', () => ({ default: () => null }))
vi.mock('../components/GoalsTab', () => ({ default: () => null }))
vi.mock('../components/setup-panel/CommissionSetupPanel', () => ({ default: () => null }))

const pagina = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <CommissionsPage />
    </MemoryRouter>,
  )

describe('CommissionsPage — las comisiones se pagan en Pago al personal (spec §8, §11)', () => {
  beforeEach(() => m.can.mockReturnValue(true))

  it('ya no hay pestaña de aprobaciones y pagos; un enlace viejo (#approvals, #payouts) cae en el resumen', () => {
    for (const url of ['/venues/x/commissions#approvals', '/venues/x/commissions#payouts']) {
      const { unmount } = pagina(url)
      expect(screen.queryByText('tabs.approvals')).toBeNull()
      expect(screen.getByText('resumenes')).toBeInTheDocument()
      unmount()
    }
  })

  it('dice dónde se pagan y lleva a Pago al personal', () => {
    pagina('/venues/x/commissions')
    expect(screen.getByRole('note')).toHaveTextContent('overview.paidInStaffPay')
    expect(screen.getByRole('link', { name: 'overview.goToStaffPay' })).toHaveAttribute('href', '/venues/x/servicio-pago#periodos')
  })

  it('sin staffpay:read el aviso se queda, sin el enlace', () => {
    m.can.mockImplementation((p: string) => p !== 'staffpay:read')
    pagina('/venues/x/commissions')
    expect(screen.getByRole('note')).toHaveTextContent('overview.paidInStaffPay')
    expect(screen.queryByRole('link', { name: 'overview.goToStaffPay' })).toBeNull()
  })
})
