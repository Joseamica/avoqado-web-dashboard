import { cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DiscountDetail from './DiscountDetail'

const mocks = vi.hoisted(() => ({ getDiscount: vi.fn() }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k}|${JSON.stringify(o)}` : k) }),
}))
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn(), useParams: () => ({ discountId: 'd1' }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/context/BreadcrumbContext', () => ({ useBreadcrumb: () => ({ setCustomSegment: vi.fn(), clearCustomSegment: vi.fn() }) }))
vi.mock('@/components/PermissionGate', () => ({ PermissionGate: () => null }))
vi.mock('../components/DiscountWizard', () => ({ DiscountWizard: () => null }))
vi.mock('../hooks/useDiscountFormData', () => ({
  useDiscountFormData: () => ({ productOptions: [], categoryOptions: [], customerGroupOptions: [], dayOptions: [] }),
}))
vi.mock('@/services/discount.service', () => ({ default: { getDiscount: mocks.getDiscount } }))

afterEach(cleanup)
const base = { id: 'd1', venueId: 'v1', name: 'Mayo', type: 'PERCENTAGE', value: 10, scope: 'ORDER', active: true }
const renderIt = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DiscountDetail />
    </QueryClientProvider>,
  )

describe('DiscountDetail uso', () => {
  it('con usage muestra total y las dos filas', async () => {
    mocks.getDiscount.mockResolvedValue({ ...base, usage: { total: 4, pos: 3, ligasPagadas: 1 } })
    renderIt()
    const total = await screen.findByTestId('discount-usage-total')
    expect(total.textContent).toContain('"count":4')
    expect(screen.getByTestId('discount-usage-pos').textContent).toContain('"count":3')
    expect(screen.getByTestId('discount-usage-links').textContent).toContain('"count":1')
  })

  it('sin usage (servidor viejo) oculta el bloque', async () => {
    mocks.getDiscount.mockResolvedValue(base)
    renderIt()
    await screen.findByRole('heading', { name: 'Mayo' })
    expect(screen.queryByTestId('discount-usage-total')).toBeNull()
  })
})
