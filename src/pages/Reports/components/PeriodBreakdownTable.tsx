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
import type { TimePeriodMetrics, ReportType } from '@/services/reports/salesSummary.service'

// ============================================================
// Types
// ============================================================

interface PeriodBreakdownTableProps {
  periods: TimePeriodMetrics[]
  selectedMetrics: string[]
  reportType: ReportType
  venueTimezone?: string
}

type MetricKey = keyof TimePeriodMetrics['metrics']

interface MetricRowConfig {
  key: MetricKey
  translationKey: string
  type: 'positive' | 'negative' | 'neutral' | 'bold'
  indent?: number
  parentKey?: string // For collapsible child rows
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

  // Individual metrics
  { key: 'refunds', translationKey: 'refunds', type: 'negative' },
  { key: 'discounts', translationKey: 'discounts', type: 'negative' },
  { key: 'netSales', translationKey: 'netSales', type: 'positive', showTransactions: true },
  { key: 'deferredSales', translationKey: 'deferredSales', type: 'neutral' },
  { key: 'taxes', translationKey: 'taxes', type: 'neutral' },

  // Total de las ventas (highlighted)
  { key: 'netSales', translationKey: 'totalSales', type: 'bold', showTransactions: true },

  // Propinas y comisiones
  { key: 'tips', translationKey: 'tips', type: 'positive' },
  { key: 'commissions', translationKey: 'commissions', type: 'negative' },

  // Total neto
  { key: 'totalCollected', translationKey: 'totalCollected', type: 'bold' },
]

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
}: PeriodBreakdownTableProps) {
  const { t } = useTranslation('reports')

  // Track which parent rows are expanded
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set(COLLAPSIBLE_PARENTS))

  // Filter metrics based on selection
  const visibleMetrics = useMemo(() => {
    return METRIC_ROWS.filter(row => {
      // Always show if no filter or metric is selected
      // Map translationKey to metric filter keys
      const metricFilterKey = row.key === 'netSales' && row.translationKey === 'totalSales'
        ? 'totalCollected'
        : row.key

      return selectedMetrics.length === 0 || selectedMetrics.includes(metricFilterKey)
    })
  }, [selectedMetrics])

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

  // Check if a child row should be visible
  const isChildVisible = (row: MetricRowConfig): boolean => {
    if (!row.parentKey) return true
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
    <div className="mt-6 rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
      {/* Scrollable container */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse table-fixed">
          {/* Header row with period labels */}
          <thead>
            <tr className="border-b border-border/30">
              {/* Sticky first column - Report type header (Square-style: ~300px) */}
              <th className="sticky left-0 z-20 bg-card/95 backdrop-blur-sm px-6 py-5 text-left w-[300px] min-w-[300px] border-r border-border/30">
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
                    'px-4 py-5 text-sm font-medium text-foreground w-[150px] min-w-[150px] text-center',
                    idx < periods.length - 1 && 'border-r border-border/20'
                  )}
                >
                  {period.periodLabel || period.period}
                </th>
              ))}
            </tr>
          </thead>

          {/* Data rows */}
          <tbody>
            {visibleMetrics.map((row, rowIdx) => {
              // Skip child rows if parent is collapsed
              if (!isChildVisible(row)) return null

              const isParent = isCollapsibleParent(row.key) && !row.parentKey
              const isExpanded = expandedRows.has(row.key)
              const isChild = !!row.parentKey
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
                      'sticky left-0 z-10 bg-card/95 backdrop-blur-sm px-6 py-3.5 border-r border-border/30',
                      isChild && 'pl-12'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {/* Collapse/expand toggle for parent rows */}
                      {isParent && (
                        <button
                          onClick={() => toggleRow(row.key)}
                          className="p-0.5 hover:bg-muted rounded transition-colors"
                          aria-label={isExpanded ? 'Collapse' : 'Expand'}
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
                  </td>

                  {/* Value cells for each period (150px, centered) */}
                  {periods.map((period, colIdx) => {
                    const value = period.metrics[row.key]
                    const hasValue = value !== 0
                    const transactionCount = row.showTransactions ? period.metrics.transactionCount : 0

                    return (
                      <td
                        key={`${period.period}-${row.key}`}
                        className={cn(
                          'px-4 py-4 w-[150px] min-w-[150px] text-center',
                          colIdx < periods.length - 1 && 'border-r border-border/20',
                          isBold && 'bg-muted/30'
                        )}
                      >
                        <span
                          className={cn(
                            'text-sm tabular-nums',
                            isBold && 'font-semibold',
                            isNegative && hasValue && 'text-red-500',
                            !hasValue && 'text-muted-foreground'
                          )}
                        >
                          {isNegative && hasValue ? `-${Currency(Math.abs(value))}` : Currency(value)}
                        </span>

                        {/* Transaction count */}
                        {row.showTransactions && transactionCount > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {transactionCount} {t('salesSummary.transactionsLabel')}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default PeriodBreakdownTable
