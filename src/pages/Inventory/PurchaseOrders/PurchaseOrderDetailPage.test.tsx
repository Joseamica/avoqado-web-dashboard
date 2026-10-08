import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import PurchaseOrderDetailPage from './PurchaseOrderDetailPage'
import { purchaseOrderService, PurchaseOrderStatus, PurchaseOrderItemStatus, Unit, type PurchaseOrder } from '@/services/purchaseOrder.service'

vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venue: { id: 'venue' }, fullBasePath: '/venues/test' }) }))
vi.mock('@/context/BreadcrumbContext', () => ({ useBreadcrumb: () => ({ setCustomSegment: vi.fn(), clearCustomSegment: vi.fn() }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/hooks/use-unit-translation', () => ({ useUnitTranslation: () => ({ formatUnitWithQuantity: (_qty: number, unit: string) => unit }) }))
vi.mock('./components/POActions', () => ({ POActions: () => null }))
vi.mock('./components/InvoiceSection', () => ({ InvoiceSection: () => null }))

const order: PurchaseOrder = {
  id: 'po', venueId: 'venue', supplierId: 'supplier', orderNumber: 'XML-test', status: PurchaseOrderStatus.APPROVED,
  orderDate: new Date().toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdById: 'staff',
  subtotal: '900', total: '1044', taxRate: '0' as unknown as number, taxAmount: '144', commissionRate: 0, commission: '0',
  supplier: { name: 'Proveedor' }, items: [{ id: 'item', purchaseOrderId: 'po', rawMaterialId: 'raw', quantityOrdered: 3, quantityReceived: 0,
    unit: Unit.KILOGRAM, unitPrice: '300', total: '900', receiveStatus: PurchaseOrderItemStatus.PENDING,
    rawMaterial: { id: 'raw', name: 'Harina', unit: Unit.GRAM } }],
}

afterEach(() => { cleanup(); vi.restoreAllMocks() })
function mount(value = order) {
  vi.spyOn(purchaseOrderService, 'getPurchaseOrder').mockResolvedValue({ data: value } as any)
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={['/orders/po']}><Routes><Route path="/orders/:poId" element={<PurchaseOrderDetailPage />} /></Routes></MemoryRouter>
  </QueryClientProvider>)
}

it('shows purchase quantity in kg while inventory stores grams', async () => {
  mount()
  const row = (await screen.findByText('Harina')).closest('tr')!
  expect(within(row).getByText('3 KILOGRAM')).toBeInTheDocument()
})

it('does not claim a 0% tax rate for XML taxes whose rate is unknown', async () => {
  mount()
  await screen.findByText('Harina')
  expect(screen.queryByText('details.tax (0%)')).not.toBeInTheDocument()
  expect(screen.getByText('details.tax')).toBeInTheDocument()
})

it('the receive dialog also counts purchase units, not base inventory units', async () => {
  mount()
  await screen.findByText('Harina')
  fireEvent.click(screen.getByRole('button', { name: 'actions.receive' }))
  expect(within(screen.getByRole('dialog')).getAllByText(/KILOGRAM/).length).toBeGreaterThan(0)
  expect(within(screen.getByRole('dialog')).queryByText(/^GRAM$/)).not.toBeInTheDocument()
})

it('keeps presentation names and actual zero tax on manual orders', async () => {
  mount({ ...order, taxRate: 0, taxAmount: '0', total: '900', items: [{ ...order.items[0], presentationName: 'caja' }] })
  await screen.findByText('Harina')
  expect(screen.getByText('3 caja')).toBeInTheDocument()
  expect(screen.getByText('details.tax (0%)')).toBeInTheDocument()
})
