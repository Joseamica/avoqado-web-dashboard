/**
 * PeriodBreakdownTable Component
 *
 * Displays sales metrics in a horizontal table format with periods as columns.
 * Inspired by Square's Sales Summary report UI.
 *
 * Features:
 * - Horizontal scroll for many columns (24 hours, 31 days, etc.)
 * - Sticky first column (metric name)
 * - Collapsible rows for grouped metrics
 * - Transaction count display below amounts
 */

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Currency } from '@/utils/currency'
import type { TimePeriodMetrics, ReportType, SalesSummaryMetrics } from '@/services/reports/salesSummary.service'

// ============================================================
// Types
// ============================================================

interface PeriodBreakdownTableProps {
  periods: TimePeriodMetrics[]
  selectedMetrics: string[]
  reportType: ReportType
  venueTimezone?: string
  /** D14.2: la cabecera del SERVIDOR para la columna «Total» (la misma cifra que el Resumen; la pantalla no suma). */
  total?: SalesSummaryMetrics
}

type MetricKey = keyof TimePeriodMetrics['metrics']

interface MetricRowConfig {
  key: MetricKey
  translationKey: string
  type: 'positive' | 'negative' | 'neutral' | 'bold'
  indent?: number
  parentKey?: string // For collapsible child rows
  /** Renglón del que es parte (sangría sólo si ese renglón está a la vista), sin plegarse con él. */
  bajo?: MetricKey
  showTransactions?: boolean
}

// ============================================================
// Metric Configuration
// ============================================================

const METRIC_ROWS: MetricRowConfig[] = [
  // Ventas brutas (collapsible parent)
  { key: 'grossSales', translationKey: 'grossSales', type: 'positive', showTransactions: true },
  { key: 'items', translationKey: 'items', type: 'positive', indent: 1, parentKey: 'grossSales' },
  { key: 'serviceCosts', translationKey: 'serviceCosts', type: 'positive', indent: 1, parentKey: 'grossSales' },

  // Lo que resta a las ventas
  { key: 'refunds', translationKey: 'refunds', type: 'negative' },
  { key: 'discounts', translationKey: 'discounts', type: 'negative' },
  // D14.5: «Ventas netas» una sola vez (antes se repetía como «Total de las ventas», con el mismo número). Los impuestos ya van
  // dentro (México): renglón informativo después, como en el Resumen.
  { key: 'netSales', translationKey: 'netSales', type: 'bold' },
  // Informativo y al ras: con una devolución de otro día las ventas netas pueden quedar por debajo de sus impuestos (Codex r3 C).
  { key: 'taxes', translationKey: 'taxes', type: 'neutral' },

  // Propinas y comisiones: lo que lleva de «Ventas netas» a «Neto cobrado» (D14.1: antes faltaban; la llave era `commissions`).
  { key: 'tips', translationKey: 'tips', type: 'positive' },
  { key: 'platformFees', translationKey: 'platformFees', type: 'negative' },
  { key: 'tenderCommissions', translationKey: 'tenderCommissions', type: 'negative' },
  { key: 'totalCollected', translationKey: 'totalCollected', type: 'bold', showTransactions: true },

  // De «Neto cobrado» a «Ganancia neta»
  { key: 'staffCommissions', translationKey: 'staffCommissions', type: 'negative' },
  { key: 'netProfit', translationKey: 'netProfit', type: 'bold' },

  // Aparte: no es venta (D6)
  { key: 'deferredSales', translationKey: 'deferredSales', type: 'neutral' },
]

/** Renglones que salen aunque no estén en «Métricas» cuando algún periodo trae algo (como en el Resumen). */
const SALEN_SI_HAY: MetricKey[] = ['tenderCommissions']

/** Menos de medio centavo es cero: una comisión de 4 decimales o un residuo no se pintan «−$0.00» (Codex r1 #3 del carril F). */
const sinMedioCentavo = (n: number) => (Math.abs(n) < 0.005 ? 0 : n)
/** Lo que resta se pinta en negativo; un reverso (valor negativo) suma. */
const comoResta = (n: number) => sinMedioCentavo(-n)

// Parents that can be collapsed
const COLLAPSIBLE_PARENTS = ['grossSales']

// ============================================================
// Helper Functions
// ============================================================

 
function getReportTypeLabel(reportType: ReportType, t: (key: string, options?: any) => string): string {
  const labels: Record<ReportType, string> = {
    summary: t('salesSummary.controls.reportType.options.summary'),
    hours: t('salesSummary.periodTable.hourly'),
    days: t('salesSummary.periodTable.daily'),
    weeks: t('salesSummary.periodTable.weekly'),
    months: t('salesSummary.periodTable.monthly'),
    hourlySum: t('salesSummary.periodTable.hourlySum'),
    dailySum: t('salesSummary.periodTable.dailySum'),
  }
  return labels[reportType] || reportType
}

 
function getSubtitleForReportType(reportType: ReportType, t: (key: string, options?: any) => string, timezone?: string): string {
  const tz = timezone || 'America/Mexico_City'
  switch (reportType) {
    case 'hours':
    case 'hourlySum':
    case 'dailySum':
      return t('salesSummary.periodTable.allDaySubtitle', { timezone: tz })
    case 'days':
      return t('salesSummary.periodTable.allWeekSubtitle')
    case 'weeks':
      return t('salesSummary.periodTable.allWeeksSubtitle')
    case 'months':
      return t('salesSummary.periodTable.allMonthsSubtitle')
    default:
      return ''
  }
}

// ============================================================
// Component
// ============================================================

export function PeriodBreakdownTable({
  periods,
  selectedMetrics,
  reportType,
  venueTimezone = 'America/Mexico_City',
  total,
}: PeriodBreakdownTableProps) {
  const { t } = useTranslation('reports')

  // Track which parent rows are expanded
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set(COLLAPSIBLE_PARENTS))

  // Filter metrics based on selection
  const visibleMetrics = useMemo(() => {
    return METRIC_ROWS.filter(row => {
      // Vista de movimientos (filtro de método o de comercio, D9.1): el servidor manda las métricas de orden en null en TODOS los
      // periodos. Ese renglón no se pinta (antes salía «N/A», o «−$0.00» en los negativos), igual que en la cabecera.
      const tieneValor = periods.some(p => p.metrics[row.key] != null)
      // «Sin cobrar» (D6) sale sola si algún periodo tiene cuentas abiertas, como en la cabecera (Codex r2 #8).
      const hayCuentasAbiertas = row.key === 'deferredSales' && periods.some(p => (p.metrics.unpaidOrders ?? 0) > 0)
      const saleSola = SALEN_SI_HAY.includes(row.key) && periods.some(p => Number(p.metrics[row.key] ?? 0) !== 0)
      return tieneValor && (selectedMetrics.length === 0 || selectedMetrics.includes(row.key) || hayCuentasAbiertas || saleSola)
    })
  }, [selectedMetrics, periods])

  // Con un filtro de pago o de comercio el SERVIDOR no puede medir las métricas de orden (null en todos los periodos): si alguna
  // elegida quedó fuera, se dice, para que una tabla sin renglones no parezca vacía (Codex r2 #7).
  const hayOcultasPorFiltro = METRIC_ROWS.some(
    row => selectedMetrics.includes(row.key) && periods.length > 0 && periods.every(p => p.metrics[row.key] == null),
  )

  // Toggle row expansion
  const toggleRow = (key: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const aLaVista = (key: string | undefined) => !!key && visibleMetrics.some(r => r.key === key && !r.parentKey)

  // Check if a child row should be visible. Sin su padre a la vista (no elegido), sale solo: plegado antes no la esconde (Codex r1 #1).
  const isChildVisible = (row: MetricRowConfig): boolean => {
    if (!row.parentKey || !aLaVista(row.parentKey)) return true
    return expandedRows.has(row.parentKey)
  }

  // Check if a row is a collapsible parent
  const isCollapsibleParent = (key: string): boolean => {
    return COLLAPSIBLE_PARENTS.includes(key)
  }

  if (!periods || periods.length === 0) {
    return null
  }

  return (
    // `@container`: lo que se fija depende del ancho de la TABLA, no de la ventana (con el menú lateral abierto una ventana ancha
    // deja una tabla angosta; Codex r2 #5 del carril F).
    <div className="@container rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
      {/* Scrollable container */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse table-fixed">
          {/* Header row with period labels */}
          <thead>
            <tr className="border-b border-border/30">
              {/* Sticky first column - Report type header (Square-style: ~300px) */}
              <th className="sticky left-0 z-20 bg-card/95 backdrop-blur-sm px-3 @xl:px-6 py-5 text-left w-[112px] min-w-[112px] @md:w-[140px] @md:min-w-[140px] @xl:w-[300px] @xl:min-w-[300px] border-r border-border/30">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {getReportTypeLabel(reportType, t)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {getSubtitleForReportType(reportType, t, venueTimezone)}
                  </p>
                </div>
              </th>

              {/* Period columns (150px each, centered) */}
              {periods.map((period, idx) => (
                <th
                  key={period.period}
                  className={cn(
                    'px-2 @md:px-4 py-5 text-sm font-medium text-foreground w-[128px] min-w-[128px] @xl:w-[150px] @xl:min-w-[150px] text-center',
                    idx < periods.length - 1 && 'border-r border-border/20'
                  )}
                >
                  {period.periodLabel || period.period}
                </th>
              ))}
              {total && (
                // Pegada a la derecha cuando la tabla es ancha, como la primera a la izquierda: con 7 días o 24 horas el total no se pierde
                // al fondo del scroll. En una tabla angosta las dos fijas no dejaban ver ningún día (Codex r1 #6, r2 #5): ahí es la última.
                <th className="@3xl:sticky @3xl:right-0 z-20 px-4 py-5 text-sm font-semibold text-foreground w-[128px] min-w-[128px] @xl:w-[150px] @xl:min-w-[150px] text-center border-l border-border/40 bg-muted">
                  {t('salesSummary.periodTable.total')}
                </th>
              )}
            </tr>
          </thead>

          {/* Data rows */}
          <tbody>
            {visibleMetrics.map((row, rowIdx) => {
              // Skip child rows if parent is collapsed
              if (!isChildVisible(row)) return null

              // Sin hijos elegidos no hay nada que desplegar: sin flecha.
              const isParent =
                isCollapsibleParent(row.key) && !row.parentKey && visibleMetrics.some(r => r.parentKey === row.key)
              const isExpanded = expandedRows.has(row.key)
              // Sangría sólo bajo un renglón que se ve: sin «Ventas brutas» o sin «Ventas netas», sus partes van al ras.
              const isChild = aLaVista(row.parentKey ?? row.bajo)
              const isBold = row.type === 'bold'
              const isNegative = row.type === 'negative'

              return (
                <tr
                  key={`${row.key}-${row.translationKey}-${rowIdx}`}
                  className={cn(
                    'border-b border-border/20 transition-colors',
                    isBold && 'bg-muted/30',
                    !isBold && 'hover:bg-muted/20'
                  )}
                >
                  {/* Sticky metric name column (Square-style spacing) */}
                  <td
                    className={cn(
                      'sticky left-0 z-10 bg-card/95 backdrop-blur-sm px-3 @xl:px-6 py-3.5 border-r border-border/30',
                      isChild && 'pl-6 @xl:pl-12'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {/* Collapse/expand toggle for parent rows */}
                      {isParent && (
                        <button
                          onClick={() => toggleRow(row.key)}
                          type="button"
                          className="p-0.5 hover:bg-muted rounded transition-colors cursor-pointer"
                          aria-expanded={isExpanded}
                          aria-label={t(isExpanded ? 'salesSummary.periodTable.collapse' : 'salesSummary.periodTable.expand')}
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          )}
                        </button>
                      )}

                      <span
                        className={cn(
                          'text-sm',
                          isBold ? 'font-semibold text-foreground' : 'text-foreground/90',
                          isChild && 'text-muted-foreground'
                        )}
                      >
                        {t(`salesSummary.rows.${row.translationKey}`)}
                      </span>
                    </div>
                    {/* Debajo de «Neto cobrado − empleados» la cuenta no da sin decir que también salen las propinas (Codex r2 #4). */}
                    {row.key === 'netProfit' && (
                      <p className="mt-0.5 text-xs font-normal text-muted-foreground">{t('salesSummary.netProfitCaption')}</p>
                    )}
                  </td>

                  {/* Value cells for each period (150px, centered), then the «Total» column */}
                  {[...periods.map(p => ({ id: p.period, metrics: p.metrics, esTotal: false })), ...(total ? [{ id: 'total', metrics: total, esTotal: true }] : [])].map(
                    (col, colIdx, cols) => {
                      const value = col.metrics[row.key]
                      // D14.4: null = el SERVIDOR no puede medirlo con este filtro: «—», no un cero.
                      const shown = value == null ? null : isNegative ? comoResta(Number(value)) : sinMedioCentavo(Number(value))
                      const transactionCount = row.showTransactions ? col.metrics.transactionCount : 0
                      // «Sin cobrar»: cuántas cuentas abiertas (sólo un servidor con base de caja lo manda).
                      const cuentasAbiertas = row.key === 'deferredSales' ? (col.metrics.unpaidOrders ?? 0) : 0

                      return (
                        <td
                          key={`${col.id}-${row.key}`}
                          className={cn(
                            'px-2 @md:px-4 py-4 w-[128px] min-w-[128px] @xl:w-[150px] @xl:min-w-[150px] text-center',
                            colIdx < cols.length - 1 && !cols[colIdx + 1].esTotal && 'border-r border-border/20',
                            col.esTotal && '@3xl:sticky @3xl:right-0 z-10 w-[128px] min-w-[128px] @xl:w-[150px] @xl:min-w-[150px] border-l border-border/40 bg-muted font-semibold',
                            isBold && !col.esTotal && 'bg-muted/30'
                          )}
                        >
                          <span
                            className={cn(
                              'text-sm tabular-nums',
                              (isBold || col.esTotal) && 'font-semibold',
                              shown != null && shown < 0 && 'text-red-500',
                              (shown == null || shown === 0) && 'text-muted-foreground'
                            )}
                          >
                            {shown == null ? '—' : Currency(shown)}
                          </span>

                          {/* Transaction count */}
                          {row.showTransactions && transactionCount > 0 && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {transactionCount} {t('salesSummary.transactionsLabel')}
                            </div>
                          )}
                          {cuentasAbiertas > 0 && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {cuentasAbiertas} {t('salesSummary.unpaidOrdersLabel', { count: cuentasAbiertas })}
                            </div>
                          )}
                        </td>
                      )
                    },
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {hayOcultasPorFiltro && (
        <p className="border-t border-border/30 px-4 py-3 text-xs italic text-muted-foreground">
          {t('salesSummary.controls.filterBy.hiddenMetricsMessage')}
        </p>
      )}
    </div>
  )
}

export default PeriodBreakdownTable
