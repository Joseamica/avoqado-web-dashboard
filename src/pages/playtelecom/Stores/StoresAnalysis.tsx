/**
 * StoresAnalysis - Store Performance Dashboard
 *
 * Displays:
 * - Store comparison metrics
 * - Sales by store
 * - Inventory status per store
 * - Store rankings
 *
 * Access: MANAGER+ only
 */

import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { GlassCard } from '@/components/ui/glass-card'
import { Badge } from '@/components/ui/badge'
import { Store, TrendingUp, TrendingDown, Package, Users } from 'lucide-react'
import { useMemo } from 'react'

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
      {/* Store Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {MOCK_STORES.map((store, index) => (
          <GlassCard key={store.id} className="p-5" hover>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
                  <Store className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold">{store.name}</h3>
                  <p className="text-sm text-muted-foreground">{store.manager}</p>
                </div>
              </div>
              <Badge variant={index === 0 ? 'default' : 'outline'} className="text-xs">
                #{index + 1}
              </Badge>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {t('playtelecom:stores.todaySales', { defaultValue: 'Ventas Hoy' })}
                </span>
                <span className="font-semibold">{formatCurrency(store.todaySales)}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {t('playtelecom:stores.weekSales', { defaultValue: 'Ventas Semana' })}
                </span>
                <span className="font-medium">{formatCurrency(store.weekSales)}</span>
              </div>

              <div className="h-px bg-border/50" />

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{store.inventory} items</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{store.promoters} promotores</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-1 text-sm">
                {store.trend >= 0 ? (
                  <>
                    <TrendingUp className="w-4 h-4 text-green-500" />
                    <span className="text-green-600 dark:text-green-400">+{store.trend}%</span>
                  </>
                ) : (
                  <>
                    <TrendingDown className="w-4 h-4 text-red-500" />
                    <span className="text-red-600 dark:text-red-400">{store.trend}%</span>
                  </>
                )}
                <span className="text-muted-foreground">vs semana anterior</span>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Additional Analytics */}
      <GlassCard className="p-6">
        <h3 className="text-lg font-semibold mb-4">
          {t('playtelecom:stores.comparison', { defaultValue: 'Comparativa de Tiendas' })}
        </h3>
        <div className="flex items-center justify-center h-48 text-muted-foreground">
          <p>{t('common:comingSoon', { defaultValue: 'Gráfica comparativa próximamente...' })}</p>
        </div>
      </GlassCard>
    </div>
  )
}

export default StoresAnalysis
