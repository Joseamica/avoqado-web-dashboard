import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { DateTime } from 'luxon'
import { ArrowRight, Banknote, Calculator, FileCheck2, HandCoins, Landmark, Percent, Receipt, Scissors, Wallet } from 'lucide-react'

import { MetricCard } from '@/components/ui/metric-card'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DateRangePicker } from '@/components/date-range-picker'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useBusinessSummary } from '@/hooks/useAccounting'
import { Currency } from '@/utils/currency'
import { getLast7Days } from '@/utils/datetime'
import { cn } from '@/lib/utils'

/** JS Date (picker) → YYYY-MM-DD en la zona del local, igual que las fronteras del backend. */
const toYmd = (d: Date, tz: string): string => DateTime.fromJSDate(d).setZone(tz).toFormat('yyyy-MM-dd')

/** Barra de proporción simple (dos segmentos) con tokens semánticos. */
function SplitBar({ pct, leftClass, rightClass }: { pct: number; leftClass: string; rightClass: string }) {
  const clamped = Math.max(0, Math.min(100, pct))
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className={cn('h-full', leftClass)} style={{ width: `${clamped}%` }} />
      <div className={cn('h-full', rightClass)} style={{ width: `${100 - clamped}%` }} />
    </div>
  )
}

/**
 * Resumen del negocio — portada de Contabilidad (Capa A, read-model).
 * Reúne en una vista: ingreso del periodo, facturación (CFDIs timbrados), cómo se
 * cobró (efectivo vs banco), comisiones y el estado de la conciliación bancaria.
 * Incluido para todos los venues (ruta + sidebar gateados por `accounting:read`).
 */
export default function BusinessSummary() {
  const { t } = useTranslation('reports')
  const { venue, fullBasePath } = useCurrentVenue()
  const tz = venue?.timezone ?? 'America/Mexico_City'

  const [range, setRange] = useState<{ from: Date; to: Date }>(() => getLast7Days(tz))
  const from = toYmd(range.from, tz)
  const to = toYmd(range.to, tz)

  const { data, isLoading, isError } = useBusinessSummary({ from, to })
  const ivaPct = Math.round((data?.taxRateAssumed ?? 0.16) * 100)

  const inv = data?.invoicing
  const col = data?.collection
  const rec = data?.reconciliation

  return (
    <div className="p-4 space-y-5 bg-background">
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t('businessSummary.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('businessSummary.subtitle')}
            {data?.venueName ? ` · ${data.venueName}` : ''}
          </p>
        </div>
        <DateRangePicker
          initialDateFrom={range.from}
          initialDateTo={range.to}
          align="end"
          showCompare={false}
          onUpdate={({ range: r }) => r.to && setRange({ from: r.from, to: r.to })}
        />
      </header>

      {/* KPI grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label={t('businessSummary.netRevenue')}
            value={Currency(data?.revenue.netRevenueCents ?? 0, true)}
            icon={<Banknote className="w-4 h-4" />}
            accent="green"
            tooltip={t('businessSummary.netRevenueTip')}
          />
          <MetricCard
            label={t('incomeStatement.iva', { pct: ivaPct })}
            value={Currency(data?.revenue.ivaCents ?? 0, true)}
            icon={<Percent className="w-4 h-4" />}
            accent="purple"
          />
          <MetricCard
            label={t('businessSummary.invoicedPct')}
            value={`${inv?.invoicedPct ?? 0}%`}
            subValue={t('businessSummary.invoicedOf', { count: inv?.stampedCount ?? 0 })}
            icon={<FileCheck2 className="w-4 h-4" />}
            accent="blue"
            tooltip={t('businessSummary.invoicedPctTip')}
          />
          <MetricCard
            label={t('businessSummary.fees')}
            value={Currency(data?.costs.processingFeesCents ?? 0, true)}
            icon={<Scissors className="w-4 h-4" />}
            accent="red"
            tooltip={t('businessSummary.feesTip')}
          />
          <MetricCard
            label={t('businessSummary.netAfterFees')}
            value={Currency(data?.result.netAfterFeesCents ?? 0, true)}
            icon={<Calculator className="w-4 h-4" />}
            accent="green"
            tooltip={t('businessSummary.netAfterFeesTip')}
          />
          <MetricCard
            label={t('incomeStatement.tips')}
            value={Currency(data?.tips.totalCents ?? 0, true)}
            subValue={t('incomeStatement.tipsSub')}
            icon={<HandCoins className="w-4 h-4" />}
            accent="yellow"
          />
          <MetricCard
            label={t('incomeStatement.salesCount')}
            value={data?.metrics.salesCount ?? 0}
            icon={<Receipt className="w-4 h-4" />}
            accent="blue"
          />
          <MetricCard
            label={t('incomeStatement.averageTicket')}
            value={Currency(data?.metrics.averageTicketCents ?? 0, true)}
            icon={<Calculator className="w-4 h-4" />}
            accent="orange"
          />
        </div>
      )}

      {isError && <p className="text-sm text-destructive">{t('businessSummary.error')}</p>}

      {/* Panels: facturación + cobro */}
      {!isLoading && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {/* Facturación */}
          <Card className="border-input">
            <CardContent className="py-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-foreground">{t('businessSummary.invoicingTitle')}</h2>
                <Link
                  to={`${fullBasePath}/cfdi`}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  {t('businessSummary.goToInvoicing')} <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <SplitBar pct={inv?.invoicedPct ?? 0} leftClass="bg-emerald-500" rightClass="bg-muted-foreground/30" />
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">{t('businessSummary.invoiced')}</p>
                  <p className="font-medium text-foreground tabular-nums">{Currency(inv?.invoicedApproxCents ?? 0, true)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('businessSummary.uninvoiced')}</p>
                  <p className="font-medium text-foreground tabular-nums">{Currency(inv?.uninvoicedApproxCents ?? 0, true)}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('businessSummary.cfdiBreakdown', { nominative: inv?.nominativeCount ?? 0, global: inv?.globalCount ?? 0 })}
              </p>
            </CardContent>
          </Card>

          {/* Cobro: efectivo vs banco */}
          <Card className="border-input">
            <CardContent className="py-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-foreground">{t('businessSummary.collectionTitle')}</h2>
                <Link
                  to={`${fullBasePath}/contabilidad/bancos`}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  {t('businessSummary.goToBanks')} <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <SplitBar pct={col?.cashPct ?? 0} leftClass="bg-amber-500" rightClass="bg-blue-500" />
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-amber-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t('businessSummary.cash')}</p>
                    <p className="font-medium text-foreground tabular-nums">{Currency(col?.cashCents ?? 0, true)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-blue-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t('businessSummary.electronic')}</p>
                    <p className="font-medium text-foreground tabular-nums">{Currency(col?.electronicCents ?? 0, true)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Conciliación strip */}
      {!isLoading && (
        <Link to={`${fullBasePath}/contabilidad/conciliacion`} className="block">
          <Card className="border-input transition-colors hover:bg-muted/40">
            <CardContent className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <Landmark className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">{t('businessSummary.reconciliationTitle')}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('businessSummary.reconciliationSub', {
                      statements: rec?.statements ?? 0,
                      matched: rec?.matchedCount ?? 0,
                      total: rec?.lineCount ?? 0,
                    })}
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Disclosure */}
      <Card className="border-input">
        <CardContent className="py-3 space-y-1 text-xs text-muted-foreground">
          <p>{t('businessSummary.disclosureRevenue')}</p>
          <p>{t('businessSummary.disclosureInvoiced')}</p>
          <p>{t('businessSummary.disclosureResult')}</p>
        </CardContent>
      </Card>
    </div>
  )
}
