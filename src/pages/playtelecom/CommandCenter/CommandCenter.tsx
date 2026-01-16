/**
 * CommandCenter - Main PlayTelecom Dashboard
 *
 * Displays:
 * - KPI summary cards (today's sales, units sold, avg ticket)
 * - Sales trend chart
 * - Top sellers table
 * - Category breakdown
 *
 * Based on mockup: index.html
 */

import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { GlassCard } from '@/components/ui/glass-card'
import { MetricCard } from '@/components/ui/metric-card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  TrendingUp,
  Package,
  DollarSign,
  Users,
  ShoppingCart,
  Activity,
  AlertCircle,
} from 'lucide-react'
import { useMemo } from 'react'
import { ActivityFeed, OperationalInsights, SalesTrendChart } from './components'
import { getCommandCenterSummary } from '@/services/commandCenter.service'

export default function CommandCenter() {
  const { t } = useTranslation(['playtelecom', 'common'])
  const { venue, venueId } = useCurrentVenue()

  // Fetch command center summary
  const {
    data: summary,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['commandCenter', 'summary', venueId],
    queryFn: () => getCommandCenterSummary(venueId!),
    enabled: !!venueId,
    staleTime: 30000, // 30 seconds
  })

  // Format currency
  const formatCurrency = useMemo(
    () =>
      (value: number) =>
        new Intl.NumberFormat('es-MX', {
          style: 'currency',
          currency: venue?.currency || 'MXN',
          minimumFractionDigits: 2,
        }).format(value),
    [venue?.currency]
  )

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* KPI Grid Loading */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        {/* Secondary KPIs Loading */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        {/* Main content Loading */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Skeleton className="lg:col-span-7 h-80 rounded-xl" />
          <Skeleton className="lg:col-span-5 h-80 rounded-xl" />
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="w-12 h-12 text-destructive mb-4" />
        <h3 className="text-lg font-semibold mb-2">
          {t('common:error.loadingFailed', { defaultValue: 'Error al cargar datos' })}
        </h3>
        <p className="text-muted-foreground text-center max-w-md">
          {t('playtelecom:commandCenter.errorDescription', {
            defaultValue: 'No se pudieron cargar los datos del dashboard. Por favor intenta de nuevo.',
          })}
        </p>
      </div>
    )
  }

  // Use data from API with safe defaults for each field
  const kpis = {
    todaySales: summary?.todaySales ?? 0,
    todayUnits: summary?.todayUnits ?? 0,
    avgTicket: summary?.avgTicket ?? 0,
    weekSales: summary?.weekSales ?? 0,
    weekUnits: summary?.weekUnits ?? 0,
    monthSales: summary?.monthSales ?? 0,
    monthUnits: summary?.monthUnits ?? 0,
    activePromoters: summary?.activePromoters ?? 0,
    totalPromoters: summary?.totalPromoters ?? 0,
    activeStores: summary?.activeStores ?? 0,
    totalStores: summary?.totalStores ?? 0,
    topSellers: summary?.topSellers ?? [],
    categoryBreakdown: summary?.categoryBreakdown ?? [],
  }

  return (
    <div className="space-y-6">
      {/* KPI Grid - Bento style */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label={t('playtelecom:commandCenter.todaySales', { defaultValue: 'Ventas Hoy' })}
          value={formatCurrency(kpis.todaySales)}
          icon={<DollarSign className="w-4 h-4" />}
          trend="up"
          accent="green"
        />
        <MetricCard
          label={t('playtelecom:commandCenter.unitsSold', { defaultValue: 'Unidades Vendidas' })}
          value={kpis.todayUnits.toString()}
          icon={<Package className="w-4 h-4" />}
          trend="up"
          accent="blue"
        />
        <MetricCard
          label={t('playtelecom:commandCenter.avgTicket', { defaultValue: 'Ticket Promedio' })}
          value={formatCurrency(kpis.avgTicket)}
          icon={<ShoppingCart className="w-4 h-4" />}
          trend="up"
          accent="purple"
        />
        <MetricCard
          label={t('playtelecom:commandCenter.activePromoters', { defaultValue: 'Promotores Activos' })}
          value={`${kpis.activePromoters}/${kpis.totalPromoters}`}
          icon={<Users className="w-4 h-4" />}
          accent="orange"
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
              <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {t('playtelecom:commandCenter.weekSales', { defaultValue: 'Ventas Semana' })}
              </p>
              <p className="text-xl font-semibold">{formatCurrency(kpis.weekSales)}</p>
              <p className="text-xs text-muted-foreground">{kpis.weekUnits} unidades</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5">
              <Activity className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {t('playtelecom:commandCenter.monthSales', { defaultValue: 'Ventas Mes' })}
              </p>
              <p className="text-xl font-semibold">{formatCurrency(kpis.monthSales)}</p>
              <p className="text-xs text-muted-foreground">{kpis.monthUnits} unidades</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-500/5">
              <Package className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {t('playtelecom:commandCenter.activeStores', { defaultValue: 'Tiendas Activas' })}
              </p>
              <p className="text-xl font-semibold">{kpis.activeStores}/{kpis.totalStores}</p>
              <p className="text-xs text-muted-foreground">
                {t('playtelecom:commandCenter.operatingNow', { defaultValue: 'operando ahora' })}
              </p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Top Sellers */}
        <GlassCard className="lg:col-span-7 p-6">
          <h3 className="text-lg font-semibold mb-4">
            {t('playtelecom:commandCenter.topSellers', { defaultValue: 'Top Vendedores' })}
          </h3>
          <div className="space-y-3">
            {kpis.topSellers.length > 0 ? (
              kpis.topSellers.map((seller, index) => (
                <div
                  key={seller.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium">{seller.name}</p>
                      <p className="text-sm text-muted-foreground">{seller.units} unidades</p>
                    </div>
                  </div>
                  <p className="font-semibold text-green-600 dark:text-green-400">
                    {formatCurrency(seller.sales)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">
                {t('playtelecom:commandCenter.noSales', { defaultValue: 'No hay ventas registradas hoy' })}
              </p>
            )}
          </div>
        </GlassCard>

        {/* Category Breakdown */}
        <GlassCard className="lg:col-span-5 p-6">
          <h3 className="text-lg font-semibold mb-4">
            {t('playtelecom:commandCenter.categoryBreakdown', { defaultValue: 'Ventas por Categoría' })}
          </h3>
          <div className="space-y-4">
            {kpis.categoryBreakdown.length > 0 ? (
              kpis.categoryBreakdown.map(category => (
                <div key={category.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{category.name}</span>
                    <span className="text-sm text-muted-foreground">{category.units} uds</span>
                  </div>
                  <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500"
                      style={{ width: `${category.percentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-right">{category.percentage}%</p>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">
                {t('playtelecom:commandCenter.noCategories', { defaultValue: 'Sin datos de categorías' })}
              </p>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Sales Trend Chart */}
      <SalesTrendChart />

      {/* Bottom Row - Activity Feed & Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <ActivityFeed className="lg:col-span-7" />
        <OperationalInsights className="lg:col-span-5" />
      </div>
    </div>
  )
}
