/**
 * StoreAssignmentTable - Table showing stores assigned to managers
 */

import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '@/components/ui/glass-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Store, Users, Star, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ManagerInfo, ManagerDashboard } from '@/services/organizationDashboard.service'

// Store data from the manager dashboard API
type ManagerStore = ManagerDashboard['stores'][number]

interface StoreAssignmentTableProps {
  managerId?: string | null
  stores?: ManagerStore[]
  managers?: ManagerInfo[]
  className?: string
}

// Format currency
const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
  }).format(value)

// Star rating component
const _StarRating: React.FC<{ rating: number }> = ({ rating }) => {
  const fullStars = Math.floor(rating)
  const hasHalfStar = rating % 1 >= 0.5

  return (
    <div className="flex items-center gap-0.5">
      {[...Array(5)].map((_, i) => (
        <Star
          key={i}
          className={cn(
            'w-3.5 h-3.5',
            i < fullStars
              ? 'text-yellow-500 fill-yellow-500'
              : i === fullStars && hasHalfStar
                ? 'text-yellow-500 fill-yellow-500/50'
                : 'text-muted-foreground/30',
          )}
        />
      ))}
      <span className="ml-1 text-sm font-medium">{rating.toFixed(1)}</span>
    </div>
  )
}

export const StoreAssignmentTable: React.FC<StoreAssignmentTableProps> = ({ managerId, stores, managers: _managers, className }) => {
  const { t } = useTranslation(['playtelecom', 'common'])

  // Display stores from API when available, or show placeholder
  const displayStores = useMemo(() => {
    if (managerId && stores) {
      // When a manager is selected, show their stores from the API
      return stores.map(store => ({
        id: store.id,
        name: store.name,
        managerId: managerId,
        managerName: '', // Not needed when manager is selected
        promoters: store.totalPromoters,
        monthlySales: store.weekSales, // Use week sales as monthly approximation
        performance: store.performance,
        activePromoters: store.activePromoters,
      }))
    }
    // When no manager is selected, we don't have aggregate store data
    // The API would need to be extended to support this case
    return []
  }, [managerId, stores])

  return (
    <GlassCard className={cn('p-6', className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Store className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold">{t('playtelecom:managers.storeAssignments', { defaultValue: 'Tiendas Asignadas' })}</h3>
        </div>
        <Badge variant="secondary">
          {displayStores.length} {displayStores.length === 1 ? 'tienda' : 'tiendas'}
        </Badge>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">
                {t('playtelecom:managers.store', { defaultValue: 'Tienda' })}
              </th>
              <th className="text-center py-3 px-2 text-sm font-medium text-muted-foreground">
                <Users className="w-4 h-4 inline-block" />
              </th>
              <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">
                {t('playtelecom:managers.weeklySales', { defaultValue: 'Venta Semana' })}
              </th>
              <th className="text-center py-3 px-2 text-sm font-medium text-muted-foreground">
                {t('playtelecom:managers.performance', { defaultValue: 'Desempeño' })}
              </th>
              <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">
                {t('common:actions', { defaultValue: 'Acciones' })}
              </th>
            </tr>
          </thead>
          <tbody>
            {displayStores.map(store => (
              <tr key={store.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                <td className="py-4 px-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Store className="w-4 h-4 text-primary" />
                    </div>
                    <span className="font-medium">{store.name}</span>
                  </div>
                </td>
                <td className="py-4 px-2 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {store.activePromoters}/{store.promoters}
                    </span>
                  </div>
                </td>
                <td className="py-4 px-2 text-right">
                  <span className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(store.monthlySales)}</span>
                </td>
                <td className="py-4 px-2 text-center">
                  <Badge
                    variant="outline"
                    className={cn(
                      store.performance >= 90
                        ? 'bg-green-500/10 text-green-600 border-green-500/20'
                        : store.performance >= 70
                          ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
                          : 'bg-red-500/10 text-red-600 border-red-500/20',
                    )}
                  >
                    {store.performance}%
                  </Badge>
                </td>
                <td className="py-4 px-2 text-right">
                  <Button variant="ghost" size="sm" className="h-8">
                    <ExternalLink className="w-3.5 h-3.5 mr-1" />
                    Ver
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {displayStores.length === 0 && !managerId && (
        <div className="text-center py-8 text-muted-foreground">
          <Store className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">
            {t('playtelecom:managers.selectManagerToSeeStores', { defaultValue: 'Selecciona un gerente para ver sus tiendas' })}
          </p>
        </div>
      )}

      {displayStores.length === 0 && managerId && (
        <div className="text-center py-8 text-muted-foreground">
          <Store className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">{t('playtelecom:managers.noStores', { defaultValue: 'No hay tiendas asignadas' })}</p>
        </div>
      )}
    </GlassCard>
  )
}

export default StoreAssignmentTable
