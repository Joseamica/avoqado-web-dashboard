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

import { useTranslation } from 'react-i18next'
import { useState, useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { GlassCard } from '@/components/ui/glass-card'
import { CalendarHeatmap, GaugeChart, PhotoEvidenceViewer } from '@/components/playtelecom'
import type { AttendanceDay, PhotoEvidence } from '@/components/playtelecom'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { StatusPulse } from '@/components/ui/status-pulse'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts'
import { Store, TrendingUp, Package, Users, Clock, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

// MOCK DATA - Replace with real API calls
const STORES = [
  { id: '1', name: 'Centro Histórico #402', status: 'open' as const },
  { id: '2', name: 'Walmart Norte #112', status: 'open' as const },
  { id: '3', name: 'Bodega Aurrera Sur', status: 'closed' as const },
]

const SALES_DATA = [
  { week: 'Sem 1', sales: 18200 },
  { week: 'Sem 2', sales: 22400 },
  { week: 'Sem 3', sales: 19800 },
  { week: 'Sem 4', sales: 24500 },
  { week: 'Sem 5', sales: 21300 },
  { week: 'Sem 6', sales: 26700 },
  { week: 'Sem 7', sales: 28100 },
]

const PRODUCT_MIX = [
  { name: 'BAIT $200', value: 120, color: '#8b5cf6' }, // Purple
  { name: 'BAIT $100', value: 85, color: '#3b82f6' }, // Blue
  { name: 'Portabilidad', value: 45, color: '#10b981' }, // Green
  { name: 'HBB', value: 15, color: '#f59e0b' }, // Orange
]

const KPI_METRICS = [
  { label: 'Puntualidad', value: '100%', status: 'success' as const, icon: Clock },
  { label: 'Stock Óptimo', value: '85%', status: 'success' as const, icon: Package },
  { label: 'Equipo Activo', value: '4/4', status: 'success' as const, icon: Users },
  { label: 'Meta Ventas', value: '85%', status: 'warning' as const, icon: TrendingUp },
]

const INVENTORY_ITEMS = [
  { sku: 'BT-200-GLD', name: 'BAIT $200 (Plan Oro)', stock: 145, max: 200, color: 'bg-purple-500' },
  { sku: 'BT-100-STD', name: 'BAIT $100 (Básico)', stock: 180, max: 200, color: 'bg-blue-500' },
  { sku: 'BT-PORT-01', name: 'SIM Portabilidad', stock: 85, max: 100, color: 'bg-green-500' },
  { sku: 'BT-HBB-01', name: 'HBB Internet Hogar', stock: 22, max: 50, color: 'bg-orange-500', alert: true },
]

// Generate mock attendance data (28 days)
const ATTENDANCE_DATA: AttendanceDay[] = Array.from({ length: 28 }, (_, i) => {
  const date = new Date()
  date.setDate(date.getDate() - (27 - i))

  // Random status (mostly present)
  let status: AttendanceDay['status'] = 'present'
  const rand = Math.random()
  if (rand > 0.9) status = 'late'
  else if (rand > 0.85) status = 'absent'

  return { date, status }
})

// Mock photo evidence
const PHOTO_LOGS: PhotoEvidence[] = [
  {
    id: '1',
    url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400',
    type: 'selfie',
    timestamp: new Date(2026, 0, 20, 8, 2),
    validations: { biometry: true, gpsInRange: true },
  },
  {
    id: '2',
    url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400',
    type: 'voucher',
    timestamp: new Date(2026, 0, 20, 18, 30),
    notes: '$3,500.00 depósito bancario',
  },
]

export function StoresAnalysis() {
  const { t } = useTranslation(['playtelecom', 'common'])
  const { activeVenue } = useAuth()
  const [selectedStore, setSelectedStore] = useState(STORES[0].id)

  const currentStore = useMemo(
    () => STORES.find(s => s.id === selectedStore) || STORES[0],
    [selectedStore]
  )

  // Mock data for current store
  const healthScore = 92
  const monthlySales = 114750
  const monthlyGoal = 135000
  const progressPercent = Math.round((monthlySales / monthlyGoal) * 100)

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
      {/* Header: Store Selector + Status */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <Select value={selectedStore} onValueChange={setSelectedStore}>
              <SelectTrigger className="w-[280px] font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STORES.map(store => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Status Badge */}
        <Badge
          variant={currentStore.status === 'open' ? 'default' : 'secondary'}
          className={cn(
            'flex items-center gap-2',
            currentStore.status === 'open' && 'bg-green-500 hover:bg-green-600'
          )}
        >
          <StatusPulse status={currentStore.status === 'open' ? 'success' : 'neutral'} size="sm" />
          {currentStore.status === 'open' ? 'Abierta' : 'Cerrada'}
        </Badge>
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
                Progreso vs Meta Mensual
              </h3>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-bold">
                  {formatCurrency(monthlySales)}
                </span>
                <span className="text-muted-foreground">
                  / {formatCurrency(monthlyGoal)}
                </span>
              </div>
            </div>

            <Progress value={progressPercent} className="h-3" />

            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium">
                {progressPercent}% completado
              </span>
            </div>
          </div>
        </GlassCard>

        {/* Calendar Heatmap */}
        <GlassCard className="p-6">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
              Consistencia Operativa
            </h3>
            <CalendarHeatmap data={ATTENDANCE_DATA} showLegend />
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
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={SALES_DATA}>
              <defs>
                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="week"
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
        </GlassCard>

        {/* Product Mix (Donut Chart) */}
        <GlassCard className="p-6">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">
            Mix de Productos
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={PRODUCT_MIX}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {PRODUCT_MIX.map((entry, index) => (
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
        </GlassCard>
      </div>

      {/* Row 3: KPI Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {KPI_METRICS.map((metric, index) => {
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
            {INVENTORY_ITEMS.map(item => {
              const stockPercent = (item.stock / item.max) * 100
              return (
                <TableRow key={item.sku}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {item.sku}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={cn('font-bold', item.alert && 'text-red-500')}>
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
                          item.stock < item.max * 0.2 && 'bg-red-500',
                          item.stock >= item.max * 0.2 && item.stock < item.max * 0.5 && 'bg-yellow-500',
                          item.stock >= item.max * 0.5 && 'bg-green-500'
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
      </GlassCard>

      {/* Row 5: Photo Evidence Log */}
      <GlassCard className="p-6">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">
          Bitácora Fotográfica (Hoy)
        </h3>
        <PhotoEvidenceViewer photos={PHOTO_LOGS} layout="grid" />
      </GlassCard>
    </div>
  )
}

export default StoresAnalysis
