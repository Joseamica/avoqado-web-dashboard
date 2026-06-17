import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DateTime } from 'luxon'
import { Banknote, Calculator, DollarSign, HandCoins, Landmark, Percent, Receipt, RotateCcw } from 'lucide-react'

import { MetricCard } from '@/components/ui/metric-card'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AccountingErrorState } from '@/components/accounting/AccountingErrorState'
import { DateRangePicker } from '@/components/date-range-picker'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useIncomeStatement } from '@/hooks/useIncomeStatement'
import { Currency } from '@/utils/currency'
import { getLast7Days } from '@/utils/datetime'

/** JS Date (from the picker) → YYYY-MM-DD in the venue timezone, matching the backend's day boundaries. */
const toYmd = (d: Date, tz: string): string => DateTime.fromJSDate(d).setZone(tz).toFormat('yyyy-MM-dd')

/**
 * Capa A — Estado de resultados ("¿Cuánto gané?").
 * Read-model de INGRESOS del venue (no fiscal, no utilidad). Incluido para todos
 * los venues: la ruta + el sidebar se gatean por el permiso `accounting:read`.
 */
export default function IncomeStatement() {
  const { t } = useTranslation('reports')
  const { venue } = useCurrentVenue()
  const tz = venue?.timezone ?? 'America/Mexico_City'

  const [range, setRange] = useState<{ from: Date; to: Date }>(() => getLast7Days(tz))
  const from = toYmd(range.from, tz)
  const to = toYmd(range.to, tz)

  const { data, isLoading, isError, refetch } = useIncomeStatement({ from, to })

  const rev = data?.revenue
  const ivaPct = Math.round((data?.taxRateAssumed ?? 0.16) * 100)

  return (
    <div className="p-4 space-y-5 bg-background">
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t('incomeStatement.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {data?.venueName
              ? t('subtitleSuffix', { base: t('incomeStatement.subtitle'), suffix: data.venueName })
              : t('incomeStatement.subtitle')}
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
      ) : isError ? (
        <AccountingErrorState onRetry={() => refetch()} />
      ) : data?.metrics?.salesCount === 0 ? (
        <Card className="border-input">
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Receipt className="h-8 w-8 text-muted-foreground" />
            <h2 className="text-base font-medium text-foreground">{t('incomeStatement.zeroTitle')}</h2>
            <p className="max-w-md text-sm text-muted-foreground">{t('incomeStatement.zeroBody')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label={t('incomeStatement.grossSales')}
            value={Currency(rev?.grossSalesCents ?? 0, true)}
            icon={<DollarSign className="w-4 h-4" />}
            accent="green"
            tooltip={t('incomeStatement.grossSalesTip')}
          />
          <MetricCard
            label={t('incomeStatement.refunds')}
            value={Currency(rev?.refundsCents ?? 0, true)}
            subValue={t('incomeStatement.refundsCount', { n: data?.metrics.refundCount ?? 0 })}
            icon={<RotateCcw className="w-4 h-4" />}
            accent="red"
          />
          <MetricCard
            label={t('incomeStatement.netRevenue')}
            value={Currency(rev?.netRevenueCents ?? 0, true)}
            icon={<Banknote className="w-4 h-4" />}
            accent="green"
            tooltip={t('incomeStatement.netRevenueTip')}
          />
          <MetricCard
            label={t('incomeStatement.taxableBase')}
            value={Currency(rev?.taxableBaseCents ?? 0, true)}
            icon={<Landmark className="w-4 h-4" />}
            accent="blue"
            tooltip={t('incomeStatement.taxableBaseTip', { pct: ivaPct })}
          />
          <MetricCard
            label={t('incomeStatement.iva', { pct: ivaPct })}
            value={Currency(rev?.ivaCents ?? 0, true)}
            icon={<Percent className="w-4 h-4" />}
            accent="purple"
          />
          <MetricCard
            label={t('incomeStatement.tips')}
            value={Currency(data?.tips.totalCents ?? 0, true)}
            subValue={t('incomeStatement.tipsSub')}
            icon={<HandCoins className="w-4 h-4" />}
            accent="yellow"
            tooltip={t('incomeStatement.tipsTip')}
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

      {/* Disclosure — what this tablero is and isn't */}
      <Card className="border-input">
        <CardContent className="py-3 space-y-1 text-xs text-muted-foreground">
          <p>{t('incomeStatement.disclosureRevenue')}</p>
          <p>{t('incomeStatement.disclosureIva', { pct: ivaPct })}</p>
          <p>{t('incomeStatement.disclosureTips')}</p>
        </CardContent>
      </Card>
    </div>
  )
}
