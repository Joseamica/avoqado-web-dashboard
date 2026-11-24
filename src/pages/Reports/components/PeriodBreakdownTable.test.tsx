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

  it('🔴 Codex r3 C · «Impuestos incluidos» va al ras: con una devolución de otro día puede ser mayor que «Ventas netas»', () => {
    render(<PeriodBreakdownTable periods={[periodo({ netSales: 0, taxes: 16 })]} selectedMetrics={ELEGIDAS} reportType="days" />)
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

  it('🔴 Codex r2 #4 · «Ganancia neta» dice en la tabla que también salen las propinas', () => {
    render(<PeriodBreakdownTable periods={[periodo({})]} selectedMetrics={ELEGIDAS} reportType="days" />)
    expect(screen.getByText('salesSummary.netProfitCaption')).toBeInTheDocument()
  })

  it('🔴 Codex r2 #7 · con un filtro de pago y sólo métricas de orden elegidas, la tabla dice por qué no hay renglones', () => {
    const nulas = { grossSales: null, items: null, serviceCosts: null, discounts: null, netSales: null, deferredSales: null, taxes: null }
    render(<PeriodBreakdownTable periods={[periodo(nulas)]} selectedMetrics={['grossSales']} reportType="days" />)
    expect(screen.getByText('salesSummary.controls.filterBy.hiddenMetricsMessage')).toBeInTheDocument()
  })

  it('control · sin filtro no sale el aviso de métricas ocultas', () => {
    render(<PeriodBreakdownTable periods={[periodo({})]} selectedMetrics={ELEGIDAS} reportType="days" />)
    expect(screen.queryByText('salesSummary.controls.filterBy.hiddenMetricsMessage')).not.toBeInTheDocument()
  })

  it('🔴 Codex r2 #5 · el «Total» sólo se fija a la derecha cuando la TABLA es ancha (contenedor), no la ventana', () => {
    render(<PeriodBreakdownTable periods={[periodo({})]} total={BASE} selectedMetrics={ELEGIDAS} reportType="days" />)
    const th = screen.getByRole('columnheader', { name: 'salesSummary.periodTable.total' })
    expect(th.className).toMatch(/@3xl:sticky/)
    expect(th.className).not.toMatch(/(^|\s)sm:sticky/)
  })

  it('🔴 full-testing W5 · «Cargos por servicio» sale si algún periodo lo trae, aunque no esté en «Métricas» (como el Resumen)', () => {
    render(<PeriodBreakdownTable periods={[periodo({ serviceCosts: 9.4 })]} selectedMetrics={ELEGIDAS} reportType="days" />)
    expect(screen.getByText('salesSummary.rows.serviceCosts')).toBeInTheDocument()
  })
})


describe('PeriodBreakdownTable · comparar con otro periodo (carril F2, hz:fefa11b6:D7)', () => {
  const TOTAL = { ...BASE, grossSales: 300, netSales: 300, refunds: 20, totalCollected: 290 }
  const comparado = {
    ventana: 'lun 9 nov – dom 15 nov',
    metrics: { ...BASE, grossSales: 200, netSales: 200, refunds: 10, totalCollected: 200, tenderCommissions: 30 },
    changes: {
      grossSales: { difference: 100, percent: 50, isNew: false },
      refunds: { difference: 10, percent: 100, isNew: false },
      tenderCommissions: { difference: -30, percent: -100, isNew: false },
    },
  }

  it('🔴 la celda de «Total» trae el total del otro periodo y su cambio; el encabezado, su ventana', () => {
    render(<PeriodBreakdownTable periods={[periodo({}, 20)]} total={TOTAL} comparado={comparado} selectedMetrics={['grossSales', 'refunds']} reportType="days" />)
    expect(screen.getByTestId('period-table-compared')).toHaveTextContent('salesSummary.compare.versus')
    const fila = screen.getByText('salesSummary.rows.grossSales').closest('tr') as HTMLElement
    const ultima = (f: HTMLElement) => within(f).getAllByRole('cell').slice(-1)[0]
    const total = ultima(fila)
    expect(total.textContent).toContain('$200.00')
    expect(total.querySelector('[data-tono]')?.getAttribute('data-tono')).toBe('mejora')
    // Lo que resta: el «antes» en negativo, y más devoluciones es rojo.
    const devoluciones = ultima(screen.getByText('salesSummary.rows.refunds').closest('tr') as HTMLElement)
    expect(devoluciones.textContent).toContain('-$10.00')
    expect(devoluciones.querySelector('[data-tono]')?.getAttribute('data-tono')).toBe('empeora')
  })

  it('🔴 «Comisiones de terceros» sale si el otro periodo las tuvo, aunque este periodo no', () => {
    render(<PeriodBreakdownTable periods={[periodo({ tenderCommissions: 0 }, 20)]} total={TOTAL} comparado={comparado} selectedMetrics={['grossSales']} reportType="days" />)
    expect(screen.getByText('salesSummary.rows.tenderCommissions')).toBeInTheDocument()
  })

  it('control · sin comparación, la tabla de siempre (sin «antes»)', () => {
    render(<PeriodBreakdownTable periods={[periodo({}, 20)]} total={TOTAL} selectedMetrics={['grossSales']} reportType="days" />)
    expect(screen.queryByTestId('period-table-compared')).not.toBeInTheDocument()
    expect(screen.queryAllByTestId('comparado')).toHaveLength(0)
  })
})
