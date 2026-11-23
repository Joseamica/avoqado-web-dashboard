import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CardBrandBreakdown, PaymentMethodBreakdown } from '@/types'

vi.mock('@/utils/currency', () => ({ Currency: (n: number) => `$${n}` }))

import { UnifiedPaymentSection } from './UnifiedPaymentSection'

const t = (key: string, o?: { defaultValue?: string }) => o?.defaultValue ?? key

const efectivo: PaymentMethodBreakdown = {
  method: 'CASH',
  kind: 'CASH',
  label: 'Efectivo',
  total: 250,
  tips: 0,
  count: 3,
  percentage: 75.8,
  children: [
    { label: 'Efectivo · máquina', total: 150, tips: 0, count: 2 },
    { label: 'Gaveta', total: 100, tips: 0, count: 1 },
  ],
}

const credito: PaymentMethodBreakdown = {
  method: 'CREDIT_CARD',
  kind: 'CARD',
  label: 'Tarjeta de crédito',
  total: 80,
  tips: 0,
  count: 1,
  percentage: 24.2,
  // Aunque el servidor mande hijos de una tarjeta, la tarjeta se ve como hoy: sólo sus marcas.
  children: [{ label: 'Terminal BBVA', total: 80, tips: 0, count: 1 }],
}

const marcas: CardBrandBreakdown[] = [{ brand: 'VISA', total: 80, count: 1, percentage: 100 }]

describe('UnifiedPaymentSection', () => {
  it('dibuja los hijos del efectivo (gaveta y máquina) con su total y su número de cobros', () => {
    render(<UnifiedPaymentSection paymentMethods={[efectivo]} cardBrands={marcas} t={t} />)

    const filas = screen.getAllByTestId('payment-method-child')
    expect(filas).toHaveLength(2)
    expect(filas[0]).toHaveTextContent('Efectivo · máquina')
    expect(filas[0]).toHaveTextContent('(2)')
    expect(filas[0]).toHaveTextContent('$150')
    expect(filas[1]).toHaveTextContent('Gaveta')
    expect(filas[1]).toHaveTextContent('(1)')
    expect(filas[1]).toHaveTextContent('$100')
    // El efectivo no se cuelga las marcas de tarjeta.
    expect(screen.queryByText('detail.paymentBreakdown.byCardBrand')).toBeNull()
    expect(screen.queryByText('VISA')).toBeNull()
  })

  it('la tarjeta se ve como hoy: sus marcas, sin hijos genéricos', () => {
    render(<UnifiedPaymentSection paymentMethods={[credito]} cardBrands={marcas} t={t} />)

    expect(screen.getByText('detail.paymentBreakdown.byCardBrand')).toBeInTheDocument()
    expect(screen.getByText('VISA')).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(screen.queryByText('Terminal BBVA')).toBeNull()
    expect(screen.queryAllByTestId('payment-method-child')).toHaveLength(0)
  })

  it('un método sin hijos no dibuja lista', () => {
    const transferencia: PaymentMethodBreakdown = {
      method: 'BANK_TRANSFER',
      kind: 'OTHER',
      label: 'Transferencia',
      total: 50,
      tips: 0,
      count: 1,
      percentage: 100,
    }
    render(<UnifiedPaymentSection paymentMethods={[transferencia]} cardBrands={marcas} t={t} />)

    expect(screen.getByText('Transferencia')).toBeInTheDocument()
    expect(screen.queryAllByTestId('payment-method-child')).toHaveLength(0)
    expect(screen.queryByText('detail.paymentBreakdown.byCardBrand')).toBeNull()
  })
})
