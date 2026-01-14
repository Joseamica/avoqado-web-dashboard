/**
 * StockControl - Serialized Inventory Management
 *
 * Displays:
 * - Summary cards by category (Chip Negra, Blanca, Roja, Recargas)
 * - Filterable table of serialized items with serial numbers
 * - Status indicators (available, sold, assigned)
 * - Batch management
 *
 * Based on mockup: inventario.html
 */

import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { GlassCard } from '@/components/ui/glass-card'
import { Badge } from '@/components/ui/badge'
import { Package, Box, CheckCircle2, XCircle } from 'lucide-react'
import { useMemo } from 'react'

// Placeholder data - will be replaced with real API calls
const MOCK_CATEGORIES = [
  { id: '1', name: 'Chip Telcel Negra', available: 120, sold: 45, total: 165 },
  { id: '2', name: 'Chip Telcel Blanca', available: 85, sold: 38, total: 123 },
  { id: '3', name: 'Chip Telcel Roja', available: 67, sold: 28, total: 95 },
  { id: '4', name: 'Recarga Telcel', available: 200, sold: 16, total: 216 },
]

const MOCK_ITEMS = [
  { id: '1', serial: '8952140063000001234', category: 'Chip Telcel Negra', status: 'available', assignedTo: null, batchId: 'BATCH-001' },
  { id: '2', serial: '8952140063000001235', category: 'Chip Telcel Negra', status: 'sold', assignedTo: 'Juan Pérez', batchId: 'BATCH-001' },
  { id: '3', serial: '8952140063000005678', category: 'Chip Telcel Blanca', status: 'assigned', assignedTo: 'María García', batchId: 'BATCH-002' },
  { id: '4', serial: '8952140063000005679', category: 'Chip Telcel Blanca', status: 'available', assignedTo: null, batchId: 'BATCH-002' },
  { id: '5', serial: '8952140063000009012', category: 'Chip Telcel Roja', status: 'available', assignedTo: null, batchId: 'BATCH-003' },
]

const STATUS_CONFIG = {
  available: { label: 'Disponible', variant: 'default' as const, className: 'bg-green-500/10 text-green-600 border-green-500/20', icon: CheckCircle2 },
  sold: { label: 'Vendido', variant: 'secondary' as const, className: '', icon: Package },
  assigned: { label: 'Asignado', variant: 'outline' as const, className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20', icon: Box },
} as const

export function StockControl() {
  const { t } = useTranslation(['playtelecom', 'common'])
  const { activeVenue } = useAuth()

  // Calculate totals
  const totals = useMemo(() => {
    return MOCK_CATEGORIES.reduce(
      (acc, cat) => ({
        available: acc.available + cat.available,
        sold: acc.sold + cat.sold,
        total: acc.total + cat.total,
      }),
      { available: 0, sold: 0, total: 0 }
    )
  }, [])

  return (
    <div className="space-y-6">
      {/* Category Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {MOCK_CATEGORIES.map(category => (
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
                <span className="text-muted-foreground">{t('playtelecom:stock.sold', { defaultValue: 'Vendidos' })}</span>
                <span className="font-medium">{category.sold}</span>
              </div>
              <div className="h-px bg-border/50" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('playtelecom:stock.total', { defaultValue: 'Total' })}</span>
                <span className="font-bold">{category.total}</span>
              </div>
            </div>
          </GlassCard>
        ))}
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
              <p className="text-xs text-muted-foreground">{t('playtelecom:stock.totalSold', { defaultValue: 'Total Vendido' })}</p>
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

      {/* Inventory Table */}
      <GlassCard className="p-6">
        <h3 className="text-lg font-semibold mb-4">
          {t('playtelecom:stock.inventoryList', { defaultValue: 'Lista de Inventario' })}
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
                  {t('playtelecom:stock.status', { defaultValue: 'Estado' })}
                </th>
                <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">
                  {t('playtelecom:stock.assignedTo', { defaultValue: 'Asignado a' })}
                </th>
                <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">
                  {t('playtelecom:stock.batch', { defaultValue: 'Lote' })}
                </th>
              </tr>
            </thead>
            <tbody>
              {MOCK_ITEMS.map(item => {
                const statusConfig = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG]
                return (
                  <tr key={item.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-2">
                      <code className="text-xs bg-muted/50 px-2 py-1 rounded">{item.serial}</code>
                    </td>
                    <td className="py-3 px-2 text-sm">{item.category}</td>
                    <td className="py-3 px-2">
                      <Badge variant={statusConfig.variant} className={`text-xs ${statusConfig.className}`}>
                        {statusConfig.label}
                      </Badge>
                    </td>
                    <td className="py-3 px-2 text-sm text-muted-foreground">
                      {item.assignedTo || '-'}
                    </td>
                    <td className="py-3 px-2 text-sm text-muted-foreground">{item.batchId}</td>
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

export default StockControl
