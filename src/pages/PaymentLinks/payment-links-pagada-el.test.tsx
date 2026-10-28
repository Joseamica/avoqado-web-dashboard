import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PaymentLinks from './PaymentLinks'

// La columna «Pagada el» dice cuándo se pagó cada liga, en la zona del venue, aunque después se haya archivado.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { count?: number }) => (opts?.count != null ? `${key}:${opts.count}` : key),
    i18n: { language: 'es' },
  }),
}))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'venue-a', fullBasePath: '/venues/a' }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/utils/datetime', () => ({
  useVenueDateTime: () => ({ formatDate: () => '', formatDateTime: (iso: string) => `fecha-venue:${iso}` }),
}))
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn(), useLocation: () => ({ search: '', pathname: '/', hash: '' }) }))
vi.mock('@/services/ecommerceMerchant.service', () => ({ ecommerceMerchantAPI: { listByVenue: async () => [{ chargesEnabled: true }] } }))

const base = { amountType: 'FIXED', amount: 500, currency: 'MXN', totalCollected: 0 }
vi.mock('@/services/paymentLink.service', () => ({
  default: {
    getPaymentLinks: async () => [
      { ...base, id: 'archivada', shortCode: 'A', title: 'Anticipo', status: 'ARCHIVED', isReusable: false, paymentCount: 1, lastPaidAt: '2026-10-27T18:05:00.000Z' },
      { ...base, id: 'reusable', shortCode: 'B', title: 'Clase', status: 'ACTIVE', isReusable: true, paymentCount: 3, lastPaidAt: '2026-10-28T20:40:00.000Z' },
      { ...base, id: 'sin-pago', shortCode: 'C', title: 'Pendiente', status: 'ACTIVE', isReusable: false, paymentCount: 0, lastPaidAt: null },
      // Un servidor viejo todavía no manda el campo.
      { ...base, id: 'servidor-viejo', shortCode: 'D', title: 'Vieja', status: 'ACTIVE', isReusable: false, paymentCount: 1 },
    ],
  },
}))
// La tabla real no es el objeto de la prueba: pinta la celda «Pagada el» de cada fila.
vi.mock('@/components/data-table', () => ({
  default: ({ columns, data }: { columns: Array<{ accessorKey?: string; cell?: (c: unknown) => unknown }>; data: Array<{ id: string }> }) => (
    <div>
      {data.map(row => (
        <div key={row.id} data-testid={`pagada-${row.id}`}>
          {columns.find(c => c.accessorKey === 'lastPaidAt')?.cell?.({ row: { original: row } }) as never}
        </div>
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

describe('lista de ligas: columna «Pagada el»', () => {
  it('muestra cuándo se pagó, también en una archivada; el último pago en una reutilizable; «—» si no hay pago', async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <PaymentLinks />
      </QueryClientProvider>,
    )

    expect(await screen.findByTestId('pagada-archivada')).toHaveTextContent('fecha-venue:2026-10-27T18:05:00.000Z')
    expect(screen.getByTestId('pagada-archivada')).not.toHaveTextContent('list.lastOfPayments')

    const reusable = screen.getByTestId('pagada-reusable')
    expect(reusable).toHaveTextContent('fecha-venue:2026-10-28T20:40:00.000Z')
    expect(reusable).toHaveTextContent('list.lastOfPayments:3')

    expect(screen.getByTestId('pagada-sin-pago')).toHaveTextContent('—')
    expect(screen.getByTestId('pagada-servidor-viejo')).toHaveTextContent('—')
  })
})
