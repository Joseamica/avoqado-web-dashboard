/**
 * CommandCenter - Master Command Center Dashboard
 *
 * Matches mockup: file:///Users/amieva/Downloads/mockups%20sistema%20bait%20/index.html
 *
 * Features:
 * - 4 KPI metric cards with trends (sales, money in street, stock, anomalies)
 * - Dual charts: Ingresos vs Meta (area) + Volumen vs Meta (bar+line)
 * - Promotores online radial gauge
 * - Live activity feed
 * - Operational insights (top store, worst store, top promoter, worst attendance)
 * - Anomalies table with filters
 *
 * Access: MANAGER+ only
 */

import { useTranslation } from 'react-i18next'
import { useState, useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { GlassCard } from '@/components/ui/glass-card'
import { LiveActivityFeed, InsightCard, GaugeChart } from '@/components/playtelecom'
import type { ActivityItem } from '@/components/playtelecom'
import { Badge } from '@/components/ui/badge'
import { StatusPulse } from '@/components/ui/status-pulse'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from 'recharts'
import {
  DollarSign,
  AlertTriangle,
  Package,
  TrendingUp,
  TrendingDown,
  Award,
  UserX,
  Download,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// MOCK DATA - Replace with real API calls

const REVENUE_VS_TARGET = [
  { day: 'Lun', real: 31000, target: 35000 },
  { day: 'Mar', real: 40000, target: 45000 },
  { day: 'Mie', real: 28000, target: 35000 },
  { day: 'Jue', real: 51000, target: 55000 },
  { day: 'Vie', real: 42000, target: 50000 },
  { day: 'Sab', real: 109000, target: 90000 },
  { day: 'Dom', real: 100000, target: 110000 },
]

const VOLUME_VS_TARGET = [
  { day: 'Lun', sales: 44, target: 50 },
  { day: 'Mar', sales: 55, target: 60 },
  { day: 'Mie', sales: 41, target: 50 },
  { day: 'Jue', sales: 67, target: 60 },
  { day: 'Vie', sales: 22, target: 40 },
  { day: 'Sab', sales: 43, target: 50 },
  { day: 'Dom', sales: 65, target: 70 },
]

const LIVE_ACTIVITIES: ActivityItem[] = [
  {
    id: '1',
    type: 'sale',
    title: 'Venta +$200',
    subtitle: 'Juan • Tienda Norte',
    timestamp: new Date(),
    severity: 'normal',
  },
  {
    id: '2',
    type: 'checkin',
    title: 'Check-in OK',
    subtitle: 'Maria • Centro',
    timestamp: new Date(),
    severity: 'normal',
  },
  {
    id: '3',
    type: 'gps_error',
    title: 'Error GPS',
    subtitle: 'Pedro • Sur',
    timestamp: new Date(),
    severity: 'error',
  },
  {
    id: '4',
    type: 'sale',
    title: 'Venta +$100',
    subtitle: 'Ana • Plaza Norte',
    timestamp: new Date(),
    severity: 'normal',
  },
  {
    id: '5',
    type: 'alert',
    title: 'Stock Bajo',
    subtitle: 'Tienda Aurrera',
    timestamp: new Date(),
    severity: 'warning',
  },
]

const ANOMALIES = [
  {
    id: '1',
    severity: 'critical' as const,
    store: 'Tienda Centro #402',
    promoter: 'Pedro Ruiz',
    issue: 'Check-in fuera de rango (1.2km)',
    action: 'Contactar',
  },
  {
    id: '2',
    severity: 'medium' as const,
    store: 'Walmart Norte #112',
    promoter: 'Sarah Johnson',
    issue: 'Stock Bajo (3 SIMs restantes)',
    action: 'Surtir',
  },
]

export default function CommandCenter() {
  const { t } = useTranslation(['playtelecom', 'common'])
  const { activeVenue } = useAuth()
  const [selectedView, setSelectedView] = useState('global')
  const [selectedStore, setSelectedStore] = useState('all')
  const [selectedPeriod, setSelectedPeriod] = useState('today')

  // Mock KPI data
  const kpis = {
    totalSales: 142500,
    salesTarget: 135000,
    moneyInStreet: 45200,
    stockSims: 2450,
    lowStockStores: 3,
    anomalies: 5,
    promotersOnline: 42,
    promotersTotal: 50,
  }

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

  // Calculate percentage for promoters online
  const promotersPercentage = Math.round((kpis.promotersOnline / kpis.promotersTotal) * 100)

  // Calculate sales vs target
  const salesVsTarget = ((kpis.totalSales / kpis.salesTarget) * 100).toFixed(1)
  const salesAchieved = parseFloat(salesVsTarget) >= 100

  return (
    <div className="space-y-6">
      {/* Header with refresh button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-foreground tracking-tight">
            Ojo de Dios: Operación Nacional
          </h2>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">
            Dashboard Maestro • En Tiempo Real
          </p>
        </div>
        <Button variant="default" size="icon" className="cursor-pointer">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* KPI Cards - Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Venta Total Bruta */}
        <GlassCard className="p-6 relative overflow-hidden hover:shadow-md transition-all group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-blue-50 text-primary rounded-lg">
              <DollarSign className="w-5 h-5" />
            </div>
            <Badge variant={salesAchieved ? 'default' : 'secondary'} className="text-xs bg-green-100 text-green-700 hover:bg-green-200">
              +12.5% vs ayer
            </Badge>
          </div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wide">
            Venta Total Bruta
          </p>
          <h3 className="text-3xl font-black text-foreground mt-1">
            {formatCurrency(kpis.totalSales)}
          </h3>
          <p className="text-[10px] text-muted-foreground mt-1">
            Meta diaria: {formatCurrency(kpis.salesTarget)}{' '}
            <span className={cn('font-bold', salesAchieved ? 'text-green-600' : 'text-orange-600')}>
              ({salesAchieved ? 'Cumplida' : `${salesVsTarget}%`})
            </span>
          </p>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-blue-400" />
        </GlassCard>

        {/* Dinero en Calle (Riesgo) */}
        <GlassCard className="p-6 relative overflow-hidden hover:shadow-md transition-all group border-red-100">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-red-50 text-red-600 rounded-lg animate-pulse">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <Button variant="link" className="text-xs font-bold text-red-600 underline h-auto p-0 cursor-pointer">
              Ver Detalle
            </Button>
          </div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wide">
            Dinero en Calle (Riesgo)
          </p>
          <h3 className="text-3xl font-black text-foreground mt-1">
            {formatCurrency(kpis.moneyInStreet)}
          </h3>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-orange-400" />
        </GlassCard>

        {/* Stock de SIMs */}
        <GlassCard className="p-6 relative overflow-hidden hover:shadow-md transition-all group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <Package className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded text-xs font-bold text-muted-foreground cursor-pointer hover:bg-muted/80">
              <span>Global</span>
            </div>
          </div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wide">Stock de SIMs</p>
          <h3 className="text-3xl font-black text-foreground mt-1">{kpis.stockSims.toLocaleString()}</h3>
          <p className="text-[10px] text-muted-foreground mt-1">
            {kpis.lowStockStores} tiendas con stock bajo
          </p>
        </GlassCard>

        {/* Anomalías Operativas */}
        <GlassCard className="p-6 relative overflow-hidden hover:shadow-md transition-all group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-muted-foreground">Hoy</span>
          </div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wide">
            Anomalías Operativas
          </p>
          <h3 className="text-3xl font-black text-foreground mt-1">{kpis.anomalies}</h3>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-orange-500" />
        </GlassCard>
      </div>

      {/* Row 2: Charts + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Rendimiento vs Metas (Charts) */}
        <GlassCard className="lg:col-span-2 p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-black text-foreground flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Rendimiento vs Metas
              </h3>
              <p className="text-xs text-muted-foreground">Comparativa en tiempo real contra objetivos</p>
            </div>
            <Select value={selectedView} onValueChange={setSelectedView}>
              <SelectTrigger className="w-[150px] text-xs font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Vista Global</SelectItem>
                <SelectItem value="centro">Tienda Centro</SelectItem>
                <SelectItem value="norte">Tienda Norte</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[350px]">
            {/* Ingresos vs Meta (Area Chart) */}
            <div className="flex flex-col h-full">
              <div className="flex justify-between items-end mb-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">
                  Ingresos vs Meta ($)
                </p>
                <div className="flex gap-2 text-[9px] font-bold">
                  <span className="flex items-center gap-1 text-primary">
                    <div className="size-2 rounded-full bg-primary" />
                    Real
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <div className="w-2 h-0.5 bg-muted-foreground border border-dashed" />
                    Meta
                  </span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={REVENUE_VS_TARGET}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 10 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
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
                    dataKey="real"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#revenueGradient)"
                  />
                  <Line
                    type="monotone"
                    dataKey="target"
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Volumen vs Meta (Bar + Line) */}
            <div className="flex flex-col h-full border-l border-border pl-4 md:pl-6">
              <div className="flex justify-between items-end mb-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">
                  Volumen vs Meta (#)
                </p>
                <div className="flex gap-2 text-[9px] font-bold">
                  <span className="flex items-center gap-1 text-pink-600">
                    <div className="size-2 rounded-sm bg-pink-600" />
                    Venta
                  </span>
                  <span className="flex items-center gap-1 text-green-600">
                    <div className="w-2 h-0.5 bg-green-600" />
                    Obj.
                  </span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={VOLUME_VS_TARGET}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 10 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="sales" fill="#d61c6b" radius={[4, 4, 0, 0]} />
                  <Line
                    type="monotone"
                    dataKey="target"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </GlassCard>

        {/* Right Sidebar */}
        <div className="flex flex-col gap-6">
          {/* Promotores Online (Radial Gauge) */}
          <GlassCard className="p-5 flex flex-col items-center justify-center relative overflow-hidden">
            <div className="w-full flex justify-between items-center mb-2">
              <h3 className="text-sm font-black text-foreground">Promotores Online</h3>
              <Badge variant="secondary" className="text-[10px] font-bold bg-green-100 text-green-700 animate-pulse">
                En vivo
              </Badge>
            </div>
            <GaugeChart value={promotersPercentage} max={100} label="" size="sm" colorScheme="green" />
            <div className="text-center mt-2">
              <p className="text-3xl font-black text-foreground">
                {kpis.promotersOnline}
                <span className="text-sm text-muted-foreground font-medium">/{kpis.promotersTotal}</span>
              </p>
              <p className="text-xs text-muted-foreground font-medium">Conectados ahora mismo</p>
            </div>
          </GlassCard>

          {/* Live Activity Feed */}
          <GlassCard className="flex-1 flex flex-col overflow-hidden min-h-[250px] p-4">
            <LiveActivityFeed
              activities={LIVE_ACTIVITIES}
              maxHeight="h-64"
              showTimestamps={false}
            />
          </GlassCard>
        </div>
      </div>

      {/* Insights Operativos */}
      <div>
        <h3 className="text-sm font-black text-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-muted-foreground" />
          Insights Operativos (Destacados)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <InsightCard
            icon={Award}
            title="Tienda Líder (Ventas)"
            subtitle="Tienda Centro Histórico"
            value="$52,400"
            type="success"
          />
          <InsightCard
            icon={TrendingDown}
            title="Menor Venta"
            subtitle="Sucursal Aeropuerto"
            value="Solo $4,200"
            type="danger"
          />
          <InsightCard
            icon={Award}
            title="Top Promotor"
            subtitle="Ana María P."
            value="45 SIMs activadas"
            type="neutral"
          />
          <InsightCard
            icon={UserX}
            title="Peor Asistencia"
            subtitle="Tienda Plaza Norte"
            value="3 faltas hoy"
            type="warning"
          />
        </div>
      </div>

      {/* Anomalías Críticas (Table) */}
      <GlassCard className="overflow-hidden">
        <div className="px-6 py-5 border-b border-border flex flex-col sm:flex-row justify-between items-center bg-muted/30 gap-4">
          <h3 className="font-black text-foreground flex items-center gap-2 text-sm uppercase tracking-wide">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            Anomalías Críticas
          </h3>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Select value={selectedStore} onValueChange={setSelectedStore}>
              <SelectTrigger className="w-[150px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las Tiendas</SelectItem>
                <SelectItem value="centro">Tienda Centro</SelectItem>
                <SelectItem value="norte">Tienda Norte</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-[120px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoy</SelectItem>
                <SelectItem value="yesterday">Ayer</SelectItem>
                <SelectItem value="week">Última Semana</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" className="cursor-pointer">
              <Download className="w-3.5 h-3.5 mr-2" />
              Exportar
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead className="font-black uppercase w-24">Estado</TableHead>
                <TableHead className="font-black uppercase">Tienda</TableHead>
                <TableHead className="font-black uppercase">Promotor</TableHead>
                <TableHead className="font-black uppercase">Detalle del Problema</TableHead>
                <TableHead className="font-black uppercase text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ANOMALIES.map(anomaly => (
                <TableRow
                  key={anomaly.id}
                  className={cn(
                    'transition-colors',
                    anomaly.severity === 'critical' && 'hover:bg-red-50/30'
                  )}
                >
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn(
                        'text-[10px] font-black uppercase',
                        anomaly.severity === 'critical' &&
                          'bg-red-100 text-red-700 border border-red-200',
                        anomaly.severity === 'medium' &&
                          'bg-orange-100 text-orange-700 border border-orange-200'
                      )}
                    >
                      {anomaly.severity === 'critical' ? 'Crítico' : 'Medio'}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-bold text-foreground">{anomaly.store}</TableCell>
                  <TableCell className="text-muted-foreground">{anomaly.promoter}</TableCell>
                  <TableCell>
                    <div
                      className={cn(
                        'flex items-center gap-2 font-bold text-xs',
                        anomaly.severity === 'critical' && 'text-red-600',
                        anomaly.severity === 'medium' && 'text-orange-600'
                      )}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {anomaly.issue}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="link" className="text-primary font-bold text-xs h-auto p-0 cursor-pointer">
                      {anomaly.action}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </GlassCard>
    </div>
  )
}
