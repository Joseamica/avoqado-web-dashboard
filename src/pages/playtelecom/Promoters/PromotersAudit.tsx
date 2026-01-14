/**
 * PromotersAudit - Promoter Performance & Audit
 *
 * Displays:
 * - Individual promoter sales metrics
 * - Assigned inventory status
 * - Commission tracking
 * - Audit trail
 *
 * Access: MANAGER+ only
 */

import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { GlassCard } from '@/components/ui/glass-card'
import { Badge } from '@/components/ui/badge'
import { User, Package, DollarSign, Clock, TrendingUp, Store } from 'lucide-react'
import { useMemo } from 'react'

// Placeholder data - will be replaced with real API calls
const MOCK_PROMOTERS = [
  {
    id: '1',
    name: 'Juan Pérez',
    store: 'Plaza Centro',
    manager: 'Roberto Sánchez',
    todaySales: 2450.00,
    weekSales: 12250.00,
    assignedInventory: 25,
    soldToday: 7,
    commission: 856.00,
    status: 'active',
    lastActivity: '2024-01-15T14:30:00Z',
  },
  {
    id: '2',
    name: 'María García',
    store: 'Sucursal Norte',
    manager: 'Ana Martínez',
    todaySales: 1820.00,
    weekSales: 9800.00,
    assignedInventory: 20,
    soldToday: 5,
    commission: 686.00,
    status: 'active',
    lastActivity: '2024-01-15T14:15:00Z',
  },
  {
    id: '3',
    name: 'Carlos López',
    store: 'Plaza Centro',
    manager: 'Roberto Sánchez',
    todaySales: 1560.00,
    weekSales: 8450.00,
    assignedInventory: 18,
    soldToday: 4,
    commission: 591.00,
    status: 'break',
    lastActivity: '2024-01-15T12:45:00Z',
  },
  {
    id: '4',
    name: 'Ana Rodríguez',
    store: 'Sucursal Sur',
    manager: 'Carlos López',
    todaySales: 980.00,
    weekSales: 5200.00,
    assignedInventory: 15,
    soldToday: 3,
    commission: 364.00,
    status: 'inactive',
    lastActivity: '2024-01-14T18:00:00Z',
  },
]

const STATUS_CONFIG = {
  active: { label: 'Activo', variant: 'default' as const },
  break: { label: 'En Descanso', variant: 'secondary' as const },
  inactive: { label: 'Inactivo', variant: 'outline' as const },
}

export function PromotersAudit() {
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

  // Format time ago
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 60) return `hace ${diffMins} min`
    if (diffMins < 1440) return `hace ${Math.floor(diffMins / 60)} hrs`
    return `hace ${Math.floor(diffMins / 1440)} días`
  }

  // Summary stats
  const stats = useMemo(() => ({
    totalPromoters: MOCK_PROMOTERS.length,
    activePromoters: MOCK_PROMOTERS.filter(p => p.status === 'active').length,
    totalTodaySales: MOCK_PROMOTERS.reduce((acc, p) => acc + p.todaySales, 0),
    totalCommissions: MOCK_PROMOTERS.reduce((acc, p) => acc + p.commission, 0),
  }), [])

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
              <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {t('playtelecom:promoters.total', { defaultValue: 'Total Promotores' })}
              </p>
              <p className="text-xl font-semibold">{stats.totalPromoters}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5">
              <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {t('playtelecom:promoters.active', { defaultValue: 'Activos Ahora' })}
              </p>
              <p className="text-xl font-semibold">{stats.activePromoters}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5">
              <DollarSign className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {t('playtelecom:promoters.todaySales', { defaultValue: 'Ventas Hoy' })}
              </p>
              <p className="text-xl font-semibold">{formatCurrency(stats.totalTodaySales)}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-500/5">
              <DollarSign className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {t('playtelecom:promoters.commissions', { defaultValue: 'Comisiones' })}
              </p>
              <p className="text-xl font-semibold">{formatCurrency(stats.totalCommissions)}</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Promoters List */}
      <GlassCard className="p-6">
        <h3 className="text-lg font-semibold mb-4">
          {t('playtelecom:promoters.list', { defaultValue: 'Lista de Promotores' })}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">
                  {t('playtelecom:promoters.name', { defaultValue: 'Promotor' })}
                </th>
                <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">
                  {t('playtelecom:promoters.store', { defaultValue: 'Tienda' })}
                </th>
                <th className="text-center py-3 px-2 text-sm font-medium text-muted-foreground">
                  {t('playtelecom:promoters.inventory', { defaultValue: 'Inventario' })}
                </th>
                <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">
                  {t('playtelecom:promoters.sales', { defaultValue: 'Ventas Hoy' })}
                </th>
                <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">
                  {t('playtelecom:promoters.commission', { defaultValue: 'Comisión' })}
                </th>
                <th className="text-center py-3 px-2 text-sm font-medium text-muted-foreground">
                  {t('playtelecom:promoters.status', { defaultValue: 'Estado' })}
                </th>
                <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">
                  {t('playtelecom:promoters.lastActivity', { defaultValue: 'Última Actividad' })}
                </th>
              </tr>
            </thead>
            <tbody>
              {MOCK_PROMOTERS.map(promoter => {
                const statusConfig = STATUS_CONFIG[promoter.status as keyof typeof STATUS_CONFIG]
                return (
                  <tr key={promoter.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{promoter.name}</p>
                          <p className="text-xs text-muted-foreground">{promoter.manager}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-1 text-sm">
                        <Store className="w-3.5 h-3.5 text-muted-foreground" />
                        {promoter.store}
                      </div>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Package className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{promoter.assignedInventory}</span>
                        <span className="text-xs text-muted-foreground">({promoter.soldToday} vendidos)</span>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-right font-medium text-green-600 dark:text-green-400">
                      {formatCurrency(promoter.todaySales)}
                    </td>
                    <td className="py-3 px-2 text-right text-sm">
                      {formatCurrency(promoter.commission)}
                    </td>
                    <td className="py-3 px-2 text-center">
                      <Badge variant={statusConfig.variant} className="text-xs">
                        {statusConfig.label}
                      </Badge>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {formatTimeAgo(promoter.lastActivity)}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  )
}

export default PromotersAudit
