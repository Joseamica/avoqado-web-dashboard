/**
 * StoresAnalysis - Store Deep Analysis Dashboard
 *
 * Matches mockup: file:///Users/amieva/Downloads/mockups%20sistema%20bait/tiendas.html
 *
 * Features:
 * - Store selector with open/closed status
 * - Health score gauge (92/100)
 * - Progress vs monthly goal
 * - Calendar attendance heatmap (7x4 grid)
 * - Sales evolution chart (area)
 * - Product mix chart (donut)
 * - 4 KPI metric cards with pulse indicators
 * - Inventory panel with stock levels
 * - Photo evidence log table
 *
 * Access: MANAGER+ only
 */

import { useEffect, useMemo, useState } from 'react'
import { GlassCard } from '@/components/ui/glass-card'
import { CalendarHeatmap, GaugeChart, PhotoEvidenceViewer } from '@/components/playtelecom'
import type { AttendanceDay, PhotoEvidence } from '@/components/playtelecom'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { StatusPulse, type StatusPulseProps } from '@/components/ui/status-pulse'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts'
import { Store, TrendingUp, Package, Users, type LucideIcon } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useAuth } from '@/context/AuthContext'
import { useQuery } from '@tanstack/react-query'
import { useAccess } from '@/hooks/use-access'
import {
  getVenues as getStoresAnalysisVenues,
  getRevenueVsTarget as getStoresRevenueVsTarget,
  getStoreSummary,
  getStoreSalesTrend,
  getStoreInventorySummary,
} from '@/services/storesAnalysis.service'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export function StoresAnalysis() {
  const { venue } = useCurrentVenue()
  const { allVenues } = useAuth()
  const { getDataScope } = useAccess()
  const [selectedStore, setSelectedStore] = useState<string>('')

  // Get dataScope from white-label config for this feature
  const dataScope = getDataScope('STORES_ANALYSIS')
  const venueId = venue?.id

  // Fetch venues from white-label stores analysis endpoint (uses venue-level access control)
  const { data: storesAnalysisVenues, isLoading: storesVenuesLoading } = useQuery({
    queryKey: ['stores-analysis', 'venues', venueId],
    queryFn: () => getStoresAnalysisVenues(venueId!),
    enabled: !!venueId,
  })

  // Determine which venues to show based on dataScope
  const venuesData = useMemo(() => {
    // If we have data from stores analysis endpoint, use it
    if (storesAnalysisVenues?.venues) {
      // Map the response to match expected format
      return storesAnalysisVenues.venues.map(v => ({
        id: v.id,
        name: v.name,
        slug: v.slug,
        status: v.alertLevel === 'CRITICAL' ? 'INACTIVE' : 'ACTIVE',
        organizationId: venue?.organizationId || '',
      }))
    }

    // Fallback based on dataScope
    switch (dataScope) {
      case 'venue':
        return venue ? [venue] : []
      case 'user-venues':
        return allVenues.filter(v => v.organizationId === venue?.organizationId)
      case 'organization':
        return allVenues.filter(v => v.organizationId === venue?.organizationId)
      default:
        return venue ? [venue] : []
    }
  }, [dataScope, venue, allVenues, storesAnalysisVenues])

  const venuesLoading = storesVenuesLoading

  useEffect(() => {
    if (!venuesData?.length) return
    if (!selectedStore || !venuesData.some(store => store.id === selectedStore)) {
      setSelectedStore(venuesData[0].id)
    }
  }, [venuesData, selectedStore])

  const currentStore = useMemo(
    () => venuesData?.find(store => store.id === selectedStore) || venuesData?.[0] || null,
    [venuesData, selectedStore]
  )

  const currentStoreId = currentStore?.id || null

  // Fetch store summary data (centralized under STORES_ANALYSIS)
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['stores-analysis', 'store-summary', venueId, currentStoreId],
    queryFn: () => getStoreSummary(venueId!, currentStoreId!),
    enabled: !!venueId && !!currentStoreId,
  })

  // Fetch sales trend data (centralized under STORES_ANALYSIS)
  const { data: salesTrendData, isLoading: salesTrendLoading } = useQuery({
    queryKey: ['stores-analysis', 'store-sales-trend', venueId, currentStoreId],
    queryFn: () => getStoreSalesTrend(venueId!, currentStoreId!, { days: 7 }),
    enabled: !!venueId && !!currentStoreId,
  })

  // Fetch inventory summary data (centralized under STORES_ANALYSIS)
  const { data: serializedSummary } = useQuery({
    queryKey: ['stores-analysis', 'store-inventory-summary', venueId, currentStoreId],
    queryFn: () => getStoreInventorySummary(venueId!, currentStoreId!),
    enabled: !!venueId && !!currentStoreId,
  })

  const { data: revenueVsTarget } = useQuery({
    queryKey: ['stores-analysis', 'revenue-vs-target', venueId, currentStoreId],
    queryFn: () => getStoresRevenueVsTarget(venueId!, currentStoreId!),
    enabled: !!venueId && !!currentStoreId,
  })

  const attendanceData: AttendanceDay[] = []
  const photoLogs: PhotoEvidence[] = []

  const salesData = useMemo(() => {
    const formatDayLabel = (dateValue: string) => {
      const parsed = new Date(dateValue)
      return Number.isNaN(parsed.getTime()) ? dateValue : format(parsed, 'd MMM', { locale: es })
    }

    return (salesTrendData?.trend || []).map(point => ({
      day: formatDayLabel(point.date),
      sales: point.sales,
    }))
  }, [salesTrendData])

  const productMix = useMemo(() => {
    const palette = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#14b8a6']
    return (summaryData?.categoryBreakdown || []).map((item, index) => ({
      name: item.name,
      value: item.units,
      color: palette[index % palette.length],
    }))
  }, [summaryData])

  const inventoryItems = useMemo(() => {
    return (serializedSummary?.categories || []).map(category => ({
      sku: category.id,
      name: category.name,
      stock: category.available,
      max: category.total,
    }))
  }, [serializedSummary])

  // Format currency
  const formatCurrency = useMemo(
    () =>
      (value: number) =>
        new Intl.NumberFormat('es-MX', {
          style: 'currency',
          currency: venue?.currency || 'MXN',
          minimumFractionDigits: 0,
        }).format(value),
    [venue?.currency]
  )

  const activePromoters = summaryData?.activePromoters ?? 0
  const totalPromoters = summaryData?.totalPromoters ?? 0
  const promoterRatio = totalPromoters > 0 ? activePromoters / totalPromoters : 0
  const stockAvailable = serializedSummary?.totals.available ?? 0
  const stockTotal = serializedSummary?.totals.total ?? 0
  const stockRatio = stockTotal > 0 ? stockAvailable / stockTotal : 0
  const healthScore = Math.round((promoterRatio * 0.6 + stockRatio * 0.4) * 100)
  const weeklyActual = revenueVsTarget?.weekTotal.actual ?? 0
  const weeklyTarget = revenueVsTarget?.weekTotal.target ?? 0
  const progressPercent = weeklyTarget > 0 ? Math.round((weeklyActual / weeklyTarget) * 100) : 0

  const kpiMetrics = useMemo<Array<{
    label: string
    value: string
    status: StatusPulseProps['status']
    icon: LucideIcon
  }>>(() => [
    {
      label: 'Promotores Activos',
      value: totalPromoters > 0 ? `${activePromoters}/${totalPromoters}` : 'Sin datos',
      status: totalPromoters > 0 ? (promoterRatio >= 0.8 ? 'success' : promoterRatio >= 0.5 ? 'warning' : 'error') : 'neutral',
      icon: Users,
    },
    {
      label: 'Ventas Hoy',
      value: formatCurrency(summaryData?.todaySales ?? 0),
      status: (summaryData?.todaySales ?? 0) > 0 ? 'success' : 'neutral',
      icon: TrendingUp,
    },
    {
      label: 'Ventas Semana',
      value: formatCurrency(summaryData?.weekSales ?? 0),
      status: (summaryData?.weekSales ?? 0) > 0 ? 'info' : 'neutral',
      icon: TrendingUp,
    },
    {
      label: 'Stock Disponible',
      value: stockTotal > 0 ? `${stockAvailable}/${stockTotal}` : 'Sin datos',
      status: stockTotal > 0 ? (stockRatio >= 0.5 ? 'success' : stockRatio >= 0.2 ? 'warning' : 'error') : 'neutral',
      icon: Package,
    },
  ], [activePromoters, totalPromoters, promoterRatio, stockAvailable, stockTotal, stockRatio, summaryData, formatCurrency])

  const isLoading = storesVenuesLoading || summaryLoading || salesTrendLoading

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="lg:col-span-2 h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header: Store Selector + Status */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <Select value={selectedStore} onValueChange={setSelectedStore}>
              <SelectTrigger className="w-[280px] font-semibold">
                <SelectValue placeholder={venuesLoading ? 'Cargando tiendas...' : 'Selecciona una tienda'} />
              </SelectTrigger>
              <SelectContent>
                {(venuesData || []).map(store => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Status Badge */}
        {currentStore && (
          <Badge
            variant={currentStore.status === 'ACTIVE' ? 'default' : 'secondary'}
            className={cn(
              'flex items-center gap-2',
              currentStore.status === 'ACTIVE' && 'bg-green-500 hover:bg-green-600'
            )}
          >
            <StatusPulse status={currentStore.status === 'ACTIVE' ? 'success' : 'neutral'} size="sm" />
            {currentStore.status === 'ACTIVE' ? 'Activa' : 'Inactiva'}
          </Badge>
        )}
      </div>

      {/* Row 1: Health Score + Progress + Calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Health Score Gauge */}
        <GlassCard className="p-6 flex items-center justify-center">
          <GaugeChart
            value={healthScore}
            max={100}
            label="Salud General"
            colorScheme="auto"
          />
        </GlassCard>

        {/* Progress vs Goal */}
        <GlassCard className="p-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Progreso vs Meta Semanal
              </h3>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-bold">{formatCurrency(weeklyActual)}</span>
                {weeklyTarget > 0 && (
                  <span className="text-muted-foreground">
                    / {formatCurrency(weeklyTarget)}
                  </span>
                )}
              </div>
            </div>

            {weeklyTarget > 0 ? (
              <>
                <Progress value={progressPercent} className="h-3" />
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium">
                    {progressPercent}% completado
                  </span>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Meta no configurada</p>
            )}
          </div>
        </GlassCard>

        {/* Calendar Heatmap */}
        <GlassCard className="p-6">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
              Consistencia Operativa
            </h3>
            {attendanceData.length > 0 ? (
              <CalendarHeatmap data={attendanceData} showLegend />
            ) : (
              <p className="text-sm text-muted-foreground">Sin datos de asistencia</p>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Row 2: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Evolution (Area Chart) */}
        <GlassCard className="lg:col-span-2 p-6">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">
            Evolución de Ventas
          </h3>
          {salesData.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin datos de ventas</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={salesData}>
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={val => `$${(val / 1000).toFixed(0)}k`}
                />
                <RechartsTooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#salesGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </GlassCard>

        {/* Product Mix (Donut Chart) */}
        <GlassCard className="p-6">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">
            Mix de Productos
          </h3>
          {productMix.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin datos de productos</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={productMix}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {productMix.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip
                  formatter={(value: number, name: string) => [`${value} ventas`, name]}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value) => <span className="text-xs">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </GlassCard>
      </div>

      {/* Row 3: KPI Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiMetrics.map((metric, index) => {
          const Icon = metric.icon
          return (
            <GlassCard key={index} className="p-4">
              <div className="flex items-start gap-3">
                <StatusPulse status={metric.status} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground truncate">
                    {metric.label}
                  </p>
                  <p className="text-lg font-bold mt-1">
                    {metric.value}
                  </p>
                </div>
                <Icon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              </div>
            </GlassCard>
          )
        })}
      </div>

      {/* Row 4: Inventory Panel */}
      <GlassCard className="p-6">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">
          Estado de Inventario
        </h3>
        {inventoryItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin datos de inventario</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead>Nivel</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inventoryItems.map(item => {
                const stockPercent = item.max > 0 ? (item.stock / item.max) * 100 : 0
                return (
                  <TableRow key={item.sku}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {item.sku}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={cn('font-bold', item.max > 0 && item.stock < item.max * 0.2 && 'text-red-500')}>
                        {item.stock}
                      </span>
                      <span className="text-muted-foreground"> / {item.max}</span>
                    </TableCell>
                    <TableCell className="w-[200px]">
                      <div className="flex items-center gap-3">
                        <Progress
                          value={stockPercent}
                          className="flex-1"
                          indicatorClassName={cn(
                            item.max > 0 && item.stock < item.max * 0.2 && 'bg-red-500',
                            item.max > 0 && item.stock >= item.max * 0.2 && item.stock < item.max * 0.5 && 'bg-yellow-500',
                            item.max > 0 && item.stock >= item.max * 0.5 && 'bg-green-500'
                          )}
                        />
                        <span className="text-xs font-medium w-10 text-right">
                          {Math.round(stockPercent)}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </GlassCard>

      {/* Row 5: Photo Evidence Log */}
      <GlassCard className="p-6">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">
          Bitácora Fotográfica (Hoy)
        </h3>
        <PhotoEvidenceViewer photos={photoLogs} layout="grid" />
      </GlassCard>
    </div>
  )
}

export default StoresAnalysis
