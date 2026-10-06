import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { POActions } from './POActions'
import { InvoiceSection } from './InvoiceSection'
import { StandaloneInvoicesSection } from './StandaloneInvoicesSection'
import { purchaseOrderService, PurchaseOrderStatus, type PurchaseOrder } from '@/services/purchaseOrder.service'
import { purchaseOrderInvoiceService, type PurchaseOrderInvoice } from '@/services/purchaseOrderInvoice.service'

vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'venue', fullBasePath: '/venue' }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({
  formatDate: (value: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date(value)),
  formatCalendarDate: (value: string) => value,
}) }))
vi.mock('@/hooks/use-tier-feature-access', () => ({ useTierFeatureAccess: () => ({ hasAccess: true }) }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/components/PermissionGate', () => ({ PermissionGate: ({ children }: { children: React.ReactNode }) => children }))
vi.mock('./InvoiceLines', () => ({ InvoiceLines: () => null }))
vi.mock('./PurchaseOrderWizard', () => ({ PurchaseOrderWizard: () => null }))
vi.mock('./LabelPrintDialog', () => ({ LabelPrintDialog: () => null }))

afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('shows receipt immediately after approving, without navigating or reloading', async () => {
  let approved = false
  vi.spyOn(purchaseOrderService, 'approvePurchaseOrder').mockImplementation(async () => {
    approved = true
    return {} as PurchaseOrder
  })
  vi.spyOn(purchaseOrderInvoiceService, 'list').mockImplementation(async () => [{
    id: 'invoice', uuid: 'uuid', totalCents: 104400, matchStatus: 'MATCHED', fechaEmision: '2026-10-05',
    inventoryPreparedAt: '2026-10-05', purchaseOrderId: 'order',
    purchaseOrder: { id: 'order', orderNumber: 'PO-1', status: approved ? 'APPROVED' : 'PENDING_APPROVAL' },
  } as PurchaseOrderInvoice])
  render(<MemoryRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <POActions purchaseOrder={{ id: 'order', status: PurchaseOrderStatus.PENDING_APPROVAL, items: [] } as unknown as PurchaseOrder} />
    <InvoiceSection venueId="venue" purchaseOrderId="order" />
  </QueryClientProvider></MemoryRouter>)
  await screen.findByText('invoices.receipt.waitingApproval')
  fireEvent.click(screen.getByRole('button', { name: 'actions.approve' }))
  await waitFor(() => expect(screen.queryByText('invoices.receipt.waitingApproval')).not.toBeInTheDocument())
  expect(screen.getByRole('button', { name: 'invoices.receipt.review' })).toBeEnabled()
})

it.each(['attached', 'inbox'])('preserves the XML calendar date in the %s at a Mexico venue', async kind => {
  const invoice = { id: 'date-invoice', uuid: 'uuid', totalCents: 104400, matchStatus: 'NO_ORDER',
    fechaEmision: '2026-10-05T00:00:00.000Z', emisorNombre: 'Proveedor' } as PurchaseOrderInvoice
  vi.spyOn(purchaseOrderInvoiceService, 'list').mockResolvedValue([invoice])
  vi.spyOn(purchaseOrderInvoiceService, 'inbox').mockResolvedValue({ rows: [invoice], total: 1, page: 1, limit: 20, totalPages: 1 })
  render(<MemoryRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {kind === 'attached' ? <InvoiceSection venueId="venue" purchaseOrderId="order" /> : <StandaloneInvoicesSection venueId="venue" />}
  </QueryClientProvider></MemoryRouter>)
  await screen.findByText(/Proveedor.*2026-10-05/)
  expect(screen.queryByText(/Proveedor.*2026-10-04/)).not.toBeInTheDocument()
})
