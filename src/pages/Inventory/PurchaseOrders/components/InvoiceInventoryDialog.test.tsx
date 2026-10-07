import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { InvoiceInventoryDialog } from './InvoiceInventoryDialog'
import { purchaseOrderInvoiceService, type PurchaseOrderInvoice } from '@/services/purchaseOrderInvoice.service'

vi.mock('@/services/purchaseOrderInvoice.service', () => ({
  purchaseOrderInvoiceService: { previewInventory: vi.fn(), confirmInventory: vi.fn() },
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/hooks/use-unit-translation', () => ({ useUnitTranslation: () => ({ getShortLabel: (unit: string) => unit }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: () => {} }) }))

const invoice = { id: 'invoice', iepsCents: 0 } as PurchaseOrderInvoice
const review = {
  action: 'PREPARE' as const,
  confirmationToken: 'a'.repeat(64),
  supplier: 'Proveedor',
  subtotal: '900',
  total: '1044',
  iva: '144',
  ieps: '0',
  includeIepsInCost: false,
  lines: [
    {
      lineId: 'line',
      name: 'Harina',
      quantity: '3',
      unit: 'KILOGRAM',
      presentationName: null,
      baseQuantity: '3000',
      baseUnit: 'GRAM',
      costAmount: '900',
      baseUnitCost: '0.3',
    },
  ],
}

afterEach(cleanup)
beforeEach(() => {
  vi.mocked(purchaseOrderInvoiceService.previewInventory).mockResolvedValue(review)
  vi.mocked(purchaseOrderInvoiceService.confirmInventory).mockResolvedValue({ purchaseOrderId: 'order', status: 'PENDING_APPROVAL' })
})
function mount(props = invoice) {
  const onClose = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <InvoiceInventoryDialog venueId="venue" invoice={props} onClose={onClose} />
    </QueryClientProvider>,
  )
  return onClose
}

it('opening the review has no stock effects; only explicit confirmation sends its current token', async () => {
  const close = mount()
  await screen.findByText('Harina')
  expect(screen.getByText('3 KILOGRAM → 3000 GRAM')).toBeInTheDocument()
  expect(purchaseOrderInvoiceService.confirmInventory).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'invoices.receipt.confirmPrepare' }))
  await waitFor(() => expect(purchaseOrderInvoiceService.confirmInventory).toHaveBeenCalledWith('venue', 'invoice', 'a'.repeat(64), false))
  await waitFor(() => expect(close).toHaveBeenCalledTimes(1))
})

it('explains automatic supplier registration and shows the configured box conversion before confirmation', async () => {
  vi.mocked(purchaseOrderInvoiceService.previewInventory).mockResolvedValue({
    ...review,
    supplierWillBeCreated: true,
    supplierRfc: 'AAA010101AAA',
    lines: [{ ...review.lines[0], presentationName: 'caja de 12 kg', baseQuantity: '36000', baseUnitCost: '0.025' }],
  })
  mount()
  expect(await screen.findByText('invoices.receipt.supplierAutoCreate')).toBeInTheDocument()
  expect(screen.getByText('3 caja de 12 kg → 36000 GRAM')).toBeInTheDocument()
  expect(purchaseOrderInvoiceService.confirmInventory).not.toHaveBeenCalled()
})

it('a rejected server review cannot be confirmed', async () => {
  vi.mocked(purchaseOrderInvoiceService.previewInventory).mockRejectedValue({ response: { data: { message: 'Unidad inválida' } } })
  mount()
  expect(await screen.findByRole('alert')).toHaveTextContent('Unidad inválida')
  expect(screen.getByRole('button', { name: 'invoices.receipt.confirmPrepare' })).toBeDisabled()
  expect(purchaseOrderInvoiceService.confirmInventory).not.toHaveBeenCalled()
})

it('an approved receipt keeps its IEPS choice frozen and confirms the receive preview', async () => {
  vi.mocked(purchaseOrderInvoiceService.previewInventory).mockResolvedValue({ ...review, action: 'RECEIVE', includeIepsInCost: true })
  mount({ ...invoice, iepsCents: 8000, inventoryPreparedAt: '2026-10-05T18:00:00Z', inventoryIncludeIeps: true })
  await screen.findByText('Harina')
  expect(screen.getByRole('checkbox')).toBeDisabled()
  expect(screen.getByRole('checkbox')).toBeChecked()
  fireEvent.click(screen.getByRole('button', { name: 'invoices.receipt.confirmReceive' }))
  await waitFor(() => expect(purchaseOrderInvoiceService.confirmInventory).toHaveBeenCalledWith('venue', 'invoice', 'a'.repeat(64), true))
})
