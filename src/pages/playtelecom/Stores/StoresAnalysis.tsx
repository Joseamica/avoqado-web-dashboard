/**
 * StoresAnalysis - Store Performance Dashboard
 *
 * Displays:
 * - Store comparison metrics (ranked cards)
 * - Sales by store (today and week)
 * - Inventory and promoter counts per store
 * - Week-over-week trends
 *
 * Mockup: file:///Users/amieva/Downloads/mockups%20sistema%20bait/tiendas.html
 * Access: MANAGER+ only
 */

import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { GlassCard } from '@/components/ui/glass-card'
import { Store, TrendingUp, TrendingDown, Package, Users } from 'lucide-react'
import { useMemo } from 'react'
import { cn } from '@/lib/utils'

// Placeholder data - will be replaced with real API calls
const MOCK_STORES = [
  {
    id: '1',
    name: 'Plaza Centro',
    manager: 'Roberto Sánchez',
    todaySales: 8450.00,
    weekSales: 45230.00,
    inventory: 85,
    promoters: 4,
    trend: 12.5,
  },
  {
    id: '2',
    name: 'Sucursal Norte',
    manager: 'Ana Martínez',
    todaySales: 6280.00,
    weekSales: 38120.00,
    inventory: 62,
    promoters: 3,
    trend: -3.2,
  },
  {
    id: '3',
    name: 'Sucursal Sur',
    manager: 'Carlos López',
    todaySales: 5120.00,
    weekSales: 29850.00,
    inventory: 45,
    promoters: 2,
    trend: 8.7,
  },
]

export function StoresAnalysis() {
  const { t } = useTranslation(['playtelecom', 'common'])
  const { activeVenue } = useAuth()

  // Format currency
  const formatCurrency = useMemo(
    () =>
      (value: number) =>
        new Intl.NumberFormat('es-MX', {
          style: 'currency',
          currency: activeVenue?.currency || 'MXN',
          minimumFractionDigits: 0,
        }).format(value),
    [activeVenue?.currency]
  )

  return (
    <div className="space-y-6">
      {/* Store Cards Grid - Mockup style */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {MOCK_STORES.map((store, index) => (
          <GlassCard key={store.id} className="p-5" hover>
            {/* Header: Store icon, name, manager, rank badge */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-muted/50">
                  <Store className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold">{store.name}</h3>
                  <p className="text-sm text-muted-foreground">{store.manager}</p>
                </div>
              </div>
              {/* Rank badge - matches mockup style */}
              <div className={cn(
                'px-2 py-0.5 rounded-full text-xs font-medium',
                'border border-border bg-muted/50 text-muted-foreground'
              )}>
                #{index + 1}
              </div>
            </div>

            {/* Sales metrics */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {t('playtelecom:stores.todaySales', { defaultValue: 'Ventas Hoy' })}
                </span>
                <span className="text-lg font-bold">{formatCurrency(store.todaySales)}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {t('playtelecom:stores.weekSales', { defaultValue: 'Ventas Semana' })}
                </span>
                <span className="font-semibold">{formatCurrency(store.weekSales)}</span>
              </div>
            </div>

            {/* Inventory and Promoters row */}
            <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
              <div className="flex items-center gap-1.5">
                <Package className="w-4 h-4" />
                <span>{store.inventory} items</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                <span>{store.promoters} promotores</span>
              </div>
            </div>

            {/* Trend indicator - matches mockup positioning */}
            <div className="flex items-center gap-1.5 text-sm">
              {store.trend >= 0 ? (
                <>
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    +{store.trend}%
                  </span>
                </>
              ) : (
                <>
                  <TrendingDown className="w-4 h-4 text-red-500" />
                  <span className="text-red-600 dark:text-red-400 font-medium">
                    {store.trend}%
                  </span>
                </>
              )}
              <span className="text-muted-foreground">vs semana anterior</span>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Comparativa de Tiendas - Coming Soon */}
      <GlassCard className="p-6">
        <h3 className="text-lg font-semibold mb-4">
          {t('playtelecom:stores.comparison', { defaultValue: 'Comparativa de Tiendas' })}
        </h3>
        <div className="flex items-center justify-center h-48 text-muted-foreground">
          <p>{t('common:comingSoon', { defaultValue: 'Próximamente' })}</p>
        </div>
      </GlassCard>
    </div>
  )
}

export default StoresAnalysis
