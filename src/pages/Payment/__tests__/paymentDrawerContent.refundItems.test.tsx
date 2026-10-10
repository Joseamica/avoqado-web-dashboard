/**
 * C2 · ola final (M1 de la revisión de A-2) — el cableado del drawer: la hoja de reembolso recibe los renglones que arma
 * `refundableItemsFromOrder` con lo que COBRÓ cada uno (`chargedTotal`) y lo ya devuelto. Si el drawer volviera a mapear los
 * renglones a mano sin `chargedTotal`, la hoja enseñaría y compararía el bruto, y sólo esta prueba lo vería.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { refundableItemsFromOrder } from '../refundAmount'

const m = vi.hoisted(() => ({ sheetProps: null as any }))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key,
    i18n: { language: 'es' },
  }),
}))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', venue: { name: 'Testarudo' } }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: () => {} }) }))
vi.mock('../IssueRefundSheet', () => ({
  IssueRefundSheet: (props: any) => {
    m.sheetProps = props
    return null
  },
}))
vi.mock('../RefundCreditNotePanel', () => ({ RefundCreditNotePanel: () => null }))
vi.mock('../CustomerSheets', () => ({ AddCustomerSheet: () => null, CustomerFormSheet: () => null }))

const items = [
  // Con descuento: el bruto es $100, cobró $90 (pesos, como lo manda el servidor junto a `total`).
  {
    id: 'oi1',
    productId: 'pr1',
    productName: 'Pan',
    quantity: 2,
    unitPrice: '50',
    total: '100.00',
    chargedTotal: 90,
    product: { trackInventory: true },
  },
  // Servidor que no manda el campo: la hoja cae al bruto.
  { id: 'oi2', productId: null, productName: null, quantity: 1, unitPrice: '35', total: '35.00', product: null },
]
const refunds = [
  {
    id: 'r1',
    amount: '-45',
    method: 'CASH',
    createdAt: '2026-10-09T18:30:00Z',
    processorData: { refundedItems: [{ orderItemId: 'oi1', quantity: 1, amount: 45 }] },
  },
]
const payment = {
  id: 'p1',
  amount: '135.00',
  tipAmount: '0',
  method: 'CASH',
  source: 'POS',
  createdAt: '2026-10-09T18:00:00Z',
  order: { id: 'o1', discountAmount: '10', total: '125', items },
}

vi.mock('@/api', () => ({
  default: {
    get: async (url: string) => {
      if (url.endsWith('/payments/p1')) return { data: payment }
      if (url.endsWith('/payments/p1/refunds')) return { data: { success: true, data: refunds } }
      if (url.endsWith('/payments/p1/receipts')) return { data: [] }
      throw new Error(`GET inesperado: ${url}`)
    },
    post: async () => ({ data: {} }),
    put: async () => ({ data: {} }),
  },
}))

import { PaymentDrawerContent } from '../PaymentDrawerContent'

describe('PaymentDrawerContent → IssueRefundSheet', () => {
  it('control — la hoja recibe lo que arma `refundableItemsFromOrder`: lo cobrado de cada renglón y lo ya devuelto', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <PaymentDrawerContent paymentId="p1" onClose={() => {}} venueTimezone="America/Mexico_City" />
      </QueryClientProvider>,
    )
    // Espera a que también lleguen los reembolsos: sin ellos `priorRefundedQty` sería 0.
    await waitFor(() => expect(m.sheetProps?.orderItems?.[0]?.priorRefundedQty).toBe(1))

    const recibidos = m.sheetProps.orderItems
    expect(recibidos).toEqual(refundableItemsFromOrder(items, refunds))
    expect(recibidos[0]).toMatchObject({ id: 'oi1', total: 100, chargedTotal: 90, priorRefundedQty: 1, priorRefundedAmount: 45 })
    expect(recibidos[1]).toMatchObject({ id: 'oi2', total: 35, chargedTotal: null, priorRefundedQty: 0 })
  })
})
