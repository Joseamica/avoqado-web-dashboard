/**
 * IVA por producto, plan 7 (D3; r1 #2, #8, #9; A7-R6): el visor del recibo NO calcula IVA. Con IVA incluido dice «IVA incluido
 * cuando aplica»; sólo un cobro viejo con IVA aparte, pagado completo, muestra «IVA agregado»; el cargo y el descuento van en su
 * renglón. Sin totales congelados, muestra lo cobrado en ESE pago.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ModernReceiptDesign } from '@/components/receipts/ModernReceiptDesign'
import type { DigitalReceipt, ReceiptTicketTotals } from '@/types/receipt'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

const recibo = (pago: { amount: number; tipAmount: number }, ticketTotals?: ReceiptTicketTotals): DigitalReceipt =>
  ({
    id: 'r1',
    accessKey: 'abc',
    paymentId: 'pay_1',
    status: 'SENT',
    createdAt: '2026-10-05T18:00:00.000Z',
    dataSnapshot: {
      payment: { id: 'pay_1', ...pago, method: 'CASH', status: 'COMPLETED', createdAt: '2026-10-05T18:00:00.000Z' },
      venue: { id: 'v1', name: 'Testarudo Cafe', currency: 'MXN' },
      order: { id: 'o1', orderNumber: '42', subtotal: 100, taxAmount: 16, total: 116, items: [] },
      ticketTotals,
    },
  }) as unknown as DigitalReceipt

/** true si los nodos aparecen en ese orden en el documento. */
const enOrden = (...nodos: HTMLElement[]) =>
  nodos.every((n, i) => i === 0 || Boolean(nodos[i - 1].compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING))

describe('ModernReceiptDesign · totales', () => {
  it('con IVA incluido dice la leyenda y ya no pinta «Impuestos»', () => {
    render(
      <ModernReceiptDesign
        receipt={recibo(
          { amount: 116, tipAmount: 10 },
          { kind: 'COBRO', desglosado: true, subtotal: 116, serviceCharge: 0, addedTax: 0, tip: 10, total: 126 },
        )}
        showActions={false}
      />,
    )
    expect(screen.getByText('receipt.labels.taxIncludedWhenApplies')).toBeInTheDocument()
    expect(screen.queryByText('receipt.labels.taxes')).not.toBeInTheDocument()
    expect(screen.queryByText('receipt.labels.addedTax')).not.toBeInTheDocument()
    expect(screen.queryByText('receipt.labels.discount')).not.toBeInTheDocument()
  })

  it('un cobro viejo con IVA aparte y cargo: «IVA agregado» y «Cargo por servicio» con sus cantidades, y el total', () => {
    render(
      <ModernReceiptDesign
        receipt={recibo(
          { amount: 131, tipAmount: 10 },
          { kind: 'COBRO', desglosado: true, subtotal: 100, serviceCharge: 15, addedTax: 16, tip: 10, total: 141 },
        )}
        showActions={false}
      />,
    )
    expect(screen.getByText('receipt.labels.addedTax')).toBeInTheDocument()
    // T5 m1: con IVA agregado NO va la leyenda (diría que el IVA va incluido en un ticket que lo suma aparte).
    expect(screen.queryByText('receipt.labels.taxIncludedWhenApplies')).not.toBeInTheDocument()
    expect(screen.getByText('$16.00')).toBeInTheDocument()
    expect(screen.getByText('receipt.labels.serviceCharge')).toBeInTheDocument()
    expect(screen.getByText('$15.00')).toBeInTheDocument()
    expect(screen.getByText('$141.00')).toBeInTheDocument()
  })

  it('🔴 A7-R6: recibo nuevo con descuento: «Descuento» −$10.00 entre Subtotal y Cargo, en el orden del papel, y el total', () => {
    render(
      <ModernReceiptDesign
        receipt={recibo(
          { amount: 121, tipAmount: 5 },
          { kind: 'COBRO', desglosado: true, subtotal: 100, discount: 10, serviceCharge: 15, addedTax: 16, tip: 5, total: 126 },
        )}
        showActions={false}
      />,
    )
    expect(screen.getByText('$100.00')).toBeInTheDocument()
    expect(screen.getByText('-$10.00')).toBeInTheDocument()
    expect(screen.getByText('$126.00')).toBeInTheDocument()
    const etiqueta = (k: string) => screen.getByText(`receipt.labels.${k}`)
    expect(
      enOrden(
        etiqueta('subtotal'),
        etiqueta('discount'),
        etiqueta('serviceCharge'),
        etiqueta('addedTax'),
        etiqueta('tips'),
        etiqueta('totalPaid'),
      ),
    ).toBe(true)
  })

  it('🔴 un recibo viejo (sin totales congelados) de un cobro PARCIAL: $50 de subtotal y de total, nunca los $100 de la orden', () => {
    render(<ModernReceiptDesign receipt={recibo({ amount: 50, tipAmount: 0 })} showActions={false} />)
    expect(screen.getAllByText('$50.00').length).toBeGreaterThanOrEqual(2)
    expect(screen.queryByText('$100.00')).not.toBeInTheDocument()
    expect(screen.queryByText('$16.00')).not.toBeInTheDocument()
    expect(screen.getByText('receipt.labels.taxIncludedWhenApplies')).toBeInTheDocument()
  })

  it('🔴 una devolución: subtotal, propina y total en positivo; lo dice la etiqueta «reembolsado», no un signo (r2, #2)', () => {
    const { container } = render(<ModernReceiptDesign receipt={recibo({ amount: -116, tipAmount: -10 })} showActions={false} />)
    expect(screen.getByText('$116.00')).toBeInTheDocument()
    expect(screen.getByText('$10.00')).toBeInTheDocument()
    expect(screen.getByText('$126.00')).toBeInTheDocument()
    expect(screen.queryByText('−$126.00')).not.toBeInTheDocument()
    expect(container.textContent).not.toMatch(/[-−]\s?\$/)
    expect(screen.getByText('receipt.labels.totalRefunded')).toBeInTheDocument()
    expect(screen.queryByText('receipt.labels.addedTax')).not.toBeInTheDocument()
  })

  it('🔴 r2 R2-6: una devolución de sólo propina se ve como reembolso de $10, no como cobro', () => {
    render(<ModernReceiptDesign receipt={recibo({ amount: 0, tipAmount: -10 })} showActions={false} />)
    expect(screen.getByText('receipt.labels.totalRefunded')).toBeInTheDocument()
    expect(screen.getAllByText('$10.00').length).toBeGreaterThanOrEqual(2)
  })
})

/**
 * Ronda 1 (T5): el tipo congelado del recibo (`ticketTotals.kind`) decide TODO el visor —encabezado, método de pago y pie—, igual que
 * los totales. `?refund=true` (`isRefund`) sólo respalda a un recibo viejo que no trae el tipo. Una devolución nunca dice «Pago
 * completado».
 */
describe('ModernReceiptDesign · el tipo congelado manda en todo el visor', () => {
  const devolucion: ReceiptTicketTotals = {
    kind: 'DEVOLUCION',
    desglosado: false,
    subtotal: 116,
    serviceCharge: 0,
    addedTax: 0,
    tip: 10,
    total: 126,
  }
  const cobro: ReceiptTicketTotals = { kind: 'COBRO', desglosado: true, subtotal: 116, serviceCharge: 0, addedTax: 0, tip: 10, total: 126 }

  const esVisorDeDevolucion = () => {
    expect(screen.getAllByText('types.refund').length).toBeGreaterThanOrEqual(2) // insignia del encabezado + renglón final
    expect(screen.getByText('receipt.paymentStatus.REFUND_COMPLETED')).toBeInTheDocument()
    expect(screen.queryByText('receipt.paymentStatus.COMPLETED')).not.toBeInTheDocument()
    expect(screen.getByText('receipt.footer.refundProcessed')).toBeInTheDocument()
    expect(screen.queryByText('receipt.footer.thanks')).not.toBeInTheDocument()
    expect(screen.getByText('receipt.labels.totalRefunded')).toBeInTheDocument()
  }
  const esVisorDeCobro = () => {
    expect(screen.queryByText('types.refund')).not.toBeInTheDocument()
    expect(screen.getByText('receipt.paymentStatus.COMPLETED')).toBeInTheDocument()
    expect(screen.queryByText('receipt.paymentStatus.REFUND_COMPLETED')).not.toBeInTheDocument()
    expect(screen.getByText('receipt.footer.thanks')).toBeInTheDocument()
    expect(screen.queryByText('receipt.footer.refundProcessed')).not.toBeInTheDocument()
    expect(screen.getByText('receipt.labels.totalPaid')).toBeInTheDocument()
    expect(screen.queryByText('receipt.labels.totalRefunded')).not.toBeInTheDocument()
  }

  it('🔴 una devolución congelada abierta SIN ?refund=true: encabezado, método de pago y pie de devolución', () => {
    render(<ModernReceiptDesign receipt={recibo({ amount: -116, tipAmount: -10 }, devolucion)} showActions={false} />)
    esVisorDeDevolucion()
  })

  it('🔴 un cobro congelado con ?refund=true mal puesto: manda el tipo (cobro, «Pago completado»)', () => {
    render(<ModernReceiptDesign receipt={recibo({ amount: 116, tipAmount: 10 }, cobro)} isRefund showActions={false} />)
    esVisorDeCobro()
  })

  // Ola del 7a, I-2: los paneles de autofactura y de reseña llegan como slots de `ReceiptViewer` (vista pública, sin `?refund=true`,
  // que es como abren la liga el correo y WhatsApp). En una devolución, «Facturar» timbraría un INGRESO de la venta original.
  const paneles = {
    autofacturaSlot: <button type="button">Facturar</button>,
    reviewSlot: <div>¿Cómo te atendimos?</div>,
  }

  it('🔴 I-2: una devolución abierta SIN ?refund=true no ofrece «Facturar» ni la reseña (tipo congelado o recibo viejo en negativo)', () => {
    const { unmount } = render(
      <ModernReceiptDesign receipt={recibo({ amount: -116, tipAmount: -10 }, devolucion)} showActions={false} {...paneles} />,
    )
    expect(screen.queryByText('Facturar')).not.toBeInTheDocument()
    expect(screen.queryByText('¿Cómo te atendimos?')).not.toBeInTheDocument()
    unmount()
    render(<ModernReceiptDesign receipt={recibo({ amount: -116, tipAmount: -10 })} showActions={false} {...paneles} />)
    expect(screen.queryByText('Facturar')).not.toBeInTheDocument()
    expect(screen.queryByText('¿Cómo te atendimos?')).not.toBeInTheDocument()
  })

  it('control I-2 — un cobro sí ofrece «Facturar» y la reseña', () => {
    render(<ModernReceiptDesign receipt={recibo({ amount: 116, tipAmount: 10 }, cobro)} showActions={false} {...paneles} />)
    expect(screen.getByText('Facturar')).toBeInTheDocument()
    expect(screen.getByText('¿Cómo te atendimos?')).toBeInTheDocument()
  })

  it('control — recibo viejo sin tipo: ?refund=true sigue decidiendo como hoy', () => {
    const { unmount } = render(<ModernReceiptDesign receipt={recibo({ amount: 116, tipAmount: 10 })} isRefund showActions={false} />)
    esVisorDeDevolucion()
    unmount()
    render(<ModernReceiptDesign receipt={recibo({ amount: 116, tipAmount: 10 })} showActions={false} />)
    esVisorDeCobro()
  })
})
