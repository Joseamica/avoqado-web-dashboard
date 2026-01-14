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
import { useAuth } from '@/context/AuthContext'
import { GlassCard } from '@/components/ui/glass-card'
import { MetricCard } from '@/components/ui/metric-card'
import {
  TrendingUp,
  Package,
  DollarSign,
  Users,
  ShoppingCart,
  Activity,
} from 'lucide-react'
import { useMemo } from 'react'

// Placeholder data - will be replaced with real API calls
const MOCK_KPIS = {
  todaySales: 45230.0,
  todayUnits: 127,
  avgTicket: 356.14,
  weekSales: 287450.0,
  weekUnits: 823,
  monthSales: 1245680.0,
  monthUnits: 3547,
  activePromoters: 12,
  activeStores: 8,
}

const MOCK_TOP_SELLERS = [
  { id: '1', name: 'Juan Pérez', sales: 12450.0, units: 35 },
  { id: '2', name: 'María García', sales: 10280.0, units: 29 },
  { id: '3', name: 'Carlos López', sales: 8920.0, units: 25 },
  { id: '4', name: 'Ana Martínez', sales: 7650.0, units: 21 },
  { id: '5', name: 'Roberto Sánchez', sales: 5930.0, units: 17 },
]

const MOCK_CATEGORIES = [
  { id: '1', name: 'Chip Telcel Negra', units: 45, percentage: 35.4 },
  { id: '2', name: 'Chip Telcel Blanca', units: 38, percentage: 29.9 },
  { id: '3', name: 'Chip Telcel Roja', units: 28, percentage: 22.0 },
  { id: '4', name: 'Recarga Telcel', units: 16, percentage: 12.7 },
]

export default function CommandCenter() {
  const { t } = useTranslation(['playtelecom', 'common'])
  const { activeVenue } = useAuth()

  // Format currency
  const formatCurrency = useMemo(
    () =>
      (value: number) =>
        new Intl.NumberFormat('es-MX', {
          style: 'currency',
          currency: activeVenue?.currency || 'MXN',
          minimumFractionDigits: 2,
        }).format(value),
    [activeVenue?.currency]
  )

  return (
    <div className="space-y-6">
      {/* KPI Grid - Bento style */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label={t('playtelecom:commandCenter.todaySales', { defaultValue: 'Ventas Hoy' })}
          value={formatCurrency(MOCK_KPIS.todaySales)}
          icon={<DollarSign className="w-4 h-4" />}
          trend="up"
          accent="green"
        />
        <MetricCard
          label={t('playtelecom:commandCenter.unitsSold', { defaultValue: 'Unidades Vendidas' })}
          value={MOCK_KPIS.todayUnits.toString()}
          icon={<Package className="w-4 h-4" />}
          trend="up"
          accent="blue"
        />
        <MetricCard
          label={t('playtelecom:commandCenter.avgTicket', { defaultValue: 'Ticket Promedio' })}
          value={formatCurrency(MOCK_KPIS.avgTicket)}
          icon={<ShoppingCart className="w-4 h-4" />}
          trend="up"
          accent="purple"
        />
        <MetricCard
          label={t('playtelecom:commandCenter.activePromoters', { defaultValue: 'Promotores Activos' })}
          value={MOCK_KPIS.activePromoters.toString()}
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
              <p className="text-xl font-semibold">{formatCurrency(MOCK_KPIS.weekSales)}</p>
              <p className="text-xs text-muted-foreground">{MOCK_KPIS.weekUnits} unidades</p>
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
              <p className="text-xl font-semibold">{formatCurrency(MOCK_KPIS.monthSales)}</p>
              <p className="text-xs text-muted-foreground">{MOCK_KPIS.monthUnits} unidades</p>
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
              <p className="text-xl font-semibold">{MOCK_KPIS.activeStores}</p>
              <p className="text-xs text-muted-foreground">operando ahora</p>
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
            {MOCK_TOP_SELLERS.map((seller, index) => (
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
            ))}
          </div>
        </GlassCard>

        {/* Category Breakdown */}
        <GlassCard className="lg:col-span-5 p-6">
          <h3 className="text-lg font-semibold mb-4">
            {t('playtelecom:commandCenter.categoryBreakdown', { defaultValue: 'Ventas por Categoría' })}
          </h3>
          <div className="space-y-4">
            {MOCK_CATEGORIES.map(category => (
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
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Placeholder for chart - TODO: Implement with Recharts */}
      <GlassCard className="p-6">
        <h3 className="text-lg font-semibold mb-4">
          {t('playtelecom:commandCenter.salesTrend', { defaultValue: 'Tendencia de Ventas' })}
        </h3>
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          <p>{t('common:comingSoon', { defaultValue: 'Gráfica próximamente...' })}</p>
        </div>
      </GlassCard>
    </div>
  )
}
