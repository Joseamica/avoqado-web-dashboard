/**
 * @temporary
 * @pending-implementation
 * Serialized Inventory Sales Demo
 *
 * STATUS: Demo page for PlayTelecom SIM sales visualization.
 * TODO: Delete this file when the final implementation is complete.
 * This is connected to real backend data but will be replaced with
 * a production-ready implementation.
 */

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import {
  Package,
  TrendingUp,
  DollarSign,
  Clock,
  Search,
  Download,
  RefreshCw,
  Smartphone,
  ChevronRight,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import {
  getSerializedInventorySummary,
  getRecentSales,
  type SerializedInventorySummary,
  type RecentSalesResponse,
} from '@/services/serializedInventory.service'

function formatTimeAgo(dateString: string | null): string {
  if (!dateString) return '-'
  const date = new Date(dateString)
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return `Hace ${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `Hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Hace ${hours}h`
  const days = Math.floor(hours / 24)
  return `Hace ${days}d`
}

function Currency(amount: number | null): string {
  if (amount === null || amount === undefined) return '-'
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// Glassmorphism Card component
function GlassCard({
  children,
  className,
  hover = false,
}: {
  children: React.ReactNode
  className?: string
  hover?: boolean
}) {
  return (
    <div
      className={cn(
        'relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm',
        'shadow-sm transition-all duration-300',
        hover && 'cursor-pointer hover:shadow-md hover:border-border hover:bg-card/90 hover:-translate-y-0.5',
        className
      )}
    >
      {children}
    </div>
  )
}

// Animated status pulse
function StatusPulse({ status }: { status: 'success' | 'warning' | 'error' | 'neutral' }) {
  const colors = {
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500',
    neutral: 'bg-gray-400',
  }
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', colors[status])} />
      <span className={cn('relative inline-flex rounded-full h-2.5 w-2.5', colors[status])} />
    </span>
  )
}

// Loading skeleton
function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6 p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-32 bg-muted rounded-2xl" />
        ))}
      </div>
      <div className="h-64 bg-muted rounded-2xl" />
      <div className="h-48 bg-muted rounded-2xl" />
    </div>
  )
}

// Error state
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="p-4 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
        <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
      </div>
      <h3 className="text-lg font-semibold mb-2">Error al cargar datos</h3>
      <p className="text-sm text-muted-foreground text-center mb-4">{message}</p>
      <Button onClick={onRetry} variant="outline">
        <RefreshCw className="w-4 h-4 mr-2" />
        Reintentar
      </Button>
    </div>
  )
}

export default function SerializedSalesDemo() {
  const { t } = useTranslation()
  const { venueId } = useCurrentVenue()
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState('today')

  // @temporary - Fetch summary data from backend
  const {
    data: summaryData,
    isLoading: isLoadingSummary,
    error: summaryError,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ['serialized-inventory', 'summary', venueId],
    queryFn: () => getSerializedInventorySummary(venueId),
    enabled: !!venueId,
    staleTime: 30000, // 30 seconds
  })

  // @temporary - Fetch recent sales from backend
  const {
    data: recentSalesData,
    isLoading: isLoadingSales,
    error: salesError,
    refetch: refetchSales,
  } = useQuery({
    queryKey: ['serialized-inventory', 'recent-sales', venueId],
    queryFn: () => getRecentSales(venueId, 10),
    enabled: !!venueId,
    staleTime: 15000, // 15 seconds
  })

  const isLoading = isLoadingSummary || isLoadingSales
  const error = summaryError || salesError

  // Calculate totals from real data
  const totals = useMemo(() => {
    if (!summaryData) {
      return { totalStock: 0, totalSold: 0, totalRevenue: 0, stockValue: 0 }
    }
    const totalStock = summaryData.totals.available
    const totalSold = summaryData.totals.sold
    // Calculate revenue from actual sales prices when available
    const revenueFromSales = recentSalesData?.sales.reduce(
      (sum, sale) => sum + (sale.salePrice || 0),
      0
    ) || 0
    // If we have recent sales with prices, use that as a sample multiplier
    // Otherwise fall back to suggested prices
    const avgSalePrice = recentSalesData?.sales.length && revenueFromSales > 0
      ? revenueFromSales / recentSalesData.sales.length
      : null
    const totalRevenue = avgSalePrice
      ? totalSold * avgSalePrice // Extrapolate from sample
      : summaryData.categories.reduce(
          (sum, cat) => sum + cat.sold * (cat.suggestedPrice || 0),
          0
        )
    const stockValue = summaryData.categories.reduce(
      (sum, cat) => sum + cat.available * (cat.suggestedPrice || 0),
      0
    )
    return { totalStock, totalSold, totalRevenue, stockValue }
  }, [summaryData, recentSalesData])

  // Filter sales by search
  const filteredSales = useMemo(() => {
    const sales = recentSalesData?.sales || []
    if (!searchTerm) return sales
    const term = searchTerm.toLowerCase()
    return sales.filter(
      sale =>
        sale.serialNumber.toLowerCase().includes(term) ||
        sale.category.name.toLowerCase().includes(term)
    )
  }, [recentSalesData, searchTerm])

  // Calculate coverage days for categories
  const categoriesWithCoverage = useMemo(() => {
    if (!summaryData) return []
    return summaryData.categories.map(category => {
      // Estimate average daily sales (assuming 30 day period)
      const avgPerDay = category.sold / 30 || 0.1 // Avoid division by zero
      const coverageDays = avgPerDay > 0 ? Math.round(category.available / avgPerDay) : 999
      return {
        ...category,
        avgPerDay,
        coverageDays,
        salesLast30Days: category.sold,
      }
    })
  }, [summaryData])

  const handleRefresh = () => {
    refetchSummary()
    refetchSales()
  }

  if (isLoading && !summaryData) {
    return (
      <div className="min-h-screen bg-muted/30">
        <div className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-10">
          <div className="px-6 py-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <span>Inventario</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-primary font-medium">Ventas SIM (Demo)</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Control de Inventario Serializado</h1>
          </div>
        </div>
        <LoadingSkeleton />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-muted/30">
        <div className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-10">
          <div className="px-6 py-4">
            <h1 className="text-2xl font-bold tracking-tight">Control de Inventario Serializado</h1>
          </div>
        </div>
        <ErrorState
          message={error instanceof Error ? error.message : 'Error desconocido'}
          onRetry={handleRefresh}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <span>Inventario</span>
                <ChevronRight className="w-3 h-3" />
                <span className="text-primary font-medium">Ventas SIM (Demo)</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Control de Inventario Serializado</h1>
            </div>
            <div className="flex items-center gap-3">
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoy</SelectItem>
                  <SelectItem value="week">Esta semana</SelectItem>
                  <SelectItem value="month">Este mes</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isLoading}>
                <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Stock */}
          <GlassCard className="p-5">
            <div className="flex justify-between items-start mb-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5">
                <Package className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <Badge variant="secondary" className="text-[10px]">Total Nacional</Badge>
            </div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Stock de SIMs</p>
            <p className="text-3xl font-bold mt-1">{totals.totalStock.toLocaleString()}</p>
            <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full transition-all"
                style={{ width: `${Math.min((totals.totalStock / 500) * 100, 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              {categoriesWithCoverage.filter(c => c.coverageDays < 7).length} categorías con stock bajo
            </p>
          </GlassCard>

          {/* Total Sold */}
          <GlassCard className="p-5">
            <div className="flex justify-between items-start mb-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5">
                <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px]">
                Histórico
              </Badge>
            </div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vendidos (Total)</p>
            <p className="text-3xl font-bold mt-1">{totals.totalSold.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground mt-3">
              Promedio: {(totals.totalSold / 30).toFixed(1)} ventas/día estimado
            </p>
          </GlassCard>

          {/* Revenue */}
          <GlassCard className="p-5">
            <div className="flex justify-between items-start mb-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
                <DollarSign className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ingresos (Estimado)</p>
            <p className="text-3xl font-bold mt-1">{Currency(totals.totalRevenue)}</p>
            <p className="text-[10px] text-muted-foreground mt-3">
              Ticket promedio: {Currency(totals.totalRevenue / totals.totalSold || 0)}
            </p>
          </GlassCard>

          {/* Stock Value */}
          <GlassCard className="p-5">
            <div className="flex justify-between items-start mb-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-500/5">
                <Smartphone className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Valor en Inventario</p>
            <p className="text-3xl font-bold mt-1">{Currency(totals.stockValue)}</p>
            <p className="text-[10px] text-muted-foreground mt-3">
              {summaryData?.categories.length || 0} tipos de producto
            </p>
          </GlassCard>
        </div>

        {/* Stock by Category Table */}
        <GlassCard>
          <div className="px-5 py-4 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-muted/30">
            <h3 className="font-bold text-sm uppercase tracking-wide flex items-center gap-2">
              <Package className="w-4 h-4 text-muted-foreground" />
              Existencias por Tipo de SIM
            </h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-5 py-3 text-left font-bold text-[10px] uppercase">Tipo de SIM / Producto</th>
                  <th className="px-5 py-3 text-right font-bold text-[10px] uppercase">Stock Actual</th>
                  <th className="px-5 py-3 text-right font-bold text-[10px] uppercase">Ventas (Total)</th>
                  <th className="px-5 py-3 text-right font-bold text-[10px] uppercase">Promedio Diario</th>
                  <th className="px-5 py-3 text-center font-bold text-[10px] uppercase">Cobertura (Días)</th>
                  <th className="px-5 py-3 text-right font-bold text-[10px] uppercase">Precio Sugerido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {categoriesWithCoverage.map(category => (
                  <tr
                    key={category.id}
                    className={cn(
                      'hover:bg-muted/30 transition-colors',
                      category.coverageDays < 7 && 'bg-red-50/50 dark:bg-red-950/10'
                    )}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xs border',
                            category.coverageDays < 7
                              ? 'bg-red-100 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'
                              : 'bg-purple-100 text-purple-600 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800'
                          )}
                        >
                          SIM
                        </div>
                        <div>
                          <p className="font-semibold">{category.name}</p>
                          {category.description && (
                            <p className="text-[10px] text-muted-foreground">{category.description}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span
                        className={cn(
                          'text-lg font-bold',
                          category.coverageDays < 7 ? 'text-red-600 dark:text-red-400' : ''
                        )}
                      >
                        {category.available}
                      </span>
                      <p className="text-[9px] text-muted-foreground">Piezas</p>
                    </td>
                    <td className="px-5 py-4 text-right font-semibold text-muted-foreground">
                      {category.salesLast30Days}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="font-semibold">{category.avgPerDay.toFixed(1)}</span>
                      <span className="text-[10px] text-muted-foreground">/día</span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="inline-flex flex-col items-center">
                        <Badge
                          variant="secondary"
                          className={cn(
                            'text-[10px] font-bold uppercase',
                            category.coverageDays < 7
                              ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400'
                              : category.coverageDays < 14
                                ? 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400'
                                : 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400'
                          )}
                        >
                          {category.coverageDays > 99 ? '99+' : category.coverageDays} Días
                        </Badge>
                        {category.coverageDays < 7 && (
                          <p className="text-[9px] text-red-500 font-bold mt-1">¡Crítico!</p>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right font-semibold">
                      {category.suggestedPrice && category.suggestedPrice > 0
                        ? Currency(category.suggestedPrice)
                        : <span className="text-muted-foreground">Gratis</span>}
                    </td>
                  </tr>
                ))}
                {categoriesWithCoverage.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">
                      No hay categorías de productos configuradas
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>

        {/* Recent Sales */}
        <GlassCard>
          <div className="px-5 py-4 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-muted/30">
            <h3 className="font-bold text-sm uppercase tracking-wide flex items-center gap-2">
              <StatusPulse status="success" />
              Ventas Recientes
            </h3>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por serial, categoría..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>

          <div className="divide-y divide-border/50">
            {filteredSales.map(sale => (
              <div
                key={sale.id}
                className="px-5 py-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{sale.category.name}</p>
                      {sale.salePrice && sale.salePrice > 0 && (
                        <span className="text-sm font-bold text-green-600 dark:text-green-400">
                          +{Currency(sale.salePrice)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">{sale.serialNumber}</span>
                      {sale.seller && (
                        <>
                          <span>•</span>
                          <span>{sale.seller.name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{formatTimeAgo(sale.soldAt)}</p>
                </div>
              </div>
            ))}
          </div>

          {filteredSales.length === 0 && (
            <div className="px-5 py-12 text-center text-muted-foreground">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="font-medium">No se encontraron ventas</p>
              <p className="text-sm">
                {searchTerm ? 'Intenta con otro término de búsqueda' : 'Aún no hay ventas registradas'}
              </p>
            </div>
          )}
        </GlassCard>

        {/* Info Banner - @temporary */}
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl p-4 flex gap-4 items-start">
          <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50">
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-amber-700 dark:text-amber-300">
              Página de demostración (Datos reales)
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              Esta página muestra datos reales del sistema pero es una vista preliminar.
              Será reemplazada por la implementación final del módulo de Inventario Serializado.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
