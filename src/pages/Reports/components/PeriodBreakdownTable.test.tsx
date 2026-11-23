import { fireEvent, render, screen, within } from '@testing-library/react'
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

/** El texto de la celda de un renglón (por su etiqueta) en la columna `col` (0 = primer periodo). */
const celda = (etiqueta: string, col: number) => {
  const fila = screen.getByText(`salesSummary.rows.${etiqueta}`).closest('tr') as HTMLElement
  return within(fila).getAllByRole('cell')[col + 1].textContent
}

describe('PeriodBreakdownTable · carril F (hz:fefa11b6:D14)', () => {
  const ELEGIDAS = ['grossSales', 'discounts', 'refunds', 'netSales', 'taxes', 'tips', 'platformFees', 'staffCommissions', 'totalCollected', 'netProfit']

  it('🔴 D14.1 · con las 10 métricas de siempre salen comisiones de plataforma, de terceros, a empleados y la ganancia neta', () => {
    render(
      <PeriodBreakdownTable
        periods={[periodo({ platformFees: 3, tenderCommissions: 5, staffCommissions: 7, netProfit: 85 })]}
        selectedMetrics={ELEGIDAS}
        reportType="days"
      />,
    )
    expect(celda('platformFees', 0)).toBe('-$3.00')
    expect(celda('tenderCommissions', 0)).toBe('-$5.00')
    expect(celda('staffCommissions', 0)).toBe('-$7.00')
    expect(celda('netProfit', 0)).toBe('$85.00')
  })

  it('🔴 D14.5 · ya no repite «Ventas netas» como «Total de las ventas»', () => {
    render(<PeriodBreakdownTable periods={[periodo({})]} selectedMetrics={ELEGIDAS} reportType="days" />)
    expect(screen.queryByText('salesSummary.rows.totalSales')).not.toBeInTheDocument()
    expect(screen.getAllByText('salesSummary.rows.netSales')).toHaveLength(1)
  })

  it('🔴 D14.2 · columna «Total» con la cabecera que manda el SERVIDOR (no una suma de la pantalla)', () => {
    const total = { ...BASE, grossSales: 250, netSales: 250, tips: 30, totalCollected: 280, transactionCount: 4 }
    render(<PeriodBreakdownTable periods={[periodo({}, 20), periodo({}, 21)]} total={total} selectedMetrics={ELEGIDAS} reportType="days" />)
    expect(screen.getByRole('columnheader', { name: 'salesSummary.periodTable.total' })).toBeInTheDocument()
    expect(celda('grossSales', 2)).toContain('$250.00')
    expect(celda('totalCollected', 2)).toBe('$280.004 salesSummary.transactionsLabel')
  })

  it('🔴 D14.4 · un valor que el SERVIDOR manda en null se pinta «—», nunca «$0.00» ni «−$0.00»', () => {
    render(
      <PeriodBreakdownTable
        periods={[periodo({ discounts: null }, 20), periodo({ discounts: 4 }, 21)]}
        selectedMetrics={ELEGIDAS}
        reportType="days"
      />,
    )
    expect(celda('discounts', 0)).toBe('—')
    expect(celda('discounts', 1)).toBe('-$4.00')
  })

  it('🔴 D14.5 / D16.1 · un cero que resta se pinta «$0.00», sin signo', () => {
    render(<PeriodBreakdownTable periods={[periodo({ refunds: 0, discounts: 0 })]} selectedMetrics={ELEGIDAS} reportType="days" />)
    expect(celda('refunds', 0)).toBe('$0.00')
    expect(celda('discounts', 0)).toBe('$0.00')
  })

  it('🔴 nota de D14 · una comisión revertida (valor negativo) SUMA en la tabla, como en la cabecera: «$3.00», no «−$3.00»', () => {
    render(<PeriodBreakdownTable periods={[periodo({ platformFees: -3 })]} selectedMetrics={ELEGIDAS} reportType="days" />)
    expect(celda('platformFees', 0)).toBe('$3.00')
  })

  it('control · sin «Artículos» ni «Cargos por servicio» elegidos, «Ventas brutas» no trae flecha (no hay nada que desplegar)', () => {
    render(<PeriodBreakdownTable periods={[periodo({})]} selectedMetrics={ELEGIDAS} reportType="days" />)
    expect(screen.queryByRole('button', { name: /salesSummary\.periodTable\.(collapse|expand)/ })).not.toBeInTheDocument()
  })

  it('control · con «Artículos» elegido, la flecha despliega y pliega', () => {
    render(<PeriodBreakdownTable periods={[periodo({})]} selectedMetrics={[...ELEGIDAS, 'items']} reportType="days" />)
    expect(screen.getByRole('button', { name: 'salesSummary.periodTable.collapse' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('🔴 Codex r1 #1 · «Ventas brutas» plegada y después quitada: «Artículos» elegido sigue saliendo, sin sangría', () => {
    const { rerender } = render(
      <PeriodBreakdownTable periods={[periodo({})]} selectedMetrics={[...ELEGIDAS, 'items']} reportType="days" />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'salesSummary.periodTable.collapse' }))
    expect(screen.queryByText('salesSummary.rows.items')).not.toBeInTheDocument()
    rerender(
      <PeriodBreakdownTable periods={[periodo({})]} selectedMetrics={ELEGIDAS.filter(m => m !== 'grossSales').concat('items')} reportType="days" />,
    )
    expect(screen.getByText('salesSummary.rows.items').closest('td')).not.toHaveClass('pl-6')
  })

  it('🔴 Codex r1 #1 · «Impuestos incluidos» sólo lleva sangría si «Ventas netas» está a la vista', () => {
    const { rerender } = render(<PeriodBreakdownTable periods={[periodo({})]} selectedMetrics={ELEGIDAS} reportType="days" />)
    expect(screen.getByText('salesSummary.rows.taxes').closest('td')).toHaveClass('pl-6')
    rerender(<PeriodBreakdownTable periods={[periodo({})]} selectedMetrics={ELEGIDAS.filter(m => m !== 'netSales')} reportType="days" />)
    expect(screen.getByText('salesSummary.rows.taxes').closest('td')).not.toHaveClass('pl-6')
  })

  it('🔴 Codex r1 #3 · medio centavo (comisión de 4 decimales) se pinta «$0.00», nunca «−$0.00», también en el Total', () => {
    render(
      <PeriodBreakdownTable
        periods={[periodo({ platformFees: 0.004, netSales: -0.004 })]}
        total={{ ...BASE, platformFees: 0.004 }}
        selectedMetrics={ELEGIDAS}
        reportType="days"
      />,
    )
    expect(celda('platformFees', 0)).toBe('$0.00')
    expect(celda('platformFees', 1)).toBe('$0.00')
    expect(celda('netSales', 0)).toBe('$0.00')
  })
})

