// ft-graves, D-REACTIVAR (D1 de la QA): reactivar un esquema ya reemplazado hacía que pagaran los dos, y la pantalla decía lo
// contrario. La confirmación era genérica y el aviso de la lista («se pagará una sola vez, con el de mayor prioridad») estaba escrito
// a mano y no decía cuáles. Ahora: al reactivar se dice si fue reemplazado y por cuál, con qué esquemas activos comparte categorías
// (o si los dos son generales) y cuál pagará según la prioridad, con nombres; y el aviso de la lista nombra los esquemas.
import type { ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CommissionConfig } from '@/types/commission'
import DesactivarEsquema from '../components/DesactivarEsquema'
import CommissionConfigList from '../components/CommissionConfigList'

const m = vi.hoisted(() => ({ configs: [] as unknown[] }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k), i18n: { language: 'es' } }),
}))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/x', venue: null }) }))
vi.mock('@/hooks/use-role-config', () => ({ useRoleConfig: () => ({ getDisplayName: (r: string) => r }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/hooks/useCommissions', () => ({
  useUpdateCommissionConfig: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteCommissionConfig: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCommissionConfigs: () => ({ data: m.configs }),
}))
vi.mock('@/services/menu.service', () => ({
  getMenuCategories: vi.fn(async () => [
    { id: 'bebidas', name: 'Bebidas' },
    { id: 'postres', name: 'Postres' },
  ]),
}))
vi.mock('@/components/PermissionGate', () => ({ PermissionGate: ({ children }: { children: ReactNode }) => <>{children}</> }))

const envolver = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter>{children}</MemoryRouter>
  </QueryClientProvider>
)

const BASE = {
  venueId: 'v1', recipient: 'SERVER', calcType: 'PERCENTAGE', minAmount: null, maxAmount: null, includeTips: false,
  includeDiscount: false, includeTax: false, roleRates: null, useGoalAsTier: false, goalBonusRate: null, attendanceLinked: false,
  attendanceLatePenaltyRate: null, effectiveFrom: '2026-10-01T06:00:00.000Z', effectiveTo: null, aggregationPeriod: 'MONTHLY',
}
const esquema = (c: Partial<CommissionConfig>) =>
  ({ ...BASE, filterByCategories: false, categoryIds: [], priority: 1, active: true, createdAt: '2026-10-01T06:00:00.000Z',
    updatedAt: '2026-10-01T06:00:00.000Z', ...c }) as CommissionConfig

// El 10 % se reemplazó por el 12 % a las 18:00: el nuevo nació en el mismo instante en que el original se apagó.
const VIEJO = esquema({ id: 'c10', name: 'Bebidas 10%', defaultRate: 0.1, filterByCategories: true, categoryIds: ['bebidas'],
  active: false, updatedAt: '2026-10-09T00:00:00.120Z' })
const NUEVO = esquema({ id: 'c12', name: 'Bebidas 12%', defaultRate: 0.12, filterByCategories: true, categoryIds: ['bebidas'],
  createdAt: '2026-10-09T00:00:00.100Z' })

const abrirReactivar = async (config: CommissionConfig) => {
  render(<DesactivarEsquema config={config} />, { wrapper: envolver })
  fireEvent.click(screen.getByRole('button', { name: 'config.reactivate' }))
  return screen.findByRole('alertdialog')
}

beforeEach(() => {
  m.configs = []
})

describe('reactivar dice qué va a pasar con el dinero', () => {
  it('🔴 dice que fue reemplazado y por cuál, y que comparten Bebidas con la misma prioridad (con nombres, no ids)', async () => {
    m.configs = [VIEJO, NUEVO]
    const dialogo = await abrirReactivar(VIEJO)
    expect(dialogo).toHaveTextContent('config.reactivateReplacedBy {"otro":"Bebidas 12%"}')
    expect(await screen.findByText(/"categorias":"Bebidas"/)).toHaveTextContent('config.overlap.categoriesTie')
    expect(dialogo).toHaveTextContent('"a":"Bebidas 10%"')
    expect(dialogo).toHaveTextContent('"b":"Bebidas 12%"')
    expect(dialogo).not.toHaveTextContent('bebidas"')
  })

  it('🔴 con prioridades distintas dice cuál pagará', async () => {
    m.configs = [VIEJO, { ...NUEVO, priority: 3 }]
    await abrirReactivar(VIEJO)
    expect(await screen.findByText(/config\.overlap\.categories /)).toHaveTextContent('"paga":"Bebidas 12%"')
  })

  it('🔴 dos esquemas generales (sin categorías): dice que paga sólo uno y cuál', async () => {
    const general = esquema({ id: 'g1', name: 'General 5%', defaultRate: 0.05, active: false, priority: 2 })
    m.configs = [general, esquema({ id: 'g2', name: 'General 3%', defaultRate: 0.03, priority: 1 })]
    await abrirReactivar(general)
    const aviso = await screen.findByText(/config\.overlap\.general /)
    expect(aviso).toHaveTextContent('"paga":"General 5%"')
    expect(screen.queryByText(/config\.reactivateReplacedBy/)).toBeNull()
  })

  it('sin choques con esquemas activos, lo dice', async () => {
    m.configs = [VIEJO, esquema({ id: 'p1', name: 'Postres 8%', filterByCategories: true, categoryIds: ['postres'] })]
    await abrirReactivar(VIEJO)
    expect(screen.getByText('config.reactivateNoOverlap')).toBeInTheDocument()
  })
})

describe('el aviso de la lista dice la verdad', () => {
  it('🔴 nombra los esquemas que comparten categoría y cuál paga; ya no el texto genérico escrito a mano', async () => {
    const a = esquema({ id: 'a', name: 'Bebidas 12%', filterByCategories: true, categoryIds: ['bebidas', 'postres'], priority: 3 })
    const b = esquema({ id: 'b', name: 'Bebidas 10%', filterByCategories: true, categoryIds: ['bebidas'], priority: 1 })
    render(
      <CommissionConfigList
        effectiveConfigs={[{ config: a, source: 'venue' }, { config: b, source: 'venue' }]}
        isLoading={false}
      />,
      { wrapper: envolver },
    )
    // Mientras carga el catálogo dice «1 categorías»; luego, el nombre. Nunca el id.
    const aviso = await screen.findByText(/"categorias":"Bebidas"/)
    expect(aviso).toHaveTextContent('config.overlap.categories ')
    expect(aviso).toHaveTextContent('"paga":"Bebidas 12%"')
    expect(screen.queryByText(/se pagará una sola vez/)).toBeNull()
  })

  it('sin categorías compartidas no hay aviso', () => {
    const a = esquema({ id: 'a', name: 'Bebidas', filterByCategories: true, categoryIds: ['bebidas'] })
    const b = esquema({ id: 'b', name: 'Postres', filterByCategories: true, categoryIds: ['postres'] })
    render(<CommissionConfigList effectiveConfigs={[{ config: a, source: 'venue' }, { config: b, source: 'venue' }]} isLoading={false} />, {
      wrapper: envolver,
    })
    expect(screen.queryByText(/config\.overlap/)).toBeNull()
  })
})
