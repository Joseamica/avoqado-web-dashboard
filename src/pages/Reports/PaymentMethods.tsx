import { useState, useMemo, Fragment } from 'react'
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
import { getLast7Days } from '@/utils/datetime'
import { useAuth } from '@/context/AuthContext'
import {
  fetchPaymentMethods,
  paymentMethodsKeys,
  type PaymentBucket,
  type CardSubType,
} from '@/services/reports/paymentMethods.service'
import { Banknote, CreditCard, Wallet, QrCode, Download, ChevronDown, ChevronRight } from 'lucide-react'

// ============================================
// Bucket presentation map
// ============================================
const BUCKET_ICON: Record<PaymentBucket, React.ComponentType<{ className?: string }>> = {
  CARD: CreditCard,
  CASH: Banknote,
  OTHER: Wallet,
  QR_LEGACY: QrCode,
}

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
const PaymentMethodsSkeleton = () => (
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
export default function PaymentMethods() {
  const { t, i18n } = useTranslation('reports')
  const { venueId } = useCurrentVenue()
  const { activeVenue } = useAuth()
  const venueTimezone = activeVenue?.timezone || 'America/Mexico_City'

  // Date range state
  const defaultDateRange = useMemo(() => getLast7Days(venueTimezone), [venueTimezone])
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: defaultDateRange.from,
    to: defaultDateRange.to,
  })

  // Which buckets are expanded to show their card sub-types
  const [expanded, setExpanded] = useState<Set<PaymentBucket>>(new Set())

  const toggleExpanded = (bucket: PaymentBucket) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(bucket)) next.delete(bucket)
      else next.add(bucket)
      return next
    })
  }

  const apiFilters = useMemo(
    () => ({
      venueId,
      startDate: dateRange.from.toISOString(),
      endDate: dateRange.to.toISOString(),
    }),
    [venueId, dateRange.from, dateRange.to],
  )

  const { data: apiResponse, isLoading, isError, error } = useQuery({
    queryKey: paymentMethodsKeys.report(apiFilters),
    queryFn: () => fetchPaymentMethods(apiFilters),
    staleTime: 1000 * 60 * 5,
  })

  const handleDateRangeUpdate = (values: { range: { from: Date; to: Date | undefined } }) => {
    if (values.range.from && values.range.to) {
      setDateRange({ from: values.range.from, to: values.range.to })
    }
  }

  const getMethodLabel = (bucket: PaymentBucket) => t(`paymentMethods.methods.${bucket}`, bucket)
  const getSubTypeLabel = (type: CardSubType) => t(`paymentMethods.subTypes.${type}`, type)

  // Export CSV
  const handleExportCSV = () => {
    if (!apiResponse) return

    const rows: string[][] = []
    rows.push([
      t('paymentMethods.columns.method'),
      t('paymentMethods.columns.transactions'),
      t('paymentMethods.columns.collected'),
      t('paymentMethods.columns.tips'),
      t('paymentMethods.columns.refunds'),
      t('paymentMethods.columns.fees'),
      t('paymentMethods.columns.share'),
    ])

    apiResponse.methods.forEach(m => {
      rows.push([
        getMethodLabel(m.bucket),
        m.count.toString(),
        m.amount.toFixed(2),
        m.tips.toFixed(2),
        m.refunds.toFixed(2),
        m.platformFees.toFixed(2),
        `${m.percentage.toFixed(1)}%`,
      ])
      m.subRows.forEach(s => {
        rows.push([
          `  ${getSubTypeLabel(s.type)}`,
          s.count.toString(),
          s.amount.toFixed(2),
          '',
          '',
          s.platformFees.toFixed(2),
          `${s.percentage.toFixed(1)}%`,
        ])
      })
    })

    rows.push([
      t('paymentMethods.totals.label'),
      apiResponse.totals.transactions.toString(),
      apiResponse.totals.collected.toFixed(2),
      apiResponse.totals.tips.toFixed(2),
      apiResponse.totals.refunds.toFixed(2),
      apiResponse.totals.platformFees.toFixed(2),
      '100%',
    ])

    const csvContent = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `payment-methods-${dateRange.from.toISOString().split('T')[0]}-${dateRange.to.toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  if (isLoading) {
    return <PaymentMethodsSkeleton />
  }

  if (isError) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <PageTitleWithInfo
            title={t('paymentMethods.title')}
            className="text-2xl font-bold"
            tooltip={t('info.paymentMethods', {
              defaultValue: 'Desglose de cuánto cobraste por cada método de pago, incluyendo propinas, reembolsos y comisiones.',
            })}
          />
        </div>
        <GlassCard className="p-6">
          <p className="text-destructive">{error instanceof Error ? error.message : 'Error loading payment methods data'}</p>
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
            title={t('paymentMethods.title')}
            className="text-2xl font-bold"
            tooltip={t('info.paymentMethods', {
              defaultValue: 'Desglose de cuánto cobraste por cada método de pago, incluyendo propinas, reembolsos y comisiones.',
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
            <div className="p-3 rounded-xl bg-indigo-500/10">
              <CreditCard className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-1">{t('paymentMethods.title')}</p>
              <div className="flex flex-wrap gap-6">
                <div>
                  <p className="text-2xl font-bold tracking-tight">{Currency(apiResponse.totals.collected)}</p>
                  <p className="text-xs text-muted-foreground">{t('paymentMethods.columns.collected')}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold tracking-tight">{apiResponse.totals.transactions}</p>
                  <p className="text-xs text-muted-foreground">{t('paymentMethods.columns.transactions')}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold tracking-tight">{Currency(apiResponse.totals.tips)}</p>
                  <p className="text-xs text-muted-foreground">{t('paymentMethods.columns.tips')}</p>
                </div>
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Methods Table */}
      {apiResponse && apiResponse.methods.length > 0 && (
        <GlassCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="px-4 py-3 text-left">
                    <span className="text-xs font-medium text-muted-foreground">{t('paymentMethods.columns.method')}</span>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <span className="text-xs font-medium text-muted-foreground">{t('paymentMethods.columns.transactions')}</span>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <span className="text-xs font-medium text-muted-foreground">{t('paymentMethods.columns.collected')}</span>
                  </th>
                  <th className="px-4 py-3 text-right hidden sm:table-cell">
                    <span className="text-xs font-medium text-muted-foreground">{t('paymentMethods.columns.tips')}</span>
                  </th>
                  <th className="px-4 py-3 text-right hidden md:table-cell">
                    <span className="text-xs font-medium text-muted-foreground">{t('paymentMethods.columns.refunds')}</span>
                  </th>
                  <th className="px-4 py-3 text-right hidden md:table-cell">
                    <span className="text-xs font-medium text-muted-foreground">{t('paymentMethods.columns.fees')}</span>
                  </th>
                  <th className="px-4 py-3 text-right hidden lg:table-cell w-[160px]">
                    <span className="text-xs font-medium text-muted-foreground">{t('paymentMethods.columns.share')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {apiResponse.methods.map(method => {
                  const Icon = BUCKET_ICON[method.bucket] ?? Wallet
                  const hasSubRows = method.subRows.length > 0
                  const isExpanded = expanded.has(method.bucket)
                  return (
                    <Fragment key={method.bucket}>
                      <tr
                        className={cn(
                          'border-b border-border/30 transition-colors',
                          hasSubRows ? 'hover:bg-muted/20 cursor-pointer' : 'hover:bg-muted/20',
                        )}
                        onClick={hasSubRows ? () => toggleExpanded(method.bucket) : undefined}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            {hasSubRows ? (
                              isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                              )
                            ) : (
                              <span className="w-4 shrink-0" />
                            )}
                            <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="text-sm font-medium">{getMethodLabel(method.bucket)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm font-mono">{method.count}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm font-mono font-semibold">{Currency(method.amount)}</span>
                        </td>
                        <td className="px-4 py-3 text-right hidden sm:table-cell">
                          <span className="text-sm font-mono text-muted-foreground">{method.tips > 0 ? Currency(method.tips) : '—'}</span>
                        </td>
                        <td className="px-4 py-3 text-right hidden md:table-cell">
                          <span className="text-sm font-mono text-muted-foreground">
                            {method.refunds > 0 ? `-${Currency(method.refunds)}` : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right hidden md:table-cell">
                          <span className="text-sm font-mono text-muted-foreground">
                            {method.platformFees > 0 ? `-${Currency(method.platformFees)}` : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <div className="flex items-center gap-2 justify-end">
                            <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full bg-indigo-500/70" style={{ width: `${Math.min(method.percentage, 100)}%` }} />
                            </div>
                            <span className="text-xs font-mono text-muted-foreground tabular-nums w-10 text-right">
                              {method.percentage.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                      {isExpanded &&
                        method.subRows.map(sub => (
                          <tr key={`${method.bucket}-${sub.type}`} className="border-b border-border/20 bg-muted/10">
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2.5 pl-10">
                                <span className="text-sm text-muted-foreground">{getSubTypeLabel(sub.type)}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <span className="text-sm font-mono text-muted-foreground">{sub.count}</span>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <span className="text-sm font-mono text-muted-foreground">{Currency(sub.amount)}</span>
                            </td>
                            <td className="px-4 py-2.5 text-right hidden sm:table-cell">
                              <span className="text-sm text-muted-foreground">—</span>
                            </td>
                            <td className="px-4 py-2.5 text-right hidden md:table-cell">
                              <span className="text-sm text-muted-foreground">—</span>
                            </td>
                            <td className="px-4 py-2.5 text-right hidden md:table-cell">
                              <span className="text-sm font-mono text-muted-foreground">
                                {sub.platformFees > 0 ? `-${Currency(sub.platformFees)}` : '—'}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 hidden lg:table-cell">
                              <div className="flex items-center justify-end">
                                <span className="text-xs font-mono text-muted-foreground tabular-nums">{sub.percentage.toFixed(1)}%</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </Fragment>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-muted/40 font-semibold">
                  <td className="px-4 py-3">
                    <span className="text-sm pl-6">{t('paymentMethods.totals.label')}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-mono">{apiResponse.totals.transactions}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-mono">{Currency(apiResponse.totals.collected)}</span>
                  </td>
                  <td className="px-4 py-3 text-right hidden sm:table-cell">
                    <span className="text-sm font-mono">{apiResponse.totals.tips > 0 ? Currency(apiResponse.totals.tips) : '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-right hidden md:table-cell">
                    <span className="text-sm font-mono">
                      {apiResponse.totals.refunds > 0 ? `-${Currency(apiResponse.totals.refunds)}` : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right hidden md:table-cell">
                    <span className="text-sm font-mono">
                      {apiResponse.totals.platformFees > 0 ? `-${Currency(apiResponse.totals.platformFees)}` : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell" />
                </tr>
              </tfoot>
            </table>
          </div>
        </GlassCard>
      )}

      {/* Empty State */}
      {apiResponse && apiResponse.methods.length === 0 && (
        <GlassCard className="p-12 text-center">
          <CreditCard className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">{t('paymentMethods.noData')}</p>
        </GlassCard>
      )}
    </div>
  )
}
