// src/pages/Commissions/__tests__/CommissionKPICards.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import CommissionKPICards from '../components/CommissionKPICards'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }))

const stats = (extra: Record<string, unknown> = {}) => ({
  totalPaid: 45,
  totalCalculated: 545,
  totalPending: 0,
  totalApproved: 0,
  staffWithCommissions: 2,
  averageCommission: 30,
  topEarners: [],
  ...extra,
})

describe('CommissionKPICards — «Calculado» y «Pagado» desde recibos (spec §8, decisión 13)', () => {
  it('sin aprobaciones ya no hay «Pendiente» ni «Aprobado»; «Calculado» siempre', () => {
    render(<CommissionKPICards stats={stats({ staffPayActive: true })} isLoading={false} />)
    expect(screen.queryByText('stats.pending')).toBeNull()
    expect(screen.queryByText('stats.approved')).toBeNull()
    expect(screen.getByText('stats.calculated')).toBeInTheDocument()
    expect(screen.getByText('$545')).toBeInTheDocument()
  })

  it('sin pago al personal activo la tarjeta «Pagado» no aparece', () => {
    render(<CommissionKPICards stats={stats({ staffPayActive: false })} isLoading={false} />)
    expect(screen.queryByText('stats.paid')).toBeNull()
    expect(screen.getByText('stats.calculated')).toBeInTheDocument()
  })

  it('con pago al personal activo, «Pagado» es lo pagado en recibos', () => {
    render(<CommissionKPICards stats={stats({ staffPayActive: true })} isLoading={false} />)
    expect(screen.getByText('stats.paid')).toBeInTheDocument()
    expect(screen.getByText('$45')).toBeInTheDocument()
  })
})
