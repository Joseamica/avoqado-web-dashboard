import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MoneyLocationStrip } from './MoneyLocationStrip'

// Interpolating i18n mock: the commission number is rendered ONLY inside the
// t(...) summary line, so the mock must echo interpolated values.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key} ${Object.values(opts).join(' ')}` : key),
  }),
}))

const fmt = (n: number) => `$${n.toFixed(2)}`

describe('MoneyLocationStrip', () => {
  it('shows cash in hand, card net to receive, and commissions paid', () => {
    render(<MoneyLocationStrip cashInHand={9070} cardNetToReceive={18133} commissionsPaid={564} formatCurrency={fmt} />)
    expect(screen.getByText('$9070.00')).toBeInTheDocument() // efectivo en mano
    expect(screen.getByText('$18133.00')).toBeInTheDocument() // tarjeta neto a recibir
    expect(screen.getByText(/\$564\.00/)).toBeInTheDocument() // comisión (en la línea resumen)
  })
})
