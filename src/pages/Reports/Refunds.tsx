import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { Skeleton } from '@/components/ui/skeleton'
import { DateRangePicker } from '@/components/date-range-picker'
import { cn } from '@/lib/utils'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { Currency } from '@/utils/currency'
import { getLast7Days, useVenueDateTime } from '@/utils/datetime'
import { useAuth } from '@/context/AuthContext'
import { fetchRefunds, refundsKeys, type RefundReason } from '@/services/reports/refunds.service'
import { RotateCcw, Download } from 'lucide-react'

// ============================================
// GlassCard Component
// ============================================
const GlassCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div
    className={cn(
      'relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm',
      'shadow-sm transition-all duration-300',
      className,
    )}
  >
    {children}
  </div>
)

// ============================================
// Loading Skeleton
// ============================================
const RefundsSkeleton = () => (
  <div className="p-4 md:p-6 space-y-6">
    <div className="flex items-center justify-between">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-32" />
    </div>
    <Skeleton className="h-10 w-64 rounded-lg" />
    <Skeleton className="h-48 w-full rounded-2xl" />
    <Skeleton className="h-96 w-full rounded-2xl" />
  </div>
)

// ============================================
// Main Component
// ============================================
export default function Refunds() {
  const { t, i18n } = useTranslation('reports')
  const { venueId } = useCurrentVenue()
  const { activeVenue } = useAuth()
  const { formatDateTime } = useVenueDateTime()
  const venueTimezone = activeVenue?.timezone || 'America/Mexico_City'

  // Date range state
  const defaultDateRange = useMemo(() => getLast7Days(venueTimezone), [venueTimezone])
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: defaultDateRange.from,
    to: defaultDateRange.to,
  })

  const apiFilters = useMemo(
    () => ({
      venueId,
      startDate: dateRange.from.toISOString(),
      endDate: dateRange.to.toISOString(),
    }),
    [venueId, dateRange.from, dateRange.to],
  )

  const { data: apiResponse, isLoading, isError, error } = useQuery({
    queryKey: refundsKeys.report(apiFilters),
    queryFn: () => fetchRefunds(apiFilters),
    staleTime: 1000 * 60 * 5,
  })

  const handleDateRangeUpdate = (values: { range: { from: Date; to: Date | undefined } }) => {
    if (values.range.from && values.range.to) {
      setDateRange({ from: values.range.from, to: values.range.to })
    }
  }

  const getReasonLabel = (reason: RefundReason | 'UNKNOWN' | null) => t(`refunds.reasons.${reason ?? 'UNKNOWN'}`, { defaultValue: reason ?? '—' })
  const getMethodLabel = (method: string) => t(`refunds.methods.${method}`, { defaultValue: method })

  // Export CSV
  const handleExportCSV = () => {
    if (!apiResponse) return

    const rows: string[][] = []
    rows.push([
      t('refunds.columns.date'),
      t('refunds.columns.order'),
      t('refunds.columns.method'),
      t('refunds.columns.reason'),
      t('refunds.columns.note'),
      t('refunds.columns.sale'),
      t('refunds.columns.tip'),
      t('refunds.columns.total'),
      t('refunds.columns.processedBy'),
    ])

    apiResponse.refunds.forEach(r => {
      rows.push([
        formatDateTime(r.createdAt),
        r.orderNumber || '',
        getMethodLabel(r.method),
        getReasonLabel(r.reason),
        r.note || '',
        r.saleAmount.toFixed(2),
        r.tipAmount.toFixed(2),
        r.totalAmount.toFixed(2),
        r.processedByName || '',
      ])
    })

    rows.push([
      t('refunds.totals.label'),
      '',
      '',
      '',
      '',
      apiResponse.totals.totalSale.toFixed(2),
      apiResponse.totals.totalTips.toFixed(2),
      apiResponse.totals.totalRefunded.toFixed(2),
      '',
    ])

    const csvContent = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `refunds-${dateRange.from.toISOString().split('T')[0]}-${dateRange.to.toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  if (isLoading) {
    return <RefundsSkeleton />
  }

  if (isError) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <PageTitleWithInfo
            title={t('refunds.title')}
            className="text-2xl font-bold"
            tooltip={t('info.refunds', {
              defaultValue: 'Todos los reembolsos emitidos en el período, con monto, método, motivo y quién los procesó.',
            })}
          />
        </div>
        <GlassCard className="p-6">
          <p className="text-destructive">{error instanceof Error ? error.message : 'Error loading refunds data'}</p>
        </GlassCard>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <PageTitleWithInfo
            title={t('refunds.title')}
            className="text-2xl font-bold"
            tooltip={t('info.refunds', {
              defaultValue: 'Todos los reembolsos emitidos en el período, con monto, método, motivo y quién los procesó.',
            })}
          />
          <Badge variant="outline" className="text-xs font-normal">
            Beta
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-9 w-9 cursor-pointer" onClick={handleExportCSV} disabled={!apiResponse}>
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Date Range Picker */}
      <div className="flex items-center">
        <DateRangePicker
          initialDateFrom={dateRange.from}
          initialDateTo={dateRange.to}
          onUpdate={handleDateRangeUpdate}
          align="start"
          locale={i18n.language}
          showCompare={false}
        />
      </div>

      {/* Summary Stats */}
      {apiResponse && (
        <GlassCard className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-rose-500/10">
              <RotateCcw className="w-6 h-6 text-rose-600 dark:text-rose-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-1">{t('refunds.title')}</p>
              <div className="flex flex-wrap gap-6">
                <div>
                  <p className="text-2xl font-bold tracking-tight">{Currency(apiResponse.totals.totalRefunded)}</p>
                  <p className="text-xs text-muted-foreground">{t('refunds.summary.totalRefunded')}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold tracking-tight">{apiResponse.totals.count}</p>
                  <p className="text-xs text-muted-foreground">{t('refunds.summary.count')}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold tracking-tight">{Currency(apiResponse.totals.totalTips)}</p>
                  <p className="text-xs text-muted-foreground">{t('refunds.columns.tip')}</p>
                </div>
              </div>

              {/* Breakdown by reason */}
              {apiResponse.byReason.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {apiResponse.byReason.map(r => (
                    <Badge key={r.reason} variant="secondary" className="font-normal rounded-full px-3 py-1">
                      <span>{getReasonLabel(r.reason)}</span>
                      <span className="ml-1.5 text-muted-foreground">
                        {r.count} · {Currency(r.amount)}
                      </span>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </GlassCard>
      )}

      {/* Refunds Table */}
      {apiResponse && apiResponse.refunds.length > 0 && (
        <GlassCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="px-4 py-3 text-left">
                    <span className="text-xs font-medium text-muted-foreground">{t('refunds.columns.date')}</span>
                  </th>
                  <th className="px-4 py-3 text-left hidden sm:table-cell">
                    <span className="text-xs font-medium text-muted-foreground">{t('refunds.columns.order')}</span>
                  </th>
                  <th className="px-4 py-3 text-left hidden md:table-cell">
                    <span className="text-xs font-medium text-muted-foreground">{t('refunds.columns.method')}</span>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <span className="text-xs font-medium text-muted-foreground">{t('refunds.columns.reason')}</span>
                  </th>
                  <th className="px-4 py-3 text-right hidden lg:table-cell">
                    <span className="text-xs font-medium text-muted-foreground">{t('refunds.columns.tip')}</span>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <span className="text-xs font-medium text-muted-foreground">{t('refunds.columns.total')}</span>
                  </th>
                  <th className="px-4 py-3 text-left hidden lg:table-cell">
                    <span className="text-xs font-medium text-muted-foreground">{t('refunds.columns.processedBy')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {apiResponse.refunds.map(r => (
                  <tr key={r.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-sm">{formatDateTime(r.createdAt)}</span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-sm font-mono text-muted-foreground">{r.orderNumber || '—'}</span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-sm text-muted-foreground">{getMethodLabel(r.method)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-sm">{getReasonLabel(r.reason)}</span>
                        {r.note && <span className="text-xs text-muted-foreground line-clamp-1">{r.note}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right hidden lg:table-cell">
                      <span className="text-sm font-mono text-muted-foreground">{r.tipAmount > 0 ? `-${Currency(r.tipAmount)}` : '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-mono font-semibold text-rose-600 dark:text-rose-400">-{Currency(r.totalAmount)}</span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-sm text-muted-foreground">{r.processedByName || '—'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/40 font-semibold">
                  <td className="px-4 py-3">
                    <span className="text-sm">{t('refunds.totals.label')}</span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell" />
                  <td className="px-4 py-3 hidden md:table-cell" />
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-right hidden lg:table-cell">
                    <span className="text-sm font-mono">{apiResponse.totals.totalTips > 0 ? `-${Currency(apiResponse.totals.totalTips)}` : '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-mono">-{Currency(apiResponse.totals.totalRefunded)}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell" />
                </tr>
              </tfoot>
            </table>
          </div>
        </GlassCard>
      )}

      {/* Empty State */}
      {apiResponse && apiResponse.refunds.length === 0 && (
        <GlassCard className="p-12 text-center">
          <RotateCcw className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">{t('refunds.noData')}</p>
        </GlassCard>
      )}
    </div>
  )
}
