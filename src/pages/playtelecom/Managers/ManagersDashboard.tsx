/**
 * ManagersDashboard - Manager Performance Oversight
 *
 * Displays:
 * - Manager performance metrics
 * - Stores under management
 * - Team productivity
 * - Goal tracking
 *
 * Access: ADMIN+ only
 */

import { Badge } from '@/components/ui/badge'
import { GlassCard } from '@/components/ui/glass-card'
import { useAuth } from '@/context/AuthContext'
import { Store, Target, UserCog } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

// Placeholder data - will be replaced with real API calls
const MOCK_MANAGERS = [
  {
    id: '1',
    name: 'Roberto Sánchez',
    stores: ['Plaza Centro', 'Sucursal Este'],
    promoters: 8,
    monthlySales: 125000.0,
    target: 150000.0,
    achievement: 83.3,
  },
  {
    id: '2',
    name: 'Ana Martínez',
    stores: ['Sucursal Norte'],
    promoters: 4,
    monthlySales: 68000.0,
    target: 75000.0,
    achievement: 90.7,
  },
  {
    id: '3',
    name: 'Carlos López',
    stores: ['Sucursal Sur', 'Kiosko Mall'],
    promoters: 6,
    monthlySales: 95000.0,
    target: 100000.0,
    achievement: 95.0,
  },
]

export function ManagersDashboard() {
  const { t } = useTranslation(['playtelecom', 'common'])
  const { activeVenue } = useAuth()

  // Format currency
  const formatCurrency = useMemo(
    () => (value: number) =>
      new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: activeVenue?.currency || 'MXN',
        minimumFractionDigits: 0,
      }).format(value),
    [activeVenue?.currency],
  )

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5">
              <UserCog className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {t('playtelecom:managers.totalManagers', { defaultValue: 'Gerentes Activos' })}
              </p>
              <p className="text-2xl font-semibold">{MOCK_MANAGERS.length}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
              <Store className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {t('playtelecom:managers.totalStores', { defaultValue: 'Tiendas Supervisadas' })}
              </p>
              <p className="text-2xl font-semibold">{MOCK_MANAGERS.reduce((acc, m) => acc + m.stores.length, 0)}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5">
              <Target className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {t('playtelecom:managers.avgAchievement', { defaultValue: 'Cumplimiento Promedio' })}
              </p>
              <p className="text-2xl font-semibold">
                {(MOCK_MANAGERS.reduce((acc, m) => acc + m.achievement, 0) / MOCK_MANAGERS.length).toFixed(1)}%
              </p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Managers List */}
      <GlassCard className="p-6">
        <h3 className="text-lg font-semibold mb-4">{t('playtelecom:managers.performance', { defaultValue: 'Rendimiento de Gerentes' })}</h3>
        <div className="space-y-4">
          {MOCK_MANAGERS.map(manager => (
            <div key={manager.id} className="p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <UserCog className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium">{manager.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {manager.stores.length} tiendas · {manager.promoters} promotores
                    </p>
                  </div>
                </div>
                <Badge variant={manager.achievement >= 90 ? 'default' : manager.achievement >= 75 ? 'secondary' : 'outline'}>
                  {manager.achievement.toFixed(1)}%
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t('playtelecom:managers.monthlySales', { defaultValue: 'Ventas del Mes' })}
                  </span>
                  <span className="font-medium">{formatCurrency(manager.monthlySales)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('playtelecom:managers.target', { defaultValue: 'Meta' })}</span>
                  <span className="text-muted-foreground">{formatCurrency(manager.target)}</span>
                </div>
                <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(manager.achievement, 100)}%` }}
                  />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1">
                {manager.stores.map(store => (
                  <Badge key={store} variant="outline" className="text-xs">
                    {store}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  )
}

export default ManagersDashboard
