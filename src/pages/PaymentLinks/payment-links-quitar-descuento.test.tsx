import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PaymentLinks from './PaymentLinks'

// «Quitar descuento» en la lista cambia el precio de una liga ya compartida: pide confirmación antes de mandar nada.
const mocks = vi.hoisted(() => ({ update: vi.fn() }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
}))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'venue-a', fullBasePath: '/venues/a' }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatDate: () => '' }) }))
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn(), useLocation: () => ({ search: '', pathname: '/', hash: '' }) }))
vi.mock('@/services/ecommerceMerchant.service', () => ({ ecommerceMerchantAPI: { listByVenue: async () => [{ chargesEnabled: true }] } }))
vi.mock('@/services/paymentLink.service', () => ({
  default: {
    updatePaymentLink: mocks.update,
    getPaymentLinks: async () => [
      {
        id: 'l1',
        shortCode: 'A',
        title: 'Clase',
        amountType: 'FIXED',
        amount: 1000,
        currency: 'MXN',
        status: 'ACTIVE',
        isReusable: true,
        paymentCount: 0,
        discount: { name: 'Mayo', type: 'PERCENTAGE', value: 15, origen: 'CATALOGO', discountId: 'd1' },
        discountStatus: 'VENCIDO',
      },
    ],
  },
}))
// La tabla real no es el objeto de la prueba: pinta la celda del importe de cada fila.
vi.mock('@/components/data-table', () => ({
  default: ({ columns, data }: { columns: Array<{ accessorKey?: string; cell?: (c: unknown) => unknown }>; data: unknown[] }) => (
    <div>
      {data.map((row, i) => (
        <div key={i}>{columns.find(c => c.accessorKey === 'amount')?.cell?.({ row: { original: row } }) as never}</div>
      ))}
    </div>
  ),
}))
vi.mock('./CreatePaymentLinkDialog', () => ({ default: () => null }))
vi.mock('./SharePaymentLinkDialog', () => ({ SharePaymentLinkDialog: () => null }))
vi.mock('@/pages/Venue/components/EcommerceMerchantWizard', () => ({ EcommerceMerchantWizard: () => null }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('lista de ligas: quitar descuento', () => {
  it('pide confirmación; cancelar no manda nada y confirmar manda discount: null', async () => {
    mocks.update.mockResolvedValue({ success: true, data: {} })
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <PaymentLinks />
      </QueryClientProvider>,
    )
    fireEvent.click(await screen.findByRole('button', { name: 'discountStatus.remove' }))
    expect(mocks.update).not.toHaveBeenCalled()
    expect(await screen.findByText('confirm.removeDiscountTitle')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'confirm.cancel' }))
    expect(mocks.update).not.toHaveBeenCalled()

    fireEvent.click(await screen.findByRole('button', { name: 'discountStatus.remove' }))
    fireEvent.click(await screen.findByRole('button', { name: 'confirm.removeDiscountConfirm' }))
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith('venue-a', 'l1', { discount: null }))
  })
})
