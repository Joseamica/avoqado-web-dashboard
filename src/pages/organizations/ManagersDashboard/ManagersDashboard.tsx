/**
 * ManagersDashboard - Organization-level Manager Oversight
 *
 * Displays:
 * - Manager selector dropdown with profile
 * - Summary metrics (active managers, efficiency, stores, audits)
 * - Charts (compliance, team health, quality trends)
 * - Store assignment table with performance
 *
 * Access: Organization level (/wl/organizations/:orgSlug/managers)
 */

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { GlassCard } from '@/components/ui/glass-card'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentOrganization } from '@/hooks/use-current-organization'
import { getManagerDashboard, getOrgManagers } from '@/services/organizationDashboard.service'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ClipboardCheck, Mail, Phone, Store, TrendingUp, User, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ComplianceChart, QualityTrendChart, StoreAssignmentTable, TeamHealthChart } from './components'

export function ManagersDashboard() {
  const { t } = useTranslation(['playtelecom', 'common'])
  const { orgId } = useCurrentOrganization()
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null)

  // Fetch managers list
  const { data: managersData, isLoading: isLoadingManagers } = useQuery({
    queryKey: ['organization', 'managers', orgId],
    queryFn: () => getOrgManagers(orgId!),
    enabled: !!orgId,
  })

  // Fetch selected manager's dashboard
  const { data: managerDashboard, isLoading: isLoadingDashboard } = useQuery({
    queryKey: ['organization', 'manager', orgId, selectedManagerId],
    queryFn: () => getManagerDashboard(orgId!, selectedManagerId!),
    enabled: !!orgId && !!selectedManagerId,
  })

  const managers = useMemo(() => managersData?.managers ?? [], [managersData?.managers])

  // Find selected manager from list
  const selectedManager = useMemo(() => {
    if (!selectedManagerId) return null
    return managers.find(m => m.id === selectedManagerId) || null
  }, [selectedManagerId, managers])

  // Summary stats calculated from managers list
  const summaryStats = useMemo(() => {
    const totalManagers = managers.length
    const activeManagers = managers.filter(m => m.activeStores > 0).length
    const totalStores = managers.reduce((acc, m) => acc + m.storeCount, 0)
    const totalSales = managers.reduce((acc, m) => acc + m.todaySales, 0)
    return { totalManagers, activeManagers, totalStores, totalSales }
  }, [managers])

  // Loading state
  if (isLoadingManagers) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-[280px]" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-80 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Manager Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('playtelecom:managers.title', { defaultValue: 'Gestión de Gerentes' })}</h1>
          <p className="text-muted-foreground">
            {t('playtelecom:managers.subtitle', { defaultValue: 'Supervisión y desempeño de gerentes regionales' })}
          </p>
        </div>

        {/* Manager Selector Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full sm:w-[280px] justify-between">
              {selectedManager ? (
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <span className="truncate">{selectedManager.name}</span>
                </div>
              ) : (
                <span className="text-muted-foreground">
                  {t('playtelecom:managers.selectManager', { defaultValue: 'Seleccionar gerente...' })}
                </span>
              )}
              <ChevronDown className="w-4 h-4 ml-2 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[280px]">
            <DropdownMenuItem onClick={() => setSelectedManagerId(null)}>
              <span className="text-muted-foreground">{t('playtelecom:managers.viewAll', { defaultValue: 'Ver todos los gerentes' })}</span>
            </DropdownMenuItem>
            {managers.map(manager => (
              <DropdownMenuItem key={manager.id} onClick={() => setSelectedManagerId(manager.id)} className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{manager.name}</p>
                  <p className="text-xs text-muted-foreground">{manager.storeCount} tiendas</p>
                </div>
                {manager.activeStores > 0 && <span className="w-2 h-2 rounded-full bg-green-500" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {t('playtelecom:managers.activeManagers', { defaultValue: 'Gerentes Activos' })}
              </p>
              <p className="text-2xl font-bold">{selectedManager ? '1' : `${summaryStats.activeManagers}/${summaryStats.totalManagers}`}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5">
              <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('playtelecom:managers.todaySales', { defaultValue: 'Ventas Hoy' })}</p>
              <p className="text-2xl font-bold">
                {selectedManager
                  ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(
                      selectedManager.todaySales,
                    )
                  : new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(
                      summaryStats.totalSales,
                    )}
              </p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5">
              <Store className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {t('playtelecom:managers.storesManaged', { defaultValue: 'Tiendas Gestionadas' })}
              </p>
              <p className="text-2xl font-bold">{selectedManager ? selectedManager.storeCount : summaryStats.totalStores}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-500/5">
              <ClipboardCheck className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('playtelecom:managers.activeStores', { defaultValue: 'Tiendas Activas' })}</p>
              <p className="text-2xl font-bold">{selectedManager ? selectedManager.activeStores : summaryStats.activeManagers}</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Selected Manager Profile Card */}
      {selectedManager && managerDashboard && (
        <GlassCard className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {managerDashboard.manager.photoUrl ? (
                <img
                  src={managerDashboard.manager.photoUrl}
                  alt={managerDashboard.manager.name}
                  className="w-16 h-16 rounded-full object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-8 h-8 text-primary" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold">{managerDashboard.manager.name}</h2>
                  <Badge variant={selectedManager.activeStores > 0 ? 'default' : 'secondary'}>
                    {selectedManager.activeStores > 0 ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
                <p className="text-muted-foreground">{selectedManager.storeCount} tiendas asignadas</p>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5" />
                    {managerDashboard.manager.email}
                  </span>
                  {managerDashboard.manager.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5" />
                      {managerDashboard.manager.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold">{managerDashboard.metrics.totalPromoters}</p>
                <p className="text-xs text-muted-foreground">Promotores</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {Math.round(managerDashboard.metrics.avgStorePerformance)}%
                </p>
                <p className="text-xs text-muted-foreground">Desempeño</p>
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Loading state for manager dashboard */}
      {selectedManager && isLoadingDashboard && (
        <GlassCard className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Skeleton className="w-16 h-16 rounded-full" />
              <div>
                <Skeleton className="h-6 w-48 mb-2" />
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-4 w-64" />
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <Skeleton className="h-8 w-12 mx-auto mb-1" />
                <Skeleton className="h-3 w-16" />
              </div>
              <div className="text-center">
                <Skeleton className="h-8 w-12 mx-auto mb-1" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ComplianceChart managerId={selectedManagerId} />
        <TeamHealthChart managerId={selectedManagerId} />
        <QualityTrendChart managerId={selectedManagerId} />
      </div>

      {/* Store Assignment Table */}
      <StoreAssignmentTable managerId={selectedManagerId} stores={managerDashboard?.stores} managers={managers} />
    </div>
  )
}

export default ManagersDashboard
