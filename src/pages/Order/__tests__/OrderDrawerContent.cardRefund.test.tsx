/**
 * Codex panel r1 #3: el detalle REAL de la cuenta lleva «Devolver a la tarjeta» (la bandeja sólo guarda 24 h). Con una cuenta de
 * origen en línea cobrada con tarjeta lee el pedido por la ruta de S3 y muestra el botón; con una cuenta que no es en línea no
 * consulta S3 ni muestra nada. Se monta el cajón de verdad con el servicio y la hoja reales; sólo se apagan las secciones ajenas.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ get: vi.fn(), order: {} as Record<string, unknown>, permissions: [] as string[] }))
vi.mock('@/api', () => ({ default: { get: (...a: unknown[]) => m.get(...a) } }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => m.permissions.includes(p) }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', venue: { name: 'Taquería' }, fullBasePath: '/venues/t' }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatDateTime: (d: string) => d }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: () => {} }) }))
vi.mock('@/context/BreadcrumbContext', () => ({ useBreadcrumb: () => ({ setCustomSegment: () => {}, clearCustomSegment: () => {} }) }))
vi.mock('@/services/order.service', () => ({ getOrder: async () => m.order }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, o?: Record<string, unknown>) => (o ? `${key}|${Object.values(o).join(',')}` : key) }),
}))
vi.mock('@/pages/Order/components/OrderActionsSheet', () => ({ OrderActionsSheet: () => null }))
vi.mock('@/pages/Order/components/sections/DetailsSection', () => ({ DetailsSection: () => null }))
vi.mock('@/pages/Order/components/sections/ItemsSection', () => ({ ItemsSection: () => null }))
vi.mock('@/pages/Order/components/StampRewardsSection', () => ({ StampRewardsSection: () => null }))
vi.mock('@/pages/Order/components/sections/PaymentsSection', () => ({ PaymentsSection: () => <div data-testid="payments-section" /> }))
vi.mock('@/pages/Order/components/sections/ActivitySection', () => ({ ActivitySection: () => null }))
vi.mock('@/pages/Payment/components/ExchangeLinksCard', () => ({ ExchangeLinksCard: () => null }))

import { OrderDrawerContent } from '../OrderDrawerContent'

const S3 = '/api/v1/dashboard/venues/v1/online-ordering/orders/o1'
const onlineOrder = {
  orderId: 'o1',
  onlineOrderId: 'oo1',
  orderNumber: '101',
  status: 'COMPLETED',
  paymentMode: 'CARD_ONLINE',
  customerName: 'Ana',
  customerPhone: null,
  note: null,
  createdAt: '2026-10-30T17:00:00.000Z',
  acceptDeadlineAt: '2026-10-30T17:10:00.000Z',
  estimatedReadyAt: null,
  total: 200,
  remaining: 0,
  paymentStatus: 'PAID',
  needsPrint: false,
  items: [],
  cardStatus: null,
  card: { status: 'CAPTURED', amount: 200, capturedAmount: 200, authorizedAt: '2026-10-30T17:00:00.000Z', capturedAt: '2026-10-30T17:05:00.000Z' },
  rejectReason: null,
}

const mount = () =>
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <OrderDrawerContent orderId="o1" onClose={() => {}} />
      </QueryClientProvider>
    </MemoryRouter>,
  )

describe('detalle de la cuenta: «Devolver a la tarjeta» de un pedido en línea', () => {
  beforeEach(() => {
    m.get.mockReset()
    m.permissions = ['orders:read', 'payments:read', 'payments:refund']
    m.order = { id: 'o1', orderNumber: '101', status: 'COMPLETED', paymentStatus: 'PAID', source: 'WEB', total: 200 }
    m.get.mockImplementation(async (url: string) => {
      if (url === S3) return { data: { success: true, data: onlineOrder } }
      throw new Error(`GET inesperado: ${url}`)
    })
  })

  it('🔴 cuenta de origen en línea cobrada con tarjeta ⇒ lee S3 y muestra «Devolver a la tarjeta» después de los pagos', async () => {
    mount()
    await waitFor(() => expect(m.get).toHaveBeenCalledWith(S3))
    const button = await screen.findByRole('button', { name: 'cardRefund.open' }, { timeout: 5000 })
    expect(screen.getByTestId('payments-section').compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('🔴 una cuenta que no es en línea ⇒ ninguna llamada a S3 y sin botón', async () => {
    m.order = { ...m.order, source: 'TPV' }
    mount()
    await screen.findByTestId('payments-section')
    await new Promise(r => setTimeout(r, 30))
    expect(m.get).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'cardRefund.open' })).toBeNull()
  })

  it('S3 responde 404 (no es pedido en línea) ⇒ sin botón', async () => {
    m.get.mockRejectedValue(Object.assign(new Error('404'), { response: { status: 404, data: { message: 'Esta cuenta no es un pedido en línea.' } } }))
    mount()
    await waitFor(() => expect(m.get).toHaveBeenCalledWith(S3))
    await new Promise(r => setTimeout(r, 30))
    expect(screen.queryByRole('button', { name: 'cardRefund.open' })).toBeNull()
  })
})
