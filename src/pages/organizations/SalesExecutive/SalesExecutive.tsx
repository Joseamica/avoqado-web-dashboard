/**
 * Org-level "Ventas" executive dashboard (PlayTelecom / Walmart).
 *
 * Aggregated view of confirmed sales across all venues in the organization.
 * Only counts SaleVerification with status=COMPLETED ("ventas mostradas
 * solo deben ser las confirmadas" per requirement).
 *
 * Charts (all sorted desc):
 *   - "Ventas Totales por Mes" (bar)
 *   - "Ventas por Tipo de SIM" (stacked bar by category)
 *   - "Ventas Totales Semanales" (bar)
 *   - "Ventas Totales por Ciudad" (heatmap table)
 *   - "Ventas Totales por Supervisor" (heatmap table)
 *   - "Ventas Totales por Tienda" (heatmap table)
 */

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis, Cell, Legend } from 'recharts'
import { Link } from 'react-router-dom'
import { Receipt, ChevronRight } from 'lucide-react'
import { useCurrentOrganization } from '@/hooks/use-current-organization'
import { useIsMobile } from '@/hooks/use-mobile'
import { GlassCard } from '@/components/ui/glass-card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  getOrgSalesSummary,
  getSalesByMonth,
  getSalesBySimType,
  getSalesByWeek,
  getSalesByCity,
  getSalesBySupervisor,
  getSalesByStore,
} from '@/services/saleVerification.org.service'

const MXN = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 })

// Reused chart palette (5 distinct colors for stacked bar)
const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

const MONTH_NAME_ES: Record<string, string> = {
  '01': 'Ene',
  '02': 'Feb',
  '03': 'Mar',
  '04': 'Abr',
  '05': 'May',
  '06': 'Jun',
  '07': 'Jul',
  '08': 'Ago',
  '09': 'Sep',
  '10': 'Oct',
  '11': 'Nov',
  '12': 'Dic',
}

function formatMonth(key: string): string {
  // key is "2026-05"
  const [, mm] = key.split('-')
  return MONTH_NAME_ES[mm] ?? key
}

export default function SalesExecutive() {
  const { orgId, basePath, isLoading: orgLoading, organization } = useCurrentOrganization()
  const isMobile = useIsMobile()
  const chartHeight = isMobile ? 200 : 260
  const weekChartHeight = isMobile ? 180 : 200

  const summary = useQuery({
    queryKey: ['org', orgId, 'sales-summary'],
    queryFn: () => getOrgSalesSummary(orgId!),
    enabled: !!orgId,
    staleTime: 60_000,
  })
  const byMonth = useQuery({
    queryKey: ['org', orgId, 'sales-by-month'],
    queryFn: () => getSalesByMonth(orgId!),
    enabled: !!orgId,
    staleTime: 60_000,
  })
  const bySimType = useQuery({
    queryKey: ['org', orgId, 'sales-by-sim-type'],
    queryFn: () => getSalesBySimType(orgId!),
    enabled: !!orgId,
    staleTime: 60_000,
  })
  const byWeek = useQuery({
    queryKey: ['org', orgId, 'sales-by-week'],
    queryFn: () => getSalesByWeek(orgId!),
    enabled: !!orgId,
    staleTime: 60_000,
  })
  const byCity = useQuery({
    queryKey: ['org', orgId, 'sales-by-city'],
    queryFn: () => getSalesByCity(orgId!),
    enabled: !!orgId,
    staleTime: 60_000,
  })
  const bySupervisor = useQuery({
    queryKey: ['org', orgId, 'sales-by-supervisor'],
    queryFn: () => getSalesBySupervisor(orgId!),
    enabled: !!orgId,
    staleTime: 60_000,
  })
  const byStore = useQuery({
    queryKey: ['org', orgId, 'sales-by-store'],
    queryFn: () => getSalesByStore(orgId!),
    enabled: !!orgId,
    staleTime: 60_000,
  })

  // Prepare chart data
  const monthData = useMemo(
    () =>
      (byMonth.data ?? [])
        .slice()
        .reverse() // chart wants oldest → newest left-to-right, but list returns desc
        .map(d => ({ month: formatMonth(d.month), count: d.count, revenue: d.revenue })),
    [byMonth.data],
  )

  const simTypeData = useMemo(() => {
    const months = (bySimType.data ?? []).slice().reverse()
    const categories = new Set<string>()
    months.forEach(m => Object.keys(m.byCategory).forEach(c => categories.add(c)))
    const categoryList = Array.from(categories)
    return {
      data: months.map(m => ({ month: formatMonth(m.month), ...m.byCategory })),
      categories: categoryList,
    }
  }, [bySimType.data])

  const weekData = useMemo(
    () =>
      (byWeek.data ?? [])
        .slice()
        .reverse()
        .map(d => ({ week: d.week, count: d.count, revenue: d.revenue })),
    [byWeek.data],
  )

  if (orgLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  if (!orgId) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">No se pudo determinar la organización.</p>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Ventas</h1>
          <p className="text-xs sm:text-sm text-muted-foreground truncate">
            {organization?.name ?? 'Organización'} · Solo ventas confirmadas
          </p>
        </div>
        <Button asChild size={isMobile ? 'sm' : 'default'} className="shrink-0">
          <Link to={`${basePath}/sales/detail`} className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            <span className="hidden sm:inline">Detalle y aprobación</span>
            <span className="sm:hidden">Detalle</span>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total confirmadas" value={summary.data?.completedCount ?? 0} loading={summary.isLoading} />
        <KpiCard
          label="Monto confirmado"
          value={summary.data?.totalRevenue ? MXN(summary.data.totalRevenue) : '$0'}
          loading={summary.isLoading}
          asString
        />
        <KpiCard label="Pendientes de revisión" value={summary.data?.pendingCount ?? 0} loading={summary.isLoading} tone="warning" />
        <KpiCard label="Por revisar" value={summary.data?.failedCount ?? 0} loading={summary.isLoading} tone="danger" />
      </div>

      {/* Row 1: by month + by sim type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassCard className="p-4">
          <h2 className="text-sm font-semibold mb-3">Ventas Totales por Mes</h2>
          {byMonth.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : monthData.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart data={monthData} margin={isMobile ? { top: 5, right: 5, left: -20, bottom: 0 } : undefined}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="month" tick={{ fontSize: isMobile ? 10 : 12 }} />
                <YAxis tick={{ fontSize: isMobile ? 10 : 12 }} width={isMobile ? 30 : 40} />
                <RechartsTooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                  formatter={(value: number) => [value, 'Ventas']}
                />
                <Bar dataKey="count" fill={PALETTE[0]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </GlassCard>

        <GlassCard className="p-4">
          <h2 className="text-sm font-semibold mb-3">Ventas por Tipo de SIM</h2>
          {bySimType.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : simTypeData.data.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart data={simTypeData.data} margin={isMobile ? { top: 5, right: 5, left: -20, bottom: 0 } : undefined}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="month" tick={{ fontSize: isMobile ? 10 : 12 }} />
                <YAxis tick={{ fontSize: isMobile ? 10 : 12 }} width={isMobile ? 30 : 40} />
                <RechartsTooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                />
                <Legend wrapperStyle={{ fontSize: isMobile ? '0.625rem' : '0.75rem' }} />
                {simTypeData.categories.map((cat, i) => (
                  <Bar
                    key={cat}
                    dataKey={cat}
                    stackId="sim"
                    fill={PALETTE[i % PALETTE.length]}
                    radius={i === simTypeData.categories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </GlassCard>
      </div>

      {/* Row 2: by week */}
      <GlassCard className="p-4">
        <h2 className="text-sm font-semibold mb-3">Ventas Totales Semanales</h2>
        {byWeek.isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : weekData.length === 0 ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height={weekChartHeight}>
            <BarChart data={weekData} margin={isMobile ? { top: 5, right: 5, left: -20, bottom: 0 } : undefined}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="week" tick={{ fontSize: isMobile ? 9 : 12 }} interval={isMobile ? 'preserveStartEnd' : 0} />
              <YAxis tick={{ fontSize: isMobile ? 10 : 12 }} width={isMobile ? 30 : 40} />
              <RechartsTooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                formatter={(value: number) => [value, 'Ventas']}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {weekData.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </GlassCard>

      {/* Row 3: city heatmap table */}
      <GlassCard className="p-4 overflow-hidden">
        <h2 className="text-sm font-semibold mb-3">Ventas Totales por Ciudad</h2>
        {byCity.isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : (byCity.data ?? []).length === 0 ? (
          <EmptyChart />
        ) : (
          <HeatmapTable
            rows={(byCity.data ?? []).map(r => ({ name: r.city, byBucket: r.byMonth, total: r.total }))}
            rowLabel="Ciudad"
            sortBuckets={keys => keys.sort((a, b) => b.localeCompare(a)).map(k => ({ key: k, label: formatMonth(k) }))}
          />
        )}
      </GlassCard>

      {/* Row 4: supervisor heatmap table */}
      <GlassCard className="p-4 overflow-hidden">
        <h2 className="text-sm font-semibold mb-3">Ventas Totales por Supervisor</h2>
        {bySupervisor.isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : (bySupervisor.data ?? []).length === 0 ? (
          <EmptyChart />
        ) : (
          <HeatmapTable
            rows={(bySupervisor.data ?? []).map(r => ({ name: r.supervisorName, byBucket: r.byWeek, total: r.total }))}
            rowLabel="Supervisor"
            sortBuckets={keys => keys.sort((a, b) => a.localeCompare(b)).map(k => ({ key: k, label: k }))}
          />
        )}
      </GlassCard>

      {/* Row 5: store heatmap table */}
      <GlassCard className="p-4 overflow-hidden">
        <h2 className="text-sm font-semibold mb-3">Ventas Totales por Tienda</h2>
        {byStore.isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : (byStore.data ?? []).length === 0 ? (
          <EmptyChart />
        ) : (
          <HeatmapTable
            rows={(byStore.data ?? []).map(r => ({ name: r.venueName, byBucket: r.byWeek, total: r.total }))}
            rowLabel="Tienda"
            sortBuckets={keys => keys.sort((a, b) => a.localeCompare(b)).map(k => ({ key: k, label: k }))}
          />
        )}
      </GlassCard>
    </div>
  )
}

function KpiCard({
  label,
  value,
  loading,
  tone,
  asString,
}: {
  label: string
  value: number | string
  loading?: boolean
  tone?: 'success' | 'warning' | 'danger'
  asString?: boolean
}) {
  const toneClass =
    tone === 'success'
      ? 'text-green-700 dark:text-green-400'
      : tone === 'warning'
        ? 'text-yellow-700 dark:text-yellow-400'
        : tone === 'danger'
          ? 'text-red-700 dark:text-red-400'
          : 'text-foreground'
  return (
    <GlassCard className="p-3 sm:p-4">
      <p className="text-[10px] sm:text-xs uppercase tracking-wide text-muted-foreground mb-1 leading-tight">{label}</p>
      {loading ? (
        <Skeleton className="h-7 w-20" />
      ) : (
        <p className={cn('text-lg sm:text-2xl font-bold leading-tight break-words', toneClass)}>
          {asString ? value : (value as number).toLocaleString('es-MX')}
        </p>
      )}
    </GlassCard>
  )
}

function EmptyChart() {
  return <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">Sin datos en el rango.</div>
}

interface HeatmapRow {
  name: string
  byBucket: Record<string, number>
  total: number
}

function HeatmapTable({
  rows,
  rowLabel,
  sortBuckets,
}: {
  rows: HeatmapRow[]
  rowLabel: string
  sortBuckets: (keys: string[]) => { key: string; label: string }[]
}) {
  const isMobile = useIsMobile()

  // Build the column list from all buckets across rows
  const allBuckets = useMemo(() => {
    const set = new Set<string>()
    rows.forEach(r => Object.keys(r.byBucket).forEach(k => set.add(k)))
    return sortBuckets(Array.from(set))
  }, [rows, sortBuckets])

  // Cap intensity at p95 to avoid one outlier flattening everyone else.
  const maxValue = useMemo(() => {
    const values = rows.flatMap(r => Object.values(r.byBucket))
    if (values.length === 0) return 1
    const sorted = values.slice().sort((a, b) => a - b)
    const p95 = sorted[Math.floor(sorted.length * 0.95)]
    return Math.max(p95, 1)
  }, [rows])

  const cellPad = isMobile ? 'px-1.5 py-1.5' : 'px-3 py-2'
  const firstColPad = isMobile ? 'px-2 py-1.5' : 'px-3 py-2'
  const cellText = isMobile ? 'text-[10px]' : 'text-xs'

  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full', isMobile ? 'text-xs' : 'text-sm')}>
        <thead>
          <tr className={cn(cellText, 'uppercase text-muted-foreground')}>
            <th
              className={cn(
                firstColPad,
                'text-left sticky left-0 z-10 bg-card whitespace-nowrap',
              )}
            >
              {rowLabel}
            </th>
            {allBuckets.map(b => (
              <th key={b.key} className={cn(cellPad, 'text-center whitespace-nowrap')}>
                {b.label}
              </th>
            ))}
            <th className={cn(cellPad, 'text-right')}>Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.name} className="border-t border-border/30">
              <td
                className={cn(
                  firstColPad,
                  'font-medium whitespace-nowrap sticky left-0 z-10 bg-card',
                  isMobile && 'max-w-[120px] truncate',
                )}
                title={row.name}
              >
                {row.name}
              </td>
              {allBuckets.map(b => {
                const v = row.byBucket[b.key] ?? 0
                const intensity = v === 0 ? 0 : Math.min(v / maxValue, 1)
                const bg = intensity === 0 ? 'transparent' : `hsla(217, 91%, 60%, ${Math.max(intensity * 0.6, 0.1)})`
                return (
                  <td key={b.key} className={cn(cellPad, 'text-center font-mono', cellText)} style={{ backgroundColor: bg }}>
                    {v || ''}
                  </td>
                )
              })}
              <td className={cn(cellPad, 'text-right font-bold font-mono')}>{row.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
