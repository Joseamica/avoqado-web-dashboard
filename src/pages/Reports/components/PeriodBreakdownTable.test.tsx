import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { TimePeriodMetrics } from '@/services/reports/salesSummary.service'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }))

import { PeriodBreakdownTable } from './PeriodBreakdownTable'

const BASE: TimePeriodMetrics['metrics'] = {
  grossSales: 100, items: 100, serviceCosts: 0, discounts: 0, netSales: 100, deferredSales: 0, taxes: 0, refunds: 0, tips: 10,
  platformFees: 0, staffCommissions: 0, commissions: 0, totalCollected: 110, netProfit: 100, transactionCount: 1,
}
const periodo = (metrics: Partial<TimePeriodMetrics['metrics']>, dia = 21): TimePeriodMetrics => ({
  period: `2026-11-${dia}`, periodLabel: `${dia} nov`, metrics: { ...BASE, ...metrics },
})

describe('PeriodBreakdownTable · vista de movimientos (carril B, D9.1)', () => {
  it('🔴 con las métricas de orden en null (filtro de método o de comercio) esos renglones no se pintan: ni «N/A» ni «−$0.00»', () => {
    const nulas = { grossSales: null, items: null, serviceCosts: null, discounts: null, netSales: null, deferredSales: null, taxes: null }
    render(<PeriodBreakdownTable periods={[periodo(nulas, 20), periodo(nulas, 21)]} selectedMetrics={[]} reportType="days" />)
    for (const k of ['grossSales', 'discounts', 'netSales', 'deferredSales', 'taxes', 'totalSales'])
      expect(screen.queryByText(`salesSummary.rows.${k}`)).not.toBeInTheDocument()
    expect(screen.queryByText('N/A')).not.toBeInTheDocument()
    expect(screen.getByText('salesSummary.rows.totalCollected')).toBeInTheDocument()
  })

  it('🔴 D6 · «Sin cobrar» sale sola con cuentas abiertas (aunque no esté elegida), con cuántas por día', () => {
    render(
      <PeriodBreakdownTable
        periods={[periodo({ deferredSales: 695, unpaidSales: 695, unpaidOrders: 3 }, 20), periodo({ deferredSales: 0, unpaidOrders: 0 }, 21)]}
        selectedMetrics={['grossSales', 'netSales', 'totalCollected']}
        reportType="days"
      />,
    )
    expect(screen.getByText('salesSummary.rows.deferredSales')).toBeInTheDocument()
    expect(screen.getByText(/^3 salesSummary\.unpaidOrdersLabel/)).toBeInTheDocument()
  })

  it('control · sin cuentas abiertas ni elegida, «Sin cobrar» no sale', () => {
    render(<PeriodBreakdownTable periods={[periodo({ unpaidOrders: 0 })]} selectedMetrics={['grossSales']} reportType="days" />)
    expect(screen.queryByText('salesSummary.rows.deferredSales')).not.toBeInTheDocument()
  })

  it('control · sin filtro, los renglones de orden siguen (un 0 es dato, no se esconde)', () => {
    render(<PeriodBreakdownTable periods={[periodo({ discounts: 0 })]} selectedMetrics={[]} reportType="days" />)
    expect(screen.getByText('salesSummary.rows.grossSales')).toBeInTheDocument()
    expect(screen.getByText('salesSummary.rows.discounts')).toBeInTheDocument()
  })
})
