/**
 * D8 (26-oct): el recibo de la terminal guarda sus productos en `items`, fuera de `order`; el visor no los enseñaba.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ModernReceiptDesign } from '@/components/receipts/ModernReceiptDesign'
import type { DigitalReceipt } from '@/types/receipt'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

// La forma de `digitalReceipt.tpv.service.ts` (avoqado-server): `order` sin `items` y los productos arriba.
const reciboDeLaTerminal = {
  id: 'r1',
  accessKey: 'abc',
  paymentId: 'pay_1',
  status: 'PENDING',
  createdAt: '2026-10-26T18:00:00.000Z',
  dataSnapshot: {
    payment: { id: 'pay_1', amount: 120, tipAmount: 0, method: 'CASH', status: 'COMPLETED', createdAt: '2026-10-26T18:00:00.000Z' },
    venue: { id: 'v1', name: 'Testarudo Cafe', currency: 'MXN' },
    order: { id: 'o1', number: '42', subtotal: 120, taxAmount: 0, total: 120 },
    items: [
      { id: 'i1', productName: 'Latte', quantity: 2, unitPrice: 55, total: 110, modifiers: [{ name: 'Leche de avena', quantity: 1, price: 10 }] },
    ],
  },
} as unknown as DigitalReceipt

describe('ModernReceiptDesign · productos', () => {
  it('el recibo de la terminal enseña sus productos y sus modificadores', () => {
    render(<ModernReceiptDesign receipt={reciboDeLaTerminal} showActions={false} />)
    expect(screen.getByText('receipt.labels.itemsTitle')).toBeInTheDocument()
    expect(screen.getByText('Latte')).toBeInTheDocument()
    expect(screen.getByText('+ Leche de avena')).toBeInTheDocument()
  })

  it('un producto por peso dice los kilos y el precio por kilo; un extra doble dice «2×»', () => {
    const recibo = JSON.parse(JSON.stringify(reciboDeLaTerminal)) as typeof reciboDeLaTerminal
    ;(recibo.dataSnapshot as unknown as { items: unknown[] }).items = [
      { productName: 'Queso Oaxaca', quantity: 1, unitPrice: 100, total: 50, weightKg: 0.5, modifiers: [{ name: 'Extra', quantity: 2, price: 10 }] },
    ]
    render(<ModernReceiptDesign receipt={recibo} showActions={false} />)
    expect(screen.getByText('receipt.labels.weightPrice')).toBeInTheDocument()
    expect(screen.getByText('receipt.labels.weight')).toBeInTheDocument()
    expect(screen.queryByText('receipt.labels.quantity')).not.toBeInTheDocument()
    expect(screen.getByText('+ 2× Extra')).toBeInTheDocument()
  })

  it('D1 fotocopia: con la copia del ticket enseña SUS renglones (con su peso y nota), no los de toda la venta', () => {
    const recibo = JSON.parse(JSON.stringify(reciboDeLaTerminal)) as typeof reciboDeLaTerminal
    ;(recibo.dataSnapshot as unknown as Record<string, unknown>).lineasDelTicket = {
      lineas: [{ nombre: 'Queso Oaxaca', cantidad: 1, unitarioCents: 42000, totalCents: 12000, peso: '0.286 kg × $420.00/kg', nota: 'en rebanadas' }],
      subtotalCents: 12000,
      descuentoCents: 0,
    }
    render(<ModernReceiptDesign receipt={recibo} showActions={false} />)
    expect(screen.getByText('Queso Oaxaca')).toBeInTheDocument()
    expect(screen.getByText('0.286 kg × $420.00/kg')).toBeInTheDocument()
    expect(screen.getByText('en rebanadas')).toBeInTheDocument()
    expect(screen.queryByText('Latte')).not.toBeInTheDocument()
  })
})
