/**
 * Reporte de Promociones — el COMBO como renglón, con su nombre.
 *
 * Mitad "Fudo/Toast" de una decisión deliberada del founder (2026-08-18): aquí la
 * promoción es el renglón (veces vendida, bruto, descuento otorgado, neto), y
 * "Ventas por artículo" desglosa los COMPONENTES marcándolos "dentro de «Combo X»"
 * (modelo Square). Las dos vistas existen a propósito, sin switch — y por eso NO
 * se suman entre sí: este reporte y el de artículos cuentan el mismo dinero desde
 * dos ángulos distintos.
 *
 * El nombre que se ve es el que se COBRÓ (snapshot del server): renombrar una
 * promoción no reescribe un período ya cerrado.
 */

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DateRangePicker } from '@/components/date-range-picker'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { FeatureGate } from '@/components/billing/FeatureGate'
import { cn } from '@/lib/utils'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useAuth } from '@/context/AuthContext'
import { Currency } from '@/utils/currency'
import { getLast7Days } from '@/utils/datetime'
import {
  fetchPromotionSales,
  promotionSalesKeys,
  type PromotionReportType,
  type PromotionSalesRow,
} from '@/services/reports/promotions.service'
import { AlertTriangle, Download, Tags } from 'lucide-react'

// ============================================
// GlassCard (mismo patrón que Reembolsos / Ventas por artículo)
// ============================================
const GlassCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cn('relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm', 'shadow-sm transition-all duration-300', className)}>
    {children}
  </div>
)

const PromotionSalesSkeleton = () => (
  <div className="p-4 md:p-6 space-y-6">
    <div className="flex items-center justify-between">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-10 w-32" />
    </div>
    <Skeleton className="h-10 w-64 rounded-lg" />
    <Skeleton className="h-40 w-full rounded-2xl" />
    <Skeleton className="h-96 w-full rounded-2xl" />
  </div>
)

const PERIOD_OPTIONS: PromotionReportType[] = ['summary', 'days', 'weeks', 'months']

// ============================================
// Main Component
// ============================================
export default function PromotionSales() {
  const { t, i18n } = useTranslation('reports')
  const { venueId } = useCurrentVenue()
  const { activeVenue } = useAuth()
  const venueTimezone = activeVenue?.timezone || 'America/Mexico_City'

  const defaultDateRange = useMemo(() => getLast7Days(venueTimezone), [venueTimezone])
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: defaultDateRange.from,
    to: defaultDateRange.to,
  })
  const [reportType, setReportType] = useState<PromotionReportType>('summary')

  const apiFilters = useMemo(
    () => ({
      venueId,
      startDate: dateRange.from.toISOString(),
      endDate: dateRange.to.toISOString(),
      reportType,
    }),
    [venueId, dateRange.from, dateRange.to, reportType],
  )

  const {
    data: apiResponse,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: promotionSalesKeys.report(apiFilters),
    queryFn: () => fetchPromotionSales(apiFilters),
    staleTime: 1000 * 60 * 5,
  })

  const handleDateRangeUpdate = (values: { range: { from: Date; to: Date | undefined } }) => {
    if (values.range.from && values.range.to) {
      setDateRange({ from: values.range.from, to: values.range.to })
    }
  }

  /** BUNDLE / COMBO / 2x1 — etiqueta corta, en el idioma del usuario. */
  const kindLabel = (row: PromotionSalesRow) => {
    if (row.pricingMode === 'PER_UNIT') return t('promotionSales.kinds.PER_UNIT', { defaultValue: '2x1' })
    return t(`promotionSales.kinds.${row.type ?? 'UNKNOWN'}`, { defaultValue: row.type ?? '—' })
  }

  // Barra proporcional del desglose por período: sin librería de gráficas, sólo
  // anchos relativos al período más alto.
  const maxPeriodNet = useMemo(() => Math.max(0, ...(apiResponse?.byPeriod ?? []).map(p => p.netSales)), [apiResponse?.byPeriod])

  const handleExportCSV = () => {
    if (!apiResponse) return

    const rows: string[][] = [
      [
        t('promotionSales.columns.promotion'),
        t('promotionSales.columns.kind'),
        t('promotionSales.columns.timesSold'),
        t('promotionSales.columns.grossSales'),
        t('promotionSales.columns.discounts'),
        t('promotionSales.columns.netSales'),
      ],
    ]

    apiResponse.promotions.forEach(p => {
      rows.push([p.name, kindLabel(p), String(p.timesSold), p.grossSales.toFixed(2), p.discounts.toFixed(2), p.netSales.toFixed(2)])
    })

    rows.push([
      t('promotionSales.totals.label'),
      '',
      String(apiResponse.totals.timesSold),
      apiResponse.totals.grossSales.toFixed(2),
      apiResponse.totals.discounts.toFixed(2),
      apiResponse.totals.netSales.toFixed(2),
    ])

    const csvContent = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `promociones-${dateRange.from.toISOString().split('T')[0]}-${dateRange.to.toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  if (isLoading) {
    return <PromotionSalesSkeleton />
  }

  const header = (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <PageTitleWithInfo
          title={t('promotionSales.title')}
          className="text-2xl font-bold"
          tooltip={t('info.promotionSales', {
            defaultValue:
              'Cada promoción como un renglón: cuántas veces se vendió, cuánto valía a precio de lista, cuánto regalaste y cuánto entró. Los componentes sueltos se ven en Ventas por artículo.',
          })}
        />
        <Badge variant="outline" className="text-xs font-normal">
          Beta
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 cursor-pointer"
          onClick={handleExportCSV}
          disabled={!apiResponse}
          title={t('promotionSales.exportCsv', { defaultValue: 'Exportar CSV' })}
          data-tour="promotion-sales-export"
        >
          <Download className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )

  if (isError) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        {header}
        <GlassCard className="p-6">
          <p className="text-destructive">{error instanceof Error ? error.message : t('promotionSales.loadError', { defaultValue: 'No se pudo cargar el reporte' })}</p>
        </GlassCard>
      </div>
    )
  }

  return (
    <FeatureGate feature="PROMOTIONS">
      <div className="p-4 md:p-6 space-y-6">
        {header}

        {/* Rango + período */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <DateRangePicker
            initialDateFrom={dateRange.from}
            initialDateTo={dateRange.to}
            onUpdate={handleDateRangeUpdate}
            align="start"
            locale={i18n.language}
            showCompare={false}
          />
          <Tabs value={reportType} onValueChange={v => setReportType(v as PromotionReportType)}>
            <TabsList className="rounded-full bg-muted/60 px-1 py-1 border border-border">
              {PERIOD_OPTIONS.map(option => (
                <TabsTrigger
                  key={option}
                  value={option}
                  className="rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background cursor-pointer"
                >
                  {t(`promotionSales.periods.${option}`)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Resumen */}
        {apiResponse && (
          <GlassCard className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-emerald-500/10">
                <Tags className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-1">{t('promotionSales.title')}</p>
                <div className="flex flex-wrap gap-6">
                  <div>
                    <p className="text-2xl font-bold tracking-tight">{apiResponse.totals.timesSold}</p>
                    <p className="text-xs text-muted-foreground">{t('promotionSales.columns.timesSold')}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold tracking-tight">{Currency(apiResponse.totals.netSales)}</p>
                    <p className="text-xs text-muted-foreground">{t('promotionSales.columns.netSales')}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
                      {Currency(apiResponse.totals.discounts)}
                    </p>
                    <p className="text-xs text-muted-foreground">{t('promotionSales.summary.given')}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold tracking-tight">{apiResponse.totals.promotionsCount}</p>
                    <p className="text-xs text-muted-foreground">{t('promotionSales.summary.distinct')}</p>
                  </div>
                </div>

                {/* Se muestra, no se esconde: la venta entró a precio de lista. */}
                {apiResponse.totals.needsReview > 0 && (
                  <div className="mt-4 flex items-start gap-2 rounded-lg border border-input bg-muted/40 px-3 py-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <p className="text-xs text-muted-foreground">
                      {t('promotionSales.needsReview', { count: apiResponse.totals.needsReview })}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </GlassCard>
        )}

        {/* Desglose por período */}
        {apiResponse && reportType !== 'summary' && (apiResponse.byPeriod?.length ?? 0) > 0 && (
          <GlassCard className="p-6">
            <p className="text-sm font-medium mb-4">{t('promotionSales.byPeriod')}</p>
            <div className="space-y-2">
              {apiResponse.byPeriod!.map(period => (
                <div key={period.period} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-xs text-muted-foreground truncate">{period.periodLabel || period.period}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-emerald-500/70"
                      style={{ width: maxPeriodNet > 0 ? `${Math.round((period.netSales / maxPeriodNet) * 100)}%` : '0%' }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">{period.timesSold}</span>
                  <span className="w-28 shrink-0 text-right text-sm font-mono">{Currency(period.netSales)}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        )}

        {/* Tabla */}
        {apiResponse && apiResponse.promotions.length > 0 && (
          <GlassCard className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    <th className="px-4 py-3 text-left">
                      <span className="text-xs font-medium text-muted-foreground">{t('promotionSales.columns.promotion')}</span>
                    </th>
                    <th className="px-4 py-3 text-left hidden sm:table-cell">
                      <span className="text-xs font-medium text-muted-foreground">{t('promotionSales.columns.kind')}</span>
                    </th>
                    <th className="px-4 py-3 text-right">
                      <span className="text-xs font-medium text-muted-foreground">{t('promotionSales.columns.timesSold')}</span>
                    </th>
                    <th className="px-4 py-3 text-right hidden md:table-cell">
                      <span className="text-xs font-medium text-muted-foreground">{t('promotionSales.columns.grossSales')}</span>
                    </th>
                    <th className="px-4 py-3 text-right">
                      <span className="text-xs font-medium text-muted-foreground">{t('promotionSales.columns.discounts')}</span>
                    </th>
                    <th className="px-4 py-3 text-right">
                      <span className="text-xs font-medium text-muted-foreground">{t('promotionSales.columns.netSales')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {apiResponse.promotions.map((p, index) => (
                    <tr key={`${p.promotionId}-${p.name}-${index}`} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{p.name}</span>
                          {p.needsReview > 0 && (
                            <span className="text-xs text-amber-600 dark:text-amber-400">
                              {t('promotionSales.rowNeedsReview', { count: p.needsReview })}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="text-sm text-muted-foreground">{kindLabel(p)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-mono">{p.timesSold}</span>
                      </td>
                      <td className="px-4 py-3 text-right hidden md:table-cell">
                        <span className="text-sm font-mono text-muted-foreground">{Currency(p.grossSales)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-mono text-amber-600 dark:text-amber-400">
                          {p.discounts > 0 ? `-${Currency(p.discounts)}` : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-mono font-semibold">{Currency(p.netSales)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/40 font-semibold">
                    <td className="px-4 py-3">
                      <span className="text-sm">{t('promotionSales.totals.label')}</span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell" />
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-mono">{apiResponse.totals.timesSold}</span>
                    </td>
                    <td className="px-4 py-3 text-right hidden md:table-cell">
                      <span className="text-sm font-mono">{Currency(apiResponse.totals.grossSales)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-mono">
                        {apiResponse.totals.discounts > 0 ? `-${Currency(apiResponse.totals.discounts)}` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-mono">{Currency(apiResponse.totals.netSales)}</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {/* Por qué no cuadra con "Ventas por artículo": son dos vistas del mismo dinero. */}
            <p className="border-t border-border/30 px-4 py-3 text-xs text-muted-foreground">{t('promotionSales.footnote')}</p>
          </GlassCard>
        )}

        {/* Vacío */}
        {apiResponse && apiResponse.promotions.length === 0 && (
          <GlassCard className="p-12 text-center">
            <Tags className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">{t('promotionSales.noData')}</p>
          </GlassCard>
        )}
      </div>
    </FeatureGate>
  )
}
