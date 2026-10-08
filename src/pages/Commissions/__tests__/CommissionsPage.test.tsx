// src/pages/Commissions/__tests__/CommissionsPage.test.tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CommissionsPage from '../CommissionsPage'

const m = vi.hoisted(() => ({ can: vi.fn(), stats: undefined as any, loading: false }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: m.can }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ fullBasePath: '/venues/x' }) }))
vi.mock('@/components/billing/FeatureGate', () => ({ FeatureGate: ({ children }: any) => <>{children}</> }))
vi.mock('@/components/PermissionGate', () => ({ PermissionGate: ({ children }: any) => <>{children}</> }))
vi.mock('@/components/PageTitleWithInfo', () => ({ PageTitleWithInfo: ({ title }: any) => <h1>{title}</h1> }))
vi.mock('@/hooks/useCommissions', () => ({
  useCommissionStats: () => ({ data: m.stats, isLoading: m.loading }),
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
  beforeEach(() => {
    m.can.mockReturnValue(true)
    m.stats = undefined
    m.loading = false
  })

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

  describe('la sede que NO paga en Pago al personal (feature-gating #4: lo apagado se explica)', () => {
    const sinPago = (extra: Record<string, unknown> = {}) => {
      m.stats = { staffPayActive: false, ...extra }
    }

    it('staffPayActive false: dice que se activa, y lleva a Pago al personal', () => {
      sinPago()
      pagina('/venues/x/commissions')
      expect(screen.getByRole('note')).toHaveTextContent('overview.notInStaffPay')
      expect(screen.getByRole('note')).not.toHaveTextContent('overview.paidInStaffPay')
      expect(screen.getByRole('link', { name: 'overview.goToStaffPay' })).toHaveAttribute('href', '/venues/x/servicio-pago#periodos')
      expect(screen.queryByText('overview.askOwner')).toBeNull()
    })

    it('un servidor viejo sin el campo cuenta como no activo', () => {
      m.stats = { totalCalculated: 1 }
      pagina('/venues/x/commissions')
      expect(screen.getByRole('note')).toHaveTextContent('overview.notInStaffPay')
    })

    it('staffPayActive true: el aviso de siempre, sin la línea de «activa»', () => {
      m.stats = { staffPayActive: true }
      pagina('/venues/x/commissions')
      expect(screen.getByRole('note')).toHaveTextContent('overview.paidInStaffPay')
      expect(screen.queryByText('overview.notInStaffPay')).toBeNull()
    })

    it('sin staffpay:read: sin botón y con «Pídeselo al dueño»', () => {
      sinPago()
      m.can.mockImplementation((p: string) => p !== 'staffpay:read')
      pagina('/venues/x/commissions')
      expect(screen.getByRole('note')).toHaveTextContent('overview.notInStaffPay')
      expect(screen.getByRole('note')).toHaveTextContent('overview.askOwner')
      expect(screen.queryByRole('link', { name: 'overview.goToStaffPay' })).toBeNull()
    })

    it('sede con pago activo y sin permiso: no se manda a pedir nada al dueño', () => {
      m.stats = { staffPayActive: true }
      m.can.mockImplementation((p: string) => p !== 'staffpay:read')
      pagina('/venues/x/commissions')
      expect(screen.queryByText('overview.askOwner')).toBeNull()
    })

    it('con permiso no se pide al dueño', () => {
      sinPago()
      pagina('/venues/x/commissions')
      expect(screen.queryByText('overview.askOwner')).toBeNull()
    })

    it('cargando: no afirma ni lo uno ni lo otro', () => {
      m.loading = true
      pagina('/venues/x/commissions')
      expect(screen.queryByText('overview.notInStaffPay')).toBeNull()
    })
  })
})
