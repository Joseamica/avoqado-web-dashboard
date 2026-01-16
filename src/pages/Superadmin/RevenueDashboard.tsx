import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import * as superadminAPI from '@/services/superadmin.service'
import { useQuery } from '@tanstack/react-query'
import { endOfMonth, startOfMonth, subDays } from 'date-fns'
import { DateTime } from 'luxon'
import { BarChart3, Building, Calendar, CreditCard, DollarSign, Download, PieChart, TrendingDown, TrendingUp } from 'lucide-react'
import React, { useState } from 'react'
import { cn } from '@/lib/utils'

// GlassCard component
const GlassCard: React.FC<{
  children: React.ReactNode
  className?: string
}> = ({ children, className }) => (
  <div
    className={cn(
      'relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm',
      'shadow-sm transition-all duration-300',
      className
    )}
  >
    {children}
  </div>
)


const RevenueDashboard: React.FC = () => {
  const [dateRange, setDateRange] = useState({
    startDate: DateTime.fromJSDate(startOfMonth(new Date())).toFormat('yyyy-MM-dd'),
    endDate: DateTime.fromJSDate(endOfMonth(new Date())).toFormat('yyyy-MM-dd'),
  })

  // Fetch revenue metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['revenue-metrics', dateRange.startDate, dateRange.endDate],
    queryFn: () =>
      superadminAPI.getRevenueMetrics({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      }),
  })

  // Fetch revenue breakdown
  const { data: breakdown, isLoading: breakdownLoading } = useQuery({
    queryKey: ['revenue-breakdown', dateRange.startDate, dateRange.endDate],
    queryFn: () =>
      superadminAPI.getRevenueBreakdown({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      }),
  })

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount)
  }

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
  }

  const handleDateRangeChange = (field: 'startDate' | 'endDate', value: string) => {
    setDateRange(prev => ({ ...prev, [field]: value }))
  }

  const setQuickRange = (days: number) => {
    const end = new Date()
    const start = subDays(end, days)
    setDateRange({
      startDate: DateTime.fromJSDate(start).toFormat('yyyy-MM-dd'),
      endDate: DateTime.fromJSDate(end).toFormat('yyyy-MM-dd'),
    })
  }

  if (metricsLoading || breakdownLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Cargando métricas de ingresos...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header with Gradient */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 to-pink-500 bg-clip-text text-transparent">
            Ingresos de la Plataforma
          </h1>
          <p className="text-muted-foreground mt-1">Análisis de ingresos por comisiones, suscripciones y features</p>
        </div>
        <Button variant="outline" className="flex items-center gap-2">
          <Download className="w-4 h-4" />
          <span>Exportar Reporte</span>
        </Button>
      </div>

      {/* Date Range Controls */}
      <GlassCard>
        <div className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
              <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="font-semibold text-sm">Rango de Fechas</h3>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="startDate" className="text-sm">Desde</Label>
              <Input
                id="startDate"
                type="date"
                value={dateRange.startDate}
                onChange={e => handleDateRangeChange('startDate', e.target.value)}
                className="w-40"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="endDate" className="text-sm">Hasta</Label>
              <Input
                id="endDate"
                type="date"
                value={dateRange.endDate}
                onChange={e => handleDateRangeChange('endDate', e.target.value)}
                className="w-40"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setQuickRange(7)}>
                Últimos 7 días
              </Button>
              <Button variant="outline" size="sm" onClick={() => setQuickRange(30)}>
                Últimos 30 días
              </Button>
              <Button variant="outline" size="sm" onClick={() => setQuickRange(90)}>
                Últimos 90 días
              </Button>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Revenue Metrics Overview - MetricCard Pattern */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <GlassCard>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5">
                <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
              {metrics?.growthRate !== undefined && (
                <div className="flex items-center gap-1">
                  {metrics.growthRate >= 0 ? (
                    <TrendingUp className="w-3 h-3 text-green-500 dark:text-green-400" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-red-500 dark:text-red-400" />
                  )}
                  <span className={cn(
                    'text-xs font-medium',
                    metrics.growthRate >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  )}>
                    {formatPercentage(metrics.growthRate)}
                  </span>
                </div>
              )}
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight">{formatCurrency(metrics?.totalRevenue || 0)}</p>
              <p className="text-xs text-muted-foreground mt-1">Ingresos Totales</p>
            </div>
          </div>
        </GlassCard>

        {/* Commission Revenue */}
        <GlassCard>
          <div className="p-4 space-y-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 w-fit">
              <PieChart className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight">{formatCurrency(metrics?.commissionRevenue || 0)}</p>
              <p className="text-xs text-muted-foreground mt-1">Comisiones</p>
            </div>
          </div>
        </GlassCard>

        {/* Subscription Revenue */}
        <GlassCard>
          <div className="p-4 space-y-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5 w-fit">
              <Building className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight">{formatCurrency(metrics?.subscriptionRevenue || 0)}</p>
              <p className="text-xs text-muted-foreground mt-1">Suscripciones</p>
            </div>
          </div>
        </GlassCard>

        {/* Feature Revenue */}
        <GlassCard>
          <div className="p-4 space-y-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-500/5 w-fit">
              <CreditCard className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight">{formatCurrency(metrics?.featureRevenue || 0)}</p>
              <p className="text-xs text-muted-foreground mt-1">Features Adicionales</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Transaction Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <GlassCard>
          <div className="p-4 space-y-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/20 to-indigo-500/5 w-fit">
              <BarChart3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight">{metrics?.transactionCount?.toLocaleString('es-MX') || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Transacciones Completadas</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="p-4 space-y-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 w-fit">
              <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight">{formatCurrency(metrics?.averageOrderValue || 0)}</p>
              <p className="text-xs text-muted-foreground mt-1">Valor Promedio por Transacción</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Detailed Breakdown */}
      <Tabs defaultValue="venues" className="space-y-4">
        <TabsList className="inline-flex h-10 items-center justify-start rounded-full bg-muted/60 px-1 py-1 text-muted-foreground border border-border">
          <TabsTrigger
            value="venues"
            className="rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent cursor-pointer hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground"
          >
            Por Venue
          </TabsTrigger>
          <TabsTrigger
            value="features"
            className="rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent cursor-pointer hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground"
          >
            Por Feature
          </TabsTrigger>
          <TabsTrigger
            value="timeline"
            className="rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent cursor-pointer hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground"
          >
            Línea de Tiempo
          </TabsTrigger>
          <TabsTrigger
            value="commissions"
            className="rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent cursor-pointer hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground"
          >
            Comisiones
          </TabsTrigger>
        </TabsList>

        <TabsContent value="venues" className="space-y-4">
          <GlassCard>
            <div className="p-6">
              <div className="mb-4">
                <h3 className="font-semibold text-lg">Ingresos por Venue</h3>
                <p className="text-sm text-muted-foreground">Top 10 venues por ingresos en el período seleccionado</p>
              </div>
              <div className="space-y-3">
                {breakdown?.byVenue?.slice(0, 10).map((venue, index) => (
                  <div key={venue.venueId} className="flex items-center justify-between p-4 rounded-xl border border-border/50 hover:border-border hover:bg-muted/30 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-500/5 flex items-center justify-center">
                        <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">#{index + 1}</span>
                      </div>
                      <div>
                        <p className="font-medium">{venue.venueName}</p>
                        <p className="text-sm text-muted-foreground">
                          {venue.transactionCount} transacciones
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(venue.revenue)}</p>
                      <p className="text-sm text-muted-foreground">
                        Comisión: {formatCurrency(venue.commission)}
                      </p>
                    </div>
                  </div>
                )) || <p className="text-center text-muted-foreground py-8">No hay datos disponibles</p>}
              </div>
            </div>
          </GlassCard>
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
          <GlassCard>
            <div className="p-6">
              <div className="mb-4">
                <h3 className="font-semibold text-lg">Ingresos por Feature</h3>
                <p className="text-sm text-muted-foreground">Desglose de ingresos por features adicionales</p>
              </div>
              <div className="space-y-3">
                {breakdown?.byFeature?.map(feature => (
                  <div key={feature.featureCode} className="flex items-center justify-between p-4 rounded-xl border border-border/50 hover:border-border hover:bg-muted/30 transition-all">
                    <div>
                      <p className="font-medium">{feature.featureName}</p>
                      <p className="text-sm text-muted-foreground">
                        {feature.activeVenues} venues activos · {formatCurrency(feature.monthlyRevenue)}/mes
                      </p>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <div>
                        <p className="font-semibold">{formatCurrency(feature.totalRevenue)}</p>
                        <Badge variant="secondary" className="mt-1">{feature.featureCode}</Badge>
                      </div>
                    </div>
                  </div>
                )) || <p className="text-center text-muted-foreground py-8">No hay datos disponibles</p>}
              </div>
            </div>
          </GlassCard>
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          <GlassCard>
            <div className="p-6">
              <div className="mb-4">
                <h3 className="font-semibold text-lg">Línea de Tiempo</h3>
                <p className="text-sm text-muted-foreground">Ingresos diarios en el período seleccionado</p>
              </div>
              <div className="space-y-2">
                {breakdown?.byPeriod?.map(period => (
                  <div key={period.date} className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/30 transition-colors">
                    <div>
                      <p className="font-medium">
                        {DateTime.fromISO(period.date, { zone: 'utc' })
                          .setLocale('es-MX')
                          .toLocaleString({ month: 'short', day: '2-digit', year: 'numeric' })}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {period.transactionCount} transacciones
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(period.revenue)}</p>
                      <p className="text-sm text-muted-foreground">
                        Comisión: {formatCurrency(period.commission)}
                      </p>
                    </div>
                  </div>
                )) || <p className="text-center text-muted-foreground py-8">No hay datos disponibles</p>}
              </div>
            </div>
          </GlassCard>
        </TabsContent>

        <TabsContent value="commissions" className="space-y-4">
          <GlassCard>
            <div className="p-6">
              <div className="mb-6">
                <h3 className="font-semibold text-lg">Análisis de Comisiones</h3>
                <p className="text-sm text-muted-foreground">Desglose detallado de comisiones por transacciones</p>
              </div>

              {/* Commission Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20">
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {formatCurrency(breakdown?.commissionAnalysis?.totalCommission || 0)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">Comisiones Totales</p>
                </div>
                <div className="text-center p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {breakdown?.commissionAnalysis?.averageCommissionRate?.toFixed(1) || 0}%
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">Tasa Promedio</p>
                </div>
                <div className="text-center p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20">
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {formatCurrency(breakdown?.commissionAnalysis?.projectedMonthlyCommission || 0)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">Proyección Mensual</p>
                </div>
              </div>

              {/* By Venue List */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Comisiones por Venue</h4>
                {breakdown?.commissionAnalysis?.commissionByVenue?.slice(0, 10).map(venue => (
                  <div key={venue.venueId} className="flex items-center justify-between p-3 rounded-xl border border-border/50 hover:border-border hover:bg-muted/30 transition-all">
                    <p className="font-medium">{venue.venueName}</p>
                    <p className="font-semibold">{formatCurrency(venue.commission)}</p>
                  </div>
                )) || <p className="text-center text-muted-foreground py-4">No hay datos disponibles</p>}
              </div>
            </div>
          </GlassCard>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default RevenueDashboard
