import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { DateTime } from 'luxon'
import {
  ArrowLeftRight,
  ArrowRight,
  Banknote,
  Bitcoin,
  CircleDollarSign,
  CreditCard,
  Landmark,
  Scissors,
  Smartphone,
  Wallet,
} from 'lucide-react'

import { MetricCard } from '@/components/ui/metric-card'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AccountingErrorState } from '@/components/accounting/AccountingErrorState'
import { DateRangePicker } from '@/components/date-range-picker'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useBankAndCash } from '@/hooks/useAccounting'
import { Currency } from '@/utils/currency'
import { getLast7Days } from '@/utils/datetime'
import { cn } from '@/lib/utils'

const toYmd = (d: Date, tz: string): string => DateTime.fromJSDate(d).setZone(tz).toFormat('yyyy-MM-dd')

/** Ícono por tipo de cuenta. Desconocido → CircleDollarSign. */
const ACCOUNT_ICON: Record<string, typeof Wallet> = {
  cash: Wallet,
  card: CreditCard,
  transfer: ArrowLeftRight,
  wallet: Smartphone,
  crypto: Bitcoin,
  other: CircleDollarSign,
}

/**
 * Bancos y cajas — cuentas de dinero del local (Capa A, read-model).
 * Cuánto entró por cada forma de cobro en el periodo, separando CAJA (efectivo) de
 * BANCO (electrónico, neto de comisiones). Liga con la conciliación bancaria.
 * Incluido (ruta + sidebar gateados por `accounting:read`).
 */
export default function BankAndCash() {
  const { t } = useTranslation('reports')
  const { venue, fullBasePath } = useCurrentVenue()
  const tz = venue?.timezone ?? 'America/Mexico_City'

  const [range, setRange] = useState<{ from: Date; to: Date }>(() => getLast7Days(tz))
  const from = toYmd(range.from, tz)
  const to = toYmd(range.to, tz)

  const { data, isLoading, isError, refetch } = useBankAndCash({ from, to })
  const accounts = data?.accounts ?? []
  const tot = data?.totals
  const rec = data?.reconciliation

  return (
    <div className="p-4 space-y-5 bg-background">
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t('bankAndCash.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {data?.venueName
              ? t('subtitleSuffix', { base: t('bankAndCash.subtitle'), suffix: data.venueName })
              : t('bankAndCash.subtitle')}
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

      {/* KPI: caja / banco bruto / neto al banco */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <AccountingErrorState onRetry={() => refetch()} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label={t('bankAndCash.cashTotal')}
            value={Currency(tot?.cashInflowCents ?? 0, true)}
            icon={<Wallet className="w-4 h-4" />}
            accent="yellow"
            tooltip={t('bankAndCash.cashTotalTip')}
          />
          <MetricCard
            label={t('bankAndCash.electronicTotal')}
            value={Currency(tot?.electronicInflowCents ?? 0, true)}
            icon={<Landmark className="w-4 h-4" />}
            accent="blue"
            tooltip={t('bankAndCash.electronicTotalTip')}
          />
          <MetricCard
            label={t('bankAndCash.fees')}
            value={Currency(tot?.feesCents ?? 0, true)}
            icon={<Scissors className="w-4 h-4" />}
            accent="red"
          />
          <MetricCard
            label={t('bankAndCash.netToBank')}
            value={Currency(tot?.netToBankCents ?? 0, true)}
            icon={<Banknote className="w-4 h-4" />}
            accent="green"
            tooltip={t('bankAndCash.netToBankTip')}
          />
        </div>
      )}

      {/* Accounts list */}
      {!isLoading && !isError && (
        <Card className="border-input">
          <CardContent className="py-3">
            <h2 className="mb-2 text-sm font-medium text-foreground">{t('bankAndCash.accountsTitle')}</h2>
            {accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('bankAndCash.empty')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" aria-label={t('bankAndCash.accountsTitle')}>
                  <thead>
                    <tr className="border-b border-input text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-2">{t('bankAndCash.account')}</th>
                      <th className="py-2 pr-2">{t('bankAndCash.kind')}</th>
                      <th className="py-2 pr-2 text-right">{t('bankAndCash.sales')}</th>
                      <th className="py-2 pl-2 text-right">{t('bankAndCash.inflow')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map(a => {
                      const Icon = ACCOUNT_ICON[a.key] ?? CircleDollarSign
                      return (
                        <tr key={a.key} className="border-b border-input/50">
                          <td className="py-2 pr-2">
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              <span className="text-foreground">{t(`bankAndCash.accounts.${a.key}`, { defaultValue: a.key })}</span>
                            </div>
                          </td>
                          <td className="py-2 pr-2">
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-xs',
                                a.kind === 'cash'
                                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                  : 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
                              )}
                            >
                              {a.kind === 'cash' ? t('bankAndCash.kindCash') : t('bankAndCash.kindBank')}
                            </span>
                          </td>
                          <td className="py-2 pr-2 text-right tabular-nums text-muted-foreground">{a.count}</td>
                          <td className="py-2 pl-2 text-right tabular-nums text-foreground">{Currency(a.inflowCents, true)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Conciliación link */}
      {!isLoading && !isError && (
        <Link to={`${fullBasePath}/contabilidad/conciliacion`} className="block">
          <Card className="border-input transition-colors hover:bg-muted/40">
            <CardContent className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <Landmark className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">{t('bankAndCash.reconciliationTitle')}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('bankAndCash.reconciliationSub', {
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
          <p>{t('bankAndCash.disclosureCash')}</p>
          <p>{t('bankAndCash.disclosureBank')}</p>
        </CardContent>
      </Card>
    </div>
  )
}
