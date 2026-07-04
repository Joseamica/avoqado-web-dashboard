/**
 * Bancos → Reportes. KPIs REALES (últimos 30 días, sumados sobre todas las cuentas conectadas,
 * vía financialConnectionAPI.getMovementStats — el mismo endpoint que ya usa Movimientos) +
 * una gráfica de tendencia con datos Mock (bankingHub.service.getReportTrend), badgeada.
 * Nunca se mezclan: los KPIs de arriba son honestos, la tendencia de abajo dice "Mock" en su badge.
 */
import { useMemo } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowDownLeft, ArrowUpRight, Repeat, Send } from 'lucide-react'
import { Line, LineChart, CartesianGrid, XAxis } from 'recharts'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { Currency } from '@/utils/currency'
import { getIntlLocale } from '@/utils/i18n-locale'
import { FeatureGate } from '@/components/billing/FeatureGate'
import { useTierFeatureAccess } from '@/hooks/use-tier-feature-access'
import { BancosEmptyState, BancosErrorState } from '@/pages/Bancos/BancosEmptyState'
import { BancosPageHeader } from '@/pages/Bancos/BancosPageHeader'
import { useBancosData, type BancosData } from '@/pages/Bancos/useBancosData'
import { financialConnectionAPI, type MovementCategoryStats } from '@/services/financialConnection.service'
import { getReportTrend } from '@/services/bankingHub.service'

const TONE = {
  in: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  out: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  transfer: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  dispersion: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
} as const

function rangeToIso(days: number): { from: string; to: string } {
  const to = new Date()
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000)
  return { from: from.toISOString(), to: to.toISOString() }
}

function sumStats(list: Array<MovementCategoryStats | undefined>): MovementCategoryStats {
  return list.reduce<MovementCategoryStats>(
    (acc, s) => ({
      amount: (acc.amount ?? 0) + (s?.amount ?? 0),
      fee: (acc.fee ?? 0) + (s?.fee ?? 0),
      count: (acc.count ?? 0) + (s?.count ?? 0),
    }),
    { amount: 0, fee: 0, count: 0 },
  )
}

function KpiCard({
  label,
  icon,
  tone,
  stats,
  loading,
  error,
}: {
  label: string
  icon: React.ReactNode
  tone: keyof typeof TONE
  stats: MovementCategoryStats
  loading: boolean
  /** Al menos una cuenta falló al cargar sus stats — el total sería incompleto, nunca mostrar $0 fabricado. */
  error: boolean
}) {
  const { t } = useTranslation('financialConnections')
  return (
    <div className="flex flex-col gap-2.5 rounded-xl bg-muted/50 p-4">
      <div className="flex items-center gap-2">
        <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', TONE[tone])}>{icon}</span>
        <span className="text-xs font-medium leading-tight text-muted-foreground">{label}</span>
      </div>
      {loading ? (
        <Skeleton className="h-7 w-24" />
      ) : error ? (
        <span className="text-xl font-semibold tracking-tight text-muted-foreground">—</span>
      ) : (
        <span className="text-xl font-semibold tracking-tight tabular-nums">{Currency(stats.amount ?? 0)}</span>
      )}
      <span className="text-xs text-muted-foreground">
        {error ? t('hub.reports.statsError') : t('movements.stats.operations', { count: stats.count ?? 0 })}
      </span>
    </div>
  )
}

function ReportsContent({ venueId, accounts }: { venueId: string; accounts: BancosData['accounts'] }) {
  const { t, i18n } = useTranslation('financialConnections')
  const range = useMemo(() => rangeToIso(30), [])

  const statsQueries = useQueries({
    queries: accounts.map(({ account }) => ({
      queryKey: ['financial-account-movement-stats', account.id, 30],
      queryFn: () => financialConnectionAPI.getMovementStats(venueId, account.id, range),
    })),
  })
  const statsLoading = statsQueries.some(q => q.isLoading)
  // Una cuenta que falla deja el total de LAS 4 categorías incompleto (cada categoría suma sobre
  // todas las cuentas) — nunca mostrar $0 fabricado cuando en realidad no se pudo leer todo.
  const statsError = statsQueries.some(q => q.isError)

  const totals = useMemo(
    () => ({
      speiIn: sumStats(statsQueries.map(q => q.data?.speiIn)),
      speiOut: sumStats(statsQueries.map(q => q.data?.speiOut)),
      internalTransfers: sumStats(statsQueries.map(q => q.data?.internalTransfers)),
      dispersions: sumStats(statsQueries.map(q => q.data?.dispersions)),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- statsQueries is a new array every render; the query data itself is the real dependency
    [statsQueries.map(q => q.dataUpdatedAt).join(',')],
  )

  const trend = useQuery({
    queryKey: ['banking-hub-report-trend', i18n.language],
    queryFn: () => getReportTrend(6, getIntlLocale(i18n.language)),
  })

  const chartConfig = { amount: { label: t('hub.reports.trend.label'), color: 'var(--chart-1)' } }

  return (
    <div className="flex flex-col gap-5">
      {statsError && <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{t('hub.reports.statsError')}</div>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label={t('movements.stats.speiIn')}
          tone="in"
          icon={<ArrowDownLeft className="h-4 w-4" aria-hidden />}
          stats={totals.speiIn}
          loading={statsLoading}
          error={statsError}
        />
        <KpiCard
          label={t('movements.stats.speiOut')}
          tone="out"
          icon={<ArrowUpRight className="h-4 w-4" aria-hidden />}
          stats={totals.speiOut}
          loading={statsLoading}
          error={statsError}
        />
        <KpiCard
          label={t('movements.stats.internalTransfers')}
          tone="transfer"
          icon={<Repeat className="h-4 w-4" aria-hidden />}
          stats={totals.internalTransfers}
          loading={statsLoading}
          error={statsError}
        />
        <KpiCard
          label={t('movements.stats.dispersions')}
          tone="dispersion"
          icon={<Send className="h-4 w-4" aria-hidden />}
          stats={totals.dispersions}
          loading={statsLoading}
          error={statsError}
        />
      </div>

      <Card className="border-input">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>{t('hub.reports.trend.title')}</CardTitle>
            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
              {t('hub.reports.trend.mockBadge')}
            </Badge>
          </div>
          <CardDescription>{t('hub.reports.trend.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          {trend.isLoading ? (
            <Skeleton className="h-[220px] w-full" />
          ) : (
            <ChartContainer config={chartConfig} className="aspect-auto h-[220px] w-full">
              <LineChart accessibilityLayer data={trend.data?.points ?? []} margin={{ left: 12, right: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip content={<ChartTooltipContent formatter={value => Currency(Number(value), false)} />} />
                <Line dataKey="amount" type="monotone" stroke="var(--color-amount)" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function BancosReportes() {
  const { t } = useTranslation('financialConnections')
  const { hasAccess } = useTierFeatureAccess('BANKING_HUB')
  const { venueId, accounts, hasConnection, hasPendingConnection, hasProviders, isLoading, isError, refetch } = useBancosData({
    enabled: hasAccess,
  })

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-4 sm:p-6">
      <BancosPageHeader title={t('hub.reports.title')} description={t('hub.reports.description')} />
      <FeatureGate feature="BANKING_HUB">
        {isLoading ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : isError ? (
          <BancosErrorState onRetry={refetch} />
        ) : !hasConnection || !venueId ? (
          <BancosEmptyState venueId={venueId ?? ''} hasProviders={hasProviders} pendingReconnect={hasPendingConnection} />
        ) : (
          <ReportsContent venueId={venueId} accounts={accounts} />
        )}
      </FeatureGate>
    </div>
  )
}
