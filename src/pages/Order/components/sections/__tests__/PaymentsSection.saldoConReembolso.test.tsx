/**
 * El detalle de la cuenta dice cuánto falta también cuando la cuenta tiene un reembolso, si sigue ABIERTA (pizarrón, nube,
 * 12-nov; SERVIDOR PR #394, D19 «un abono devuelto vuelve a deberse»). Cuenta de $100 con un abono de $50 devuelto: el
 * SERVIDOR guarda «falta $100» y el panel sólo enseñaba «Reembolsada −$50».
 *
 * La guarda vieja (`!isRefunded`) se queda para las ventas ya CERRADAS: una venta completada y reembolsada no se vuelve a
 * cobrar (18-ago), aunque una fila vieja traiga un saldo guardado por el defecto anterior a esa regla.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

import { PaymentsSection } from '../PaymentsSection'

const pintar = (order: Record<string, unknown>) =>
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <PaymentsSection order={{ id: 'o1', payments: [], ...order } as never} venueTimezone="America/Mexico_City" />
    </MemoryRouter>,
  )

describe('PaymentsSection · lo que falta con un reembolso', () => {
  it('🔴 cuenta ABIERTA con su abono reembolsado: enseña el reembolso Y lo que falta ($100)', () => {
    pintar({ status: 'CONFIRMED', paymentStatus: 'PARTIAL', remainingBalance: 100, refundState: 'FULL', refundedAmount: 50 })

    expect(screen.getByText('drawer.refund.full')).toBeInTheDocument()
    expect(screen.getByText('drawer.payments.pendingBalance')).toBeInTheDocument()
    expect(screen.getByText('$100.00')).toBeInTheDocument()
  })

  it('cuenta abierta con un reembolso parcial: también enseña lo que falta', () => {
    pintar({ status: 'PENDING', paymentStatus: 'PARTIAL', remainingBalance: 30, refundState: 'PARTIAL', refundedAmount: 20 })

    expect(screen.getByText('drawer.payments.pendingBalance')).toBeInTheDocument()
    expect(screen.getByText('$30.00')).toBeInTheDocument()
  })

  it('REGRESIÓN 18-ago: venta COMPLETADA y reembolsada no invita a cobrar, aunque una fila vieja guarde saldo', () => {
    pintar({ status: 'COMPLETED', paymentStatus: 'PARTIAL', remainingBalance: 200, refundState: 'FULL', refundedAmount: 200 })

    expect(screen.getByText('drawer.refund.full')).toBeInTheDocument()
    expect(screen.queryByText('drawer.payments.pendingBalance')).not.toBeInTheDocument()
  })

  it('REGRESIÓN: venta pagada y reembolsada (PAID, falta 0): sin «pendiente»', () => {
    pintar({ status: 'COMPLETED', paymentStatus: 'PAID', remainingBalance: 0, refundState: 'PARTIAL', refundedAmount: 40 })

    expect(screen.queryByText('drawer.payments.pendingBalance')).not.toBeInTheDocument()
  })

  it('REGRESIÓN: sin reembolso, una cuenta con abono sigue enseñando lo que falta', () => {
    pintar({ status: 'CONFIRMED', paymentStatus: 'PARTIAL', remainingBalance: 50 })

    expect(screen.getByText('drawer.payments.pendingBalance')).toBeInTheDocument()
    expect(screen.getByText('$50.00')).toBeInTheDocument()
  })

  it('cuenta CANCELADA con un reembolso: no invita a cobrar', () => {
    pintar({ status: 'CANCELLED', paymentStatus: 'PARTIAL', remainingBalance: 100, refundState: 'FULL', refundedAmount: 50 })

    expect(screen.queryByText('drawer.payments.pendingBalance')).not.toBeInTheDocument()
  })
})
