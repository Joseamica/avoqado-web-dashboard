/**
 * VisionGlobal - Organization-Level Aggregate Dashboard
 *
 * Main dashboard for organization owners showing aggregate KPIs across all venues.
 * Features:
 * - Aggregate metrics (total sales, transactions, active stores)
 * - Sales trend charts
 * - Store performance ranking
 * - Operational insights/anomalies
 *
 * Part of the white-label organization routes: /wl/organizations/:orgSlug
 */

import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useCurrentOrganization } from '@/hooks/use-current-organization'
import {
  DollarSign,
  Store,
  Users,
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// GlassCard component for modern dashboard design
const GlassCard: React.FC<{
  children: React.ReactNode
  className?: string
  hover?: boolean
  onClick?: () => void
}> = ({ children, className, hover = false, onClick }) => (
  <div
    onClick={onClick}
    className={cn(
      'relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm',
      'shadow-sm transition-all duration-300',
      hover && 'cursor-pointer hover:shadow-md hover:border-border hover:bg-card/90 hover:-translate-y-0.5',
      onClick && 'cursor-pointer',
      className
    )}
  >
    {children}
  </div>
)

// MetricCard component for KPI display
interface MetricCardProps {
  title: string
  value: string | number
  change?: number
  icon: React.ElementType
  iconColor: string
  loading?: boolean
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  icon: Icon,
  iconColor,
  loading = false,
}) => {
  if (loading) {
    return (
      <GlassCard className="p-6">
        <div className="flex items-start justify-between">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-8 w-24 mt-4" />
        <Skeleton className="h-4 w-32 mt-2" />
      </GlassCard>
    )
  }

  return (
    <GlassCard className="p-6">
      <div className="flex items-start justify-between">
        <div className={cn('p-2 rounded-xl bg-gradient-to-br', iconColor)}>
          <Icon className="w-5 h-5 text-primary-foreground" />
        </div>
        {change !== undefined && (
          <div className={cn(
            'flex items-center gap-1 text-sm font-medium',
            change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          )}>
            {change >= 0 ? (
              <ArrowUpRight className="w-4 h-4" />
            ) : (
              <ArrowDownRight className="w-4 h-4" />
            )}
            {Math.abs(change)}%
          </div>
        )}
      </div>
      <p className="text-3xl font-bold tracking-tight mt-4">{value}</p>
      <p className="text-sm text-muted-foreground mt-1">{title}</p>
    </GlassCard>
  )
}

const VisionGlobal: React.FC = () => {
  const { t } = useTranslation(['organization', 'common'])
  const navigate = useNavigate()
  const { organization: _organization, basePath, venues, isLoading, error } = useCurrentOrganization()

  // Calculate aggregate metrics from venues
  const metrics = useMemo(() => {
    if (!venues || venues.length === 0) {
      return {
        totalSales: 0,
        totalTransactions: 0,
        activeStores: 0,
        totalStaff: 0,
      }
    }

    return {
      totalSales: venues.reduce((sum, v) => sum + (v.metrics?.revenue || 0), 0),
      totalTransactions: venues.reduce((sum, v) => sum + (v.metrics?.orderCount || 0), 0),
      activeStores: venues.filter(v => v.status === 'ACTIVE').length,
      totalStaff: venues.reduce((sum, v) => sum + (v.metrics?.staffCount || 0), 0),
    }
  }, [venues])

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <AlertTriangle className="w-12 h-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">
          {t('organization:error.loadFailed', { defaultValue: 'Error al cargar datos' })}
        </h2>
        <p className="text-muted-foreground mb-4">{error.message}</p>
        <Button onClick={() => window.location.reload()}>
          {t('common:retry', { defaultValue: 'Reintentar' })}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">
          {t('organization:visionGlobal.title', { defaultValue: 'Visión Global' })}
        </h1>
        <p className="text-muted-foreground">
          {t('organization:visionGlobal.subtitle', {
            defaultValue: 'Resumen de todas tus tiendas en un solo lugar',
          })}
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title={t('organization:metrics.totalSales', { defaultValue: 'Ventas Totales' })}
          value={formatCurrency(metrics.totalSales)}
          change={12.5}
          icon={DollarSign}
          iconColor="from-green-500/80 to-green-600/80"
          loading={isLoading}
        />
        <MetricCard
          title={t('organization:metrics.transactions', { defaultValue: 'Transacciones' })}
          value={metrics.totalTransactions.toLocaleString()}
          change={8.2}
          icon={TrendingUp}
          iconColor="from-blue-500/80 to-blue-600/80"
          loading={isLoading}
        />
        <MetricCard
          title={t('organization:metrics.activeStores', { defaultValue: 'Tiendas Activas' })}
          value={`${metrics.activeStores}/${venues.length}`}
          icon={Store}
          iconColor="from-purple-500/80 to-purple-600/80"
          loading={isLoading}
        />
        <MetricCard
          title={t('organization:metrics.totalStaff', { defaultValue: 'Personal Total' })}
          value={metrics.totalStaff.toLocaleString()}
          change={-2.1}
          icon={Users}
          iconColor="from-orange-500/80 to-orange-600/80"
          loading={isLoading}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Sales Trend Chart Placeholder */}
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">
                {t('organization:charts.salesTrend', { defaultValue: 'Tendencia de Ventas' })}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t('organization:charts.last30Days', { defaultValue: 'Últimos 30 días' })}
              </p>
            </div>
          </div>
          <div className="h-[200px] flex items-center justify-center bg-muted/30 rounded-xl">
            <p className="text-muted-foreground text-sm">
              {t('common:comingSoon', { defaultValue: 'Gráfica próximamente' })}
            </p>
          </div>
        </GlassCard>

        {/* Product Mix Chart Placeholder */}
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">
                {t('organization:charts.productMix', { defaultValue: 'Mix de Productos' })}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t('organization:charts.byCategory', { defaultValue: 'Por categoría' })}
              </p>
            </div>
          </div>
          <div className="h-[200px] flex items-center justify-center bg-muted/30 rounded-xl">
            <p className="text-muted-foreground text-sm">
              {t('common:comingSoon', { defaultValue: 'Gráfica próximamente' })}
            </p>
          </div>
        </GlassCard>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Store Performance */}
        <GlassCard className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">
                {t('organization:storePerformance.title', { defaultValue: 'Rendimiento por Tienda' })}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t('organization:storePerformance.subtitle', { defaultValue: 'Top 5 tiendas hoy' })}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`${basePath}/venues`)}
            >
              {t('common:viewAll', { defaultValue: 'Ver todas' })}
              <ArrowUpRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : venues.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center">
              <p className="text-muted-foreground">
                {t('organization:storePerformance.noStores', { defaultValue: 'No hay tiendas registradas' })}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {venues.slice(0, 5).map((venue, index) => (
                <div
                  key={venue.id}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/wl/venues/${venue.slug}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{venue.name}</p>
                      <p className="text-xs text-muted-foreground">{venue.city || 'Sin ubicación'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(venue.metrics?.revenue || 0)}</p>
                    <p className="text-xs text-muted-foreground">
                      {venue.metrics?.orderCount || 0} {t('organization:transactions', { defaultValue: 'trans.' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        {/* Insights/Anomalies */}
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">
                {t('organization:insights.title', { defaultValue: 'Alertas' })}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t('organization:insights.subtitle', { defaultValue: 'Requieren atención' })}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {/* Placeholder insights */}
            <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">
                    {t('organization:insights.lowStock', { defaultValue: 'Stock bajo' })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('organization:insights.lowStockDesc', {
                      defaultValue: '3 tiendas con inventario crítico',
                    })}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-start gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">
                    {t('organization:insights.salesSpike', { defaultValue: 'Pico de ventas' })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('organization:insights.salesSpikeDesc', {
                      defaultValue: 'Zona Norte +45% vs ayer',
                    })}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20">
              <div className="flex items-start gap-2">
                <Store className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">
                    {t('organization:insights.newStore', { defaultValue: 'Nueva tienda' })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('organization:insights.newStoreDesc', {
                      defaultValue: 'Sucursal Polanco lista para activar',
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  )
}

export default VisionGlobal
