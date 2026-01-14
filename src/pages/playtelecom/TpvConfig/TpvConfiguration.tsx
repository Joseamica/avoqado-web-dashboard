/**
 * TpvConfiguration - TPV Category Configuration
 *
 * Displays:
 * - Item category management for serialized products
 * - Price configuration
 * - Commission settings per category
 * - TPV button layout
 *
 * Access: ADMIN+ only
 */

import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { GlassCard } from '@/components/ui/glass-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Settings, Plus, Package, DollarSign, Percent, Pencil, Trash2 } from 'lucide-react'
import { useMemo } from 'react'

// Placeholder data - will be replaced with real API calls
const MOCK_CATEGORIES = [
  {
    id: '1',
    name: 'Chip Telcel Negra',
    sku: 'CHIP-NEG-001',
    price: 150.00,
    cost: 100.00,
    commission: 10.00,
    isActive: true,
    color: '#1a1a1a',
  },
  {
    id: '2',
    name: 'Chip Telcel Blanca',
    sku: 'CHIP-BLA-001',
    price: 120.00,
    cost: 80.00,
    commission: 8.00,
    isActive: true,
    color: '#ffffff',
  },
  {
    id: '3',
    name: 'Chip Telcel Roja',
    sku: 'CHIP-ROJ-001',
    price: 180.00,
    cost: 120.00,
    commission: 12.00,
    isActive: true,
    color: '#ef4444',
  },
  {
    id: '4',
    name: 'Recarga Telcel $50',
    sku: 'REC-050',
    price: 50.00,
    cost: 47.50,
    commission: 2.50,
    isActive: true,
    color: '#3b82f6',
  },
  {
    id: '5',
    name: 'Recarga Telcel $100',
    sku: 'REC-100',
    price: 100.00,
    cost: 95.00,
    commission: 5.00,
    isActive: true,
    color: '#3b82f6',
  },
  {
    id: '6',
    name: 'Recarga Telcel $200',
    sku: 'REC-200',
    price: 200.00,
    cost: 190.00,
    commission: 10.00,
    isActive: false,
    color: '#3b82f6',
  },
]

export function TpvConfiguration() {
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

  // Calculate totals
  const stats = useMemo(() => ({
    totalCategories: MOCK_CATEGORIES.length,
    activeCategories: MOCK_CATEGORIES.filter(c => c.isActive).length,
    avgMargin: MOCK_CATEGORIES.reduce((acc, c) => acc + ((c.price - c.cost) / c.price * 100), 0) / MOCK_CATEGORIES.length,
  }), [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-500/5">
            <Settings className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">
              {t('playtelecom:tpvConfig.title', { defaultValue: 'Configuración TPV' })}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t('playtelecom:tpvConfig.subtitle', { defaultValue: 'Administra categorías y precios' })}
            </p>
          </div>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          {t('playtelecom:tpvConfig.addCategory', { defaultValue: 'Nueva Categoría' })}
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
              <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {t('playtelecom:tpvConfig.totalCategories', { defaultValue: 'Total Categorías' })}
              </p>
              <p className="text-xl font-semibold">{stats.totalCategories}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5">
              <Package className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {t('playtelecom:tpvConfig.activeCategories', { defaultValue: 'Categorías Activas' })}
              </p>
              <p className="text-xl font-semibold">{stats.activeCategories}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5">
              <Percent className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {t('playtelecom:tpvConfig.avgMargin', { defaultValue: 'Margen Promedio' })}
              </p>
              <p className="text-xl font-semibold">{stats.avgMargin.toFixed(1)}%</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Categories Table */}
      <GlassCard className="p-6">
        <h3 className="text-lg font-semibold mb-4">
          {t('playtelecom:tpvConfig.categories', { defaultValue: 'Categorías de Productos' })}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">
                  {t('playtelecom:tpvConfig.category', { defaultValue: 'Categoría' })}
                </th>
                <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">SKU</th>
                <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">
                  {t('playtelecom:tpvConfig.price', { defaultValue: 'Precio' })}
                </th>
                <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">
                  {t('playtelecom:tpvConfig.cost', { defaultValue: 'Costo' })}
                </th>
                <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">
                  {t('playtelecom:tpvConfig.margin', { defaultValue: 'Margen' })}
                </th>
                <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">
                  {t('playtelecom:tpvConfig.commission', { defaultValue: 'Comisión' })}
                </th>
                <th className="text-center py-3 px-2 text-sm font-medium text-muted-foreground">
                  {t('playtelecom:tpvConfig.status', { defaultValue: 'Estado' })}
                </th>
                <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">
                  {t('playtelecom:tpvConfig.actions', { defaultValue: 'Acciones' })}
                </th>
              </tr>
            </thead>
            <tbody>
              {MOCK_CATEGORIES.map(category => {
                const margin = ((category.price - category.cost) / category.price * 100).toFixed(1)
                return (
                  <tr key={category.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full border border-border"
                          style={{ backgroundColor: category.color }}
                        />
                        <span className="font-medium">{category.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <code className="text-xs bg-muted/50 px-2 py-1 rounded">{category.sku}</code>
                    </td>
                    <td className="py-3 px-2 text-right font-medium">
                      {formatCurrency(category.price)}
                    </td>
                    <td className="py-3 px-2 text-right text-muted-foreground">
                      {formatCurrency(category.cost)}
                    </td>
                    <td className="py-3 px-2 text-right">
                      <span className="text-green-600 dark:text-green-400">{margin}%</span>
                    </td>
                    <td className="py-3 px-2 text-right text-muted-foreground">
                      {formatCurrency(category.commission)}
                    </td>
                    <td className="py-3 px-2 text-center">
                      <Badge variant={category.isActive ? 'default' : 'secondary'}>
                        {category.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* TPV Preview */}
      <GlassCard className="p-6">
        <h3 className="text-lg font-semibold mb-4">
          {t('playtelecom:tpvConfig.preview', { defaultValue: 'Vista Previa TPV' })}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {MOCK_CATEGORIES.filter(c => c.isActive).map(category => (
            <button
              key={category.id}
              className="p-4 rounded-xl border border-border/50 bg-card hover:bg-muted/50 transition-colors text-left"
              style={{ borderLeftColor: category.color, borderLeftWidth: 4 }}
            >
              <p className="font-medium text-sm truncate">{category.name}</p>
              <p className="text-lg font-bold mt-1">{formatCurrency(category.price)}</p>
            </button>
          ))}
        </div>
      </GlassCard>
    </div>
  )
}

export default TpvConfiguration
