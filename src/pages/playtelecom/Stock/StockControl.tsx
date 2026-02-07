/**
 * StockControl - Serialized Inventory Management
 *
 * Displays:
 * - Summary cards by category (Chip Negra, Blanca, Roja, Recargas)
 * - Stock vs Sales chart with coverage estimation
 * - Low stock alerts with action buttons
 * - Filterable table of serialized items with serial numbers
 * - Bulk CSV upload for inventory
 * - Status indicators (available, sold, assigned)
 * - Batch management
 *
 * Based on mockup: inventario.html
 */

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { GlassCard } from '@/components/ui/glass-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Package, Box, CheckCircle2, Plus, Upload, Settings2 } from 'lucide-react'
import { StockVsSalesChart, LowStockAlerts, CategoryManagement, BulkUploadDialog } from './components'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useAuth } from '@/context/AuthContext'
import {
  getStockMetrics,
  getCategoryStock,
  getStockMovements,
  type StockMovement,
} from '@/services/stockDashboard.service'

// Map API status to UI status
type UIStatus = 'available' | 'sold' | 'assigned'

const mapMovementTypeToStatus = (type: StockMovement['type']): UIStatus => {
  switch (type) {
    case 'SOLD':
      return 'sold'
    case 'REGISTERED':
      return 'available'
    case 'RETURNED':
      return 'available'
    case 'DAMAGED':
      return 'sold' // Consider damaged as not available
    default:
      return 'available'
  }
}

const STATUS_CONFIG = {
  available: { label: 'Disponible', variant: 'default' as const, className: 'bg-green-500/10 text-green-600 border-green-500/20', icon: CheckCircle2 },
  sold: { label: 'Vendido', variant: 'secondary' as const, className: '', icon: Package },
  assigned: { label: 'Asignado', variant: 'outline' as const, className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20', icon: Box },
} as const

export function StockControl() {
  const { t } = useTranslation(['playtelecom', 'common'])
  const { venueId, venue: _venue } = useCurrentVenue()
  const { activeVenue } = useAuth()
  const venueTimezone = activeVenue?.timezone || 'America/Mexico_City'
  const _queryClient = useQueryClient()

  // Dialog state
  const [showCategoryManagement, setShowCategoryManagement] = useState(false)
  const [showBulkUpload, setShowBulkUpload] = useState(false)

  // Fetch stock metrics
  const { data: metricsData, isLoading: isLoadingMetrics } = useQuery({
    queryKey: ['stock', 'metrics', venueId],
    queryFn: () => getStockMetrics(venueId!),
    enabled: !!venueId,
  })

  // Fetch category stock
  const { data: categoryData, isLoading: isLoadingCategories } = useQuery({
    queryKey: ['stock', 'categories', venueId],
    queryFn: () => getCategoryStock(venueId!),
    enabled: !!venueId,
  })

  // Fetch recent movements for the table
  const { data: movementsData, isLoading: isLoadingMovements } = useQuery({
    queryKey: ['stock', 'movements', venueId],
    queryFn: () => getStockMovements(venueId!, { limit: 20 }),
    enabled: !!venueId,
  })

  const isLoading = isLoadingMetrics || isLoadingCategories || isLoadingMovements
  const categories = categoryData?.categories || []
  const movements = movementsData?.movements || []

  // Calculate totals from metrics
  const totals = useMemo(() => ({
    available: metricsData?.availablePieces || 0,
    sold: metricsData?.soldToday || 0,
    total: metricsData?.totalPieces || 0,
  }), [metricsData])

  // Handle stock request from low stock alerts
  const handleRequestStock = (productId: string) => {
    console.log('Requesting stock for product:', productId)
    // TODO: Implement stock request API
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-20 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold">
            {t('playtelecom:stock.title', { defaultValue: 'Control de Inventario' })}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('playtelecom:stock.subtitle', { defaultValue: 'Gestiona categorías y números de serie' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowCategoryManagement(true)}>
            <Settings2 className="w-4 h-4 mr-2" />
            {t('playtelecom:stock.manageCategories', { defaultValue: 'Configurar Categorías' })}
          </Button>
          <Button onClick={() => setShowBulkUpload(true)}>
            <Upload className="w-4 h-4 mr-2" />
            {t('playtelecom:stock.uploadItems', { defaultValue: 'Cargar Items' })}
          </Button>
        </div>
      </div>

      {/* Category Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {categories.length > 0 ? (
          categories.slice(0, 4).map(category => (
            <GlassCard key={category.id} className="p-4" hover>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-sm">{category.name}</h3>
                <Package className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('playtelecom:stock.available', { defaultValue: 'Disponible' })}</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">{category.available}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('playtelecom:stock.sold7d', { defaultValue: 'Vendidos 7d' })}</span>
                  <span className="font-medium">{category.sold7d}</span>
                </div>
                <div className="h-px bg-border/50" />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('playtelecom:stock.coverage', { defaultValue: 'Cobertura' })}</span>
                  <span className={`font-bold ${
                    (category.coverage || 0) < 7
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-green-600 dark:text-green-400'
                  }`}>
                    {category.coverage !== null ? `${category.coverage} días` : '-'}
                  </span>
                </div>
              </div>
            </GlassCard>
          ))
        ) : (
          <GlassCard className="col-span-full p-8 text-center">
            <Package className="w-10 h-10 mx-auto mb-2 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground mb-4">
              {t('playtelecom:stock.noCategories', { defaultValue: 'No hay categorías de stock configuradas' })}
            </p>
            <Button onClick={() => setShowCategoryManagement(true)}>
              <Plus className="w-4 h-4 mr-2" />
              {t('playtelecom:stock.createFirstCategory', { defaultValue: 'Crear Primera Categoría' })}
            </Button>
          </GlassCard>
        )}
      </div>

      {/* Summary Bar */}
      <GlassCard className="p-4">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5">
              <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('playtelecom:stock.totalAvailable', { defaultValue: 'Total Disponible' })}</p>
              <p className="text-lg font-semibold">{totals.available}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
              <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('playtelecom:stock.soldToday', { defaultValue: 'Vendido Hoy' })}</p>
              <p className="text-lg font-semibold">{totals.sold}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5">
              <Box className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('playtelecom:stock.totalInventory', { defaultValue: 'Inventario Total' })}</p>
              <p className="text-lg font-semibold">{totals.total}</p>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Stock vs Sales Chart & Low Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StockVsSalesChart />
        <LowStockAlerts onRequestStock={handleRequestStock} />
      </div>

      {/* Recent Movements Table */}
      <GlassCard className="p-6">
        <h3 className="text-lg font-semibold mb-4">
          {t('playtelecom:stock.recentMovements', { defaultValue: 'Movimientos Recientes' })}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">
                  {t('playtelecom:stock.serial', { defaultValue: 'Número de Serie' })}
                </th>
                <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">
                  {t('playtelecom:stock.category', { defaultValue: 'Categoría' })}
                </th>
                <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">
                  {t('playtelecom:stock.type', { defaultValue: 'Tipo' })}
                </th>
                <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">
                  {t('playtelecom:stock.timestamp', { defaultValue: 'Fecha' })}
                </th>
              </tr>
            </thead>
            <tbody>
              {movements.length > 0 ? (
                movements.map(movement => {
                  const status = mapMovementTypeToStatus(movement.type)
                  const statusConfig = STATUS_CONFIG[status]
                  return (
                    <tr key={movement.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-2">
                        <code className="text-xs bg-muted/50 px-2 py-1 rounded">{movement.serialNumber}</code>
                      </td>
                      <td className="py-3 px-2 text-sm">{movement.categoryName}</td>
                      <td className="py-3 px-2">
                        <Badge variant={statusConfig.variant} className={`text-xs ${statusConfig.className}`}>
                          {movement.type}
                        </Badge>
                      </td>
                      <td className="py-3 px-2 text-sm text-muted-foreground">
                        {new Date(movement.timestamp).toLocaleString('es-MX', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                          timeZone: venueTimezone,
                        })}
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-muted-foreground">
                    {t('playtelecom:stock.noMovements', { defaultValue: 'No hay movimientos recientes' })}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Category Management Dialog */}
      <CategoryManagement
        open={showCategoryManagement}
        onOpenChange={setShowCategoryManagement}
      />

      {/* Bulk Upload Dialog */}
      <BulkUploadDialog
        open={showBulkUpload}
        onOpenChange={setShowBulkUpload}
      />
    </div>
  )
}

export default StockControl
