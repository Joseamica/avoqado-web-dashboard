import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import es from '@/locales/es/payment.json'
import en from '@/locales/en/payment.json'
import ordersEs from '@/locales/es/orders.json'
import { ExchangeLinksCard } from '../components/ExchangeLinksCard'
import { PaymentDrawerContent } from '../PaymentDrawerContent'
import { OrderDrawerContent } from '@/pages/Order/OrderDrawerContent'

const m = vi.hoisted(() => ({
  get: vi.fn(),
  detail: {} as any,
  payment: {} as any,
  order: {} as any,
  base: '/venues/iq',
  language: 'es',
  permissions: [] as string[],
}))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => m.permissions.includes(p) }) }))
vi.mock('@/api', () => ({ default: { get: (...args: unknown[]) => m.get(...args) } }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', venue: { name: 'IQ' }, fullBasePath: m.base }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatDateTime: (value: string) => value }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: () => {} }) }))
vi.mock('@/context/BreadcrumbContext', () => ({ useBreadcrumb: () => ({ setCustomSegment: () => {}, clearCustomSegment: () => {} }) }))
vi.mock('@/services/order.service', () => ({ getOrder: async () => m.order }))
vi.mock('../IssueRefundSheet', () => ({ IssueRefundSheet: () => null }))
vi.mock('../RefundCreditNotePanel', () => ({ RefundCreditNotePanel: () => null }))
vi.mock('../CustomerSheets', () => ({ AddCustomerSheet: () => null, CustomerFormSheet: () => null }))
vi.mock('@/pages/Order/components/OrderActionsSheet', () => ({ OrderActionsSheet: () => null }))
vi.mock('@/pages/Order/components/sections/DetailsSection', () => ({ DetailsSection: () => null }))
vi.mock('@/pages/Order/components/sections/ItemsSection', () => ({ ItemsSection: () => null }))
vi.mock('@/pages/Order/components/StampRewardsSection', () => ({ StampRewardsSection: () => null }))
vi.mock('@/pages/Order/components/sections/PaymentsSection', () => ({ PaymentsSection: () => <div data-testid="payments-section" /> }))
vi.mock('@/pages/Order/components/sections/ActivitySection', () => ({ ActivitySection: () => <div data-testid="activity-section" /> }))
vi.mock('react-i18next', () => ({
  useTranslation: (ns: string) => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      const raw = key.split('.').reduce<any>((obj, part) => obj?.[part], ns === 'orders' ? ordersEs : m.language === 'en' ? en : es)
      return typeof raw === 'string' ? raw.replace(/\{\{(\w+)\}\}/g, (_, part) => String(opts?.[part] ?? '')) : (opts?.defaultValue ?? key)
    },
    i18n: { language: m.language },
  }),
}))

const original = (status = 'COMPLETED', reviewedAt: string | null = null) => ({
  exchangeId: 'x1',
  newOrderId: 'o2',
  newOrderNumber: 'ORD-002',
  status,
  reviewedAt,
})
const asNew = (status = 'COMPLETED', reviewedAt: string | null = null) => ({
  exchangeId: 'x1',
  originalOrderId: 'o1',
  originalOrderNumber: 'ORD-001',
  status,
  reviewedAt,
})
const links = () => ({ asOriginal: [original()], asOriginalTotal: 1, asNew: null })
function mount(ui: React.ReactNode) {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>
    </MemoryRouter>,
  )
}
function card(value: any = links()) {
  return mount(<ExchangeLinksCard orderId="o1" links={value} />)
}
async function expand() {
  fireEvent.click(screen.getByRole('button', { name: /Ver detalle/ }))
  await screen.findByText('Vestido azul M')
}

beforeEach(() => {
  m.permissions = ['payments:read', 'orders:read']
  m.language = 'es'
  m.base = '/venues/iq'
  m.detail = {
    id: 'x1',
    status: 'COMPLETED',
    applied: true,
    originalOrderId: 'o1',
    newOrderId: 'o2',
    returnedCents: 10000,
    takenCents: 15000,
    differenceCents: 5000,
    returned: [
      {
        orderItemId: 'i1',
        productId: 'pr1',
        productName: 'Vestido azul M',
        quantity: 1,
        reason: 'SIZE',
        restock: true,
        pieceValuesCents: [10000],
        valueCents: 10000,
      },
    ],
    taken: [
      {
        productId: 'pr2',
        productName: 'Vestido azul L',
        quantity: 1,
        listCents: 18000,
        priceCents: 15000,
        pieces: [{ priceCents: 15000, inheritedFromOrderItemId: 'i1' }],
        newOrderItemIds: ['i2'],
      },
    ],
    settlement: { kind: 'COLLECT', method: 'CASH', amountCents: 5000 },
    staffName: null,
    reviewReason: null,
    reviewedAt: null,
    reviewNote: null,
    expectedChargeCents: 5000,
    chargedCents: 5000,
    chargePaymentCount: 1,
    paymentIds: ['p2'],
    chargePaymentId: 'p2',
  }
  m.payment = {
    id: 'p1',
    orderId: 'o1',
    type: 'REGULAR',
    amount: 100,
    tipAmount: 0,
    method: 'CASH',
    source: 'POS',
    createdAt: '2026-10-20T18:00:00Z',
    order: { id: 'o1', items: [] },
    exchange: links(),
  }
  m.order = { id: 'o1', orderNumber: 'ORD-001', status: 'COMPLETED', paymentStatus: 'PAID', exchange: links() }
  m.get.mockImplementation(async (url: string) => {
    if (url.endsWith('/exchanges/x1')) return { data: { success: true, data: m.detail } }
    if (url.endsWith('/payments/p1')) return { data: m.payment }
    if (url.endsWith('/receipts')) return { data: [] }
    if (url.endsWith('/refunds')) return { data: { data: [] } }
    throw new Error(`Unexpected GET: ${url}`)
  })
})

describe('ExchangeLinksCard', () => {
  it.each(['original', 'new'])('shows order text and opens detail without orders:read (%s)', async side => {
    m.permissions = ['payments:read']
    m.base = '/wl/venues/iq'
    const { container } = card(side === 'original' ? links() : { asOriginal: [], asOriginalTotal: 0, asNew: asNew() })
    expect(screen.getByText(side === 'original' ? 'Cambiada en ORD-002' : 'Cambio de ORD-001')).toBeVisible()
    expect(container.querySelector('a[href*="/orders/"]')).toBeNull()
    await expand()
    expect(screen.getByText('Vestido azul L')).toBeVisible()
    expect(screen.getByText('Diferencia: $50.00')).toBeVisible()
    expect(m.get).toHaveBeenCalledWith('/api/v1/dashboard/venues/v1/exchanges/x1')
  })

  it.each([
    ['es', 'Regreso al inventario solicitado', 'Productos que regresó', 'Se llevó'],
    ['en', 'Return to inventory requested', 'Returned products', 'Took'],
  ])('does not claim inventory was restored for a completed exchange (%s)', async (language, request, returned, taken) => {
    m.language = language
    card()
    fireEvent.click(screen.getByRole('button', { name: /Ver detalle|View detail/ }))
    expect(await screen.findByText(request)).toBeVisible()
    expect(screen.getByRole('heading', { name: returned })).toBeVisible()
    expect(screen.getByRole('heading', { name: taken })).toBeVisible()
    expect(screen.queryByText('Regresó al inventario')).not.toBeInTheDocument()
    expect(screen.queryByText('Returned to inventory')).not.toBeInTheDocument()
  })

  it('saldo a favor: «Saldo a favor para {nombre}: $X» y el teléfono distinto; un server viejo (sin storeCredit) no lo pinta', async () => {
    m.detail.settlement = {
      kind: 'PAYOUT',
      method: 'STORE_CREDIT',
      amountCents: 15050,
      storeCredit: { customerId: 'c1', customerName: 'Ana López', amountCents: 15050, newBalanceCents: 20000, phoneLast4: '5678', phoneMismatch: true },
    }
    card()
    await expand()
    expect(screen.getByText('Saldo a favor para Ana López: $150.50')).toBeInTheDocument()
    expect(screen.getByText(/termina en 5678/)).toBeInTheDocument()
  })

  it('sin storeCredit en la liquidación (server viejo o cambio normal) no aparece nada de saldo a favor', async () => {
    card()
    await expand()
    expect(screen.queryByText(/Saldo a favor para/)).toBeNull()
  })

  it('shows each original link with its status and a link to that order', () => {
    card()
    expect(screen.getByRole('link', { name: 'Cambiada en ORD-002' })).toHaveAttribute('href', '/venues/iq/orders/o2')
    expect(screen.getByText('Hecho')).toBeInTheDocument()
    expect(m.get).not.toHaveBeenCalled()
  })
  it('shows the original order for asNew', () => {
    card({ asOriginal: [], asOriginalTotal: 0, asNew: asNew() })
    expect(screen.getByRole('link', { name: 'Cambio de ORD-001' })).toHaveAttribute('href', '/venues/iq/orders/o1')
  })
  it('shows the overflow link with asNew=null and preserves the white-label base', () => {
    m.base = '/wl/venues/iq'
    card({ ...links(), asOriginalTotal: 51, asOriginal: Array.from({ length: 50 }, (_, i) => ({ ...original(), exchangeId: `x${i}` })) })
    expect(screen.getAllByRole('link', { name: 'Cambiada en ORD-002' })).toHaveLength(50)
    expect(screen.getByRole('link', { name: 'y 1 más · Ver todos' })).toHaveAttribute('href', '/wl/venues/iq/payments/exchanges?order=o1')
  })
  it.each(['PENDING_PAYMENT', 'CANCELLED', 'NEEDS_REVIEW'])('shows the state on both sides (%s)', status => {
    const labels: Record<string, string> = {
      PENDING_PAYMENT: 'Cobrando la diferencia',
      CANCELLED: 'Cancelado',
      NEEDS_REVIEW: 'Por revisar',
    }
    card({ asOriginal: [original(status)], asOriginalTotal: 1, asNew: asNew(status) })
    expect(screen.getAllByText(labels[status])).toHaveLength(2)
  })
  it('shows reviewed on both sides without hiding the financial state', () => {
    card({ asOriginal: [original('NEEDS_REVIEW', '2026-10-26')], asOriginalTotal: 1, asNew: asNew('NEEDS_REVIEW', '2026-10-26') })
    expect(screen.getAllByText('Revisado')).toHaveLength(2)
    expect(screen.getAllByText('Por revisar')).toHaveLength(2)
  })
  it('expanding loads the detail and shows returned and taken goods, inheritance and difference', async () => {
    card()
    await expand()
    expect(m.get).toHaveBeenCalledWith('/api/v1/dashboard/venues/v1/exchanges/x1')
    expect(screen.getByText('Regreso al inventario solicitado')).toBeInTheDocument()
    expect(screen.getByText('Se llevó')).toBeInTheDocument()
    expect(screen.getByText('Vestido azul L')).toBeInTheDocument()
    expect(screen.getByText('Talla')).toBeInTheDocument()
    expect(screen.getByText(/Precio heredado/)).toBeInTheDocument()
    expect(screen.getByText('Diferencia: $50.00')).toBeInTheDocument()
    expect(screen.getByText('Efectivo')).toBeInTheDocument()
    expect(screen.queryByText(/Importe esperado/)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Ver cobro/ })).not.toBeInTheDocument()
  })
  it('does not call an inherited piece «heredado» when it costs the same as the list', async () => {
    m.detail.taken[0].pieces = [{ priceCents: 18000, inheritedFromOrderItemId: 'i1' }]
    card()
    await expand()
    expect(screen.queryByText(/Precio heredado/)).not.toBeInTheDocument()
    expect(screen.getByText('Precio por pieza: $180.00')).toBeInTheDocument()
  })
  it('does not describe requested stock or goods as applied and shows all review charges', async () => {
    Object.assign(m.detail, {
      status: 'NEEDS_REVIEW',
      applied: false,
      reviewReason: 'CHARGE_AMOUNT_MISMATCH',
      chargedCents: 20000,
      chargePaymentCount: 2,
      paymentIds: ['p2', 'p3'],
    })
    card({ ...links(), asOriginal: [original('NEEDS_REVIEW')] })
    await expand()
    expect(screen.getByText('Productos que pidió regresar')).toBeInTheDocument()
    expect(screen.getByText('Regreso al inventario solicitado')).toBeInTheDocument()
    expect(screen.getByText('Pidió llevarse')).toBeInTheDocument()
    expect(screen.queryByText('Regresó al inventario')).not.toBeInTheDocument()
    expect(screen.queryByText('Se llevó')).not.toBeInTheDocument()
    expect(screen.getByText('Importe esperado: $50.00')).toBeInTheDocument()
    expect(screen.getByText('Cobrado: $200.00 en 2 cobros')).toBeInTheDocument()
    expect(screen.getByText('La terminal cobró otro importe')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver cobro p2' })).toHaveAttribute('href', '/venues/iq/payments/p2')
    expect(screen.getByRole('link', { name: 'Ver cobro p3' })).toBeInTheDocument()
  })
  it.each(['PENDING_PAYMENT', 'CANCELLED', 'COMPLETED_PENDING_CARD_REFUND'])(
    'hides review charge evidence outside NEEDS_REVIEW (%s)',
    async status => {
      Object.assign(m.detail, { status, applied: false })
      card()
      await expand()
      expect(screen.queryByText(/Importe esperado/)).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /Ver cobro/ })).not.toBeInTheDocument()
      expect(screen.getByText('Lo hizo: —')).toBeInTheDocument()
    },
  )
  it('reopening a detail reuses the fresh cached row', async () => {
    card()
    await expand()
    fireEvent.click(screen.getByRole('button', { name: /Ocultar detalle/ }))
    await expand()
    await waitFor(() => expect(m.get).toHaveBeenCalledTimes(1))
  })
  it('never invents missing review amounts and preserves unknown review reasons', async () => {
    Object.assign(m.detail, {
      status: 'NEEDS_REVIEW',
      applied: false,
      expectedChargeCents: null,
      chargedCents: null,
      chargePaymentCount: null,
      paymentIds: [],
      chargePaymentId: null,
      reviewReason: 'FUTURE_REASON',
      reviewedAt: '2026-10-26T20:00:00Z',
      reviewNote: 'Revisado con el negocio',
    })
    card()
    await expand()
    expect(screen.getByText('Importe esperado: —')).toBeInTheDocument()
    expect(screen.getByText('Cobrado: —')).toBeInTheDocument()
    expect(screen.getByText('FUTURE_REASON')).toBeInTheDocument()
    expect(screen.getByText('Revisado con el negocio')).toBeInTheDocument()
  })
  it.each([undefined, { asOriginal: [], asOriginalTotal: 0, asNew: null }])('renders nothing without links (%s)', value => {
    const { container } = mount(<ExchangeLinksCard orderId="o1" links={value} />)
    expect(container).toBeEmptyDOMElement()
  })
  it('shows a loading state and a retryable error instead of an empty detail', async () => {
    m.get.mockRejectedValue(new Error('Network'))
    card()
    fireEvent.click(screen.getByRole('button', { name: /Ver detalle/ }))
    expect(screen.getByText('Cargando cambio…')).toBeInTheDocument()
    expect(await screen.findByText('No se pudo cargar el cambio.', {}, { timeout: 4000 })).toBeInTheDocument()
    m.get.mockResolvedValue({ data: { data: m.detail } })
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Vestido azul M')).toBeInTheDocument()
  })
  it('paymentDrawerContent shows the card before the payment metadata', async () => {
    mount(<PaymentDrawerContent paymentId="p1" onClose={() => {}} venueTimezone="America/Mexico_City" />)
    const link = await screen.findByRole('link', { name: 'Cambiada en ORD-002' })
    expect(link.compareDocumentPosition(screen.getByText('IQ')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
  it('with orders:read and without payments:read hides the detail and shows "Ver todos" as text', async () => {
    m.permissions = ['orders:read']
    const { container } = card({ asOriginal: [original()], asOriginalTotal: 3, asNew: null })
    expect(screen.getByRole('link', { name: 'Cambiada en ORD-002' })).toBeVisible()
    expect(screen.queryByRole('button', { name: /Ver detalle/ })).not.toBeInTheDocument()
    expect(container.querySelector('a[href*="/payments/exchanges"]')).toBeNull()
    expect(screen.getByText(es.exchange.more.replace('{{count}}', '2'))).toBeVisible()
    expect(m.get).not.toHaveBeenCalledWith('/api/v1/dashboard/venues/v1/exchanges/x1')
  })
  it('orderDrawerContent shows the section between payments and activity', async () => {
    mount(<OrderDrawerContent orderId="o1" onClose={() => {}} />)
    const link = await screen.findByRole('link', { name: 'Cambiada en ORD-002' })
    expect(screen.getByTestId('payments-section').compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(link.compareDocumentPosition(screen.getByTestId('activity-section')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
