import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, Building2, DollarSign, Users, AlertTriangle, CheckCircle, Clock, RefreshCw } from 'lucide-react'
import { Currency } from '@/utils/currency'
import { useSuperadminDashboard, useRefreshSuperadminData } from '@/hooks/use-superadmin-queries'

// Helper function to format timestamps
const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
  
  if (diffInMinutes < 1) return 'hace menos de un minuto'
  if (diffInMinutes < 60) return `hace ${diffInMinutes} minuto${diffInMinutes > 1 ? 's' : ''}`
  if (diffInMinutes < 1440) return `hace ${Math.floor(diffInMinutes / 60)} hora${Math.floor(diffInMinutes / 60) > 1 ? 's' : ''}`
  return `hace ${Math.floor(diffInMinutes / 1440)} día${Math.floor(diffInMinutes / 1440) > 1 ? 's' : ''}`
}

// Error component
const DashboardError: React.FC<{ error: Error | null; refetch: () => void }> = ({ error, refetch }) => (
  <div className="flex items-center justify-center min-h-96">
    <div className="text-center">
      <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-2">Error al Cargar Datos</h3>
      <p className="text-slate-600 dark:text-slate-400 mb-4">
        {error?.message || 'Error al cargar los datos del dashboard'}
      </p>
      <Button onClick={refetch}>Reintentar</Button>
    </div>
  </div>
)

// Loading skeleton component
const DashboardSkeleton = () => (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <div>
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="flex items-center space-x-3">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-9 w-32" />
      </div>
    </div>
    
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="p-6 border border-border rounded-lg bg-card">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-8 w-20 mb-2" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </div>
    
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="p-6 border border-border rounded-lg bg-card">
          <Skeleton className="h-5 w-32 mb-2" />
          <Skeleton className="h-4 w-48 mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, j) => (
              <Skeleton key={j} className="h-12 w-full" />
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
)

const SuperadminDashboard: React.FC = () => {
  const { 
    data: dashboardData, 
    isLoading, 
    isError, 
    error, 
    refetch,
    isFetching
  } = useSuperadminDashboard()
  
  const refreshAllData = useRefreshSuperadminData()

  if (isLoading) {
    return <DashboardSkeleton />
  }

  if (isError) {
    return <DashboardError error={error} refetch={refetch} />
  }

  if (!dashboardData) {
    return null
  }

  const { kpis, recentActivity, topVenues, alerts } = dashboardData

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">Panel de Control</h1>
          <p className="text-slate-600 dark:text-slate-400">Monitorea y gestiona todo el ecosistema de Avoqado</p>
        </div>
        <div className="flex items-center space-x-3">
          <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
            <CheckCircle className="w-3 h-3 mr-1" />
            Todos los Sistemas Operativos
          </Badge>
          <Button 
            onClick={refreshAllData}
            disabled={isFetching}
            className="bg-emerald-600 hover:bg-emerald-700 text-primary-foreground"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            {isFetching ? 'Actualizando...' : 'Actualizar Datos'}
          </Button>
        </div>
      </div>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Currency(kpis?.totalRevenue || 0)}</div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              <TrendingUp className="h-3 w-3 inline mr-1 text-emerald-500" />+{(kpis?.growthRate || 0).toFixed(1)}% del mes pasado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Recurrentes Mensuales</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Currency(kpis?.monthlyRecurringRevenue || 0)}</div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              <TrendingUp className="h-3 w-3 inline mr-1 text-emerald-500" />
              +8.2% del mes pasado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Locales Activos</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(kpis?.activeVenues || 0).toLocaleString()}</div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{(kpis?.totalVenues || 0).toLocaleString()} locales totales</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingreso por Usuario</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis?.averageRevenuePerUser ? Currency(kpis.averageRevenuePerUser) : 'N/A'}</div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              <TrendingUp className="h-3 w-3 inline mr-1 text-emerald-500" />
              Ingreso promedio por usuario
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Desglose de Ingresos</CardTitle>
            <CardDescription>Ingresos de la plataforma por fuente</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-sm text-slate-700 dark:text-slate-300">Ingresos por Suscripciones</span>
                </div>
                <span className="font-medium text-slate-900 dark:text-slate-50">{Currency(kpis?.subscriptionRevenue || 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                  <span className="text-sm text-slate-700 dark:text-slate-300">Ingresos por Funcionalidades Premium</span>
                </div>
                <span className="font-medium text-slate-900 dark:text-slate-50">{Currency(kpis?.featureRevenue || 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                  <span className="text-sm text-slate-700 dark:text-slate-300">Ingresos por Comisiones</span>
                </div>
                <span className="font-medium text-slate-900 dark:text-slate-50">{Currency(kpis?.totalCommissionRevenue || 0)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estado del Sistema</CardTitle>
            <CardDescription>Métricas de rendimiento de la plataforma</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm">Estado del Sistema</span>
                  <span className="text-sm font-medium text-emerald-600">Operativo</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">Todos los servicios funcionando</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{(kpis?.activeVenues || 0).toLocaleString()}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Locales Activos</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{(kpis?.totalUsers || 0).toLocaleString()}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Usuarios Totales</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Platform Revenue Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <DollarSign className="w-5 h-5 text-emerald-500" />
            <span>Ingresos de la Plataforma Avoqado</span>
          </CardTitle>
          <CardDescription>Análisis detallado de lo que realmente gana la plataforma</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div className="text-center p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-500/10 dark:to-teal-500/10 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {Currency(dashboardData.revenueMetrics?.totalPlatformRevenue || 0)}
              </div>
              <div className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">
                Ingresos Totales de Plataforma
              </div>
              <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                Lo que realmente gana Avoqado
              </div>
            </div>
            
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-500/10 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {Currency(dashboardData.revenueMetrics?.totalCommissionRevenue || 0)}
              </div>
              <div className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                Comisiones por Transacciones
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                De pagos procesados
              </div>
            </div>
            
            <div className="text-center p-4 bg-purple-50 dark:bg-purple-500/10 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {Currency(dashboardData.revenueMetrics?.subscriptionRevenue || 0)}
              </div>
              <div className="text-sm text-purple-700 dark:text-purple-300 font-medium">
                Suscripciones de Locales
              </div>
              <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                Cuotas mensuales
              </div>
            </div>
            
            <div className="text-center p-4 bg-amber-50 dark:bg-amber-500/10 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {Currency(dashboardData.revenueMetrics?.featureRevenue || 0)}
              </div>
              <div className="text-sm text-amber-700 dark:text-amber-300 font-medium">
                Funcionalidades Premium
              </div>
              <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Features adicionales
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-medium text-slate-700 dark:text-slate-300">Métricas Financieras</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Ingresos Facturados:</span>
                  <span className="font-medium">{Currency(dashboardData.revenueMetrics?.invoicedRevenue || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Ingresos Liquidados:</span>
                  <span className="font-medium">{Currency(dashboardData.revenueMetrics?.settledRevenue || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Transacciones Procesadas:</span>
                  <span className="font-medium">{(dashboardData.revenueMetrics?.transactionCount || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-medium text-slate-700 dark:text-slate-300">Proyecciones</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Ingreso Promedio por Local:</span>
                  <span className="font-medium">
                    {Currency(kpis?.activeVenues > 0 ? (dashboardData.revenueMetrics?.totalPlatformRevenue || 0) / kpis.activeVenues : 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Locales Nuevos este Mes:</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">+{dashboardData.revenueMetrics?.newVenues || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Tasa de Crecimiento:</span>
                  <span className={`font-medium ${(kpis?.growthRate || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {(kpis?.growthRate || 0) >= 0 ? '+' : ''}{(kpis?.growthRate || 0).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Actividad Reciente</CardTitle>
            <CardDescription>Últimos eventos de la plataforma</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity && recentActivity.length > 0 ? recentActivity.map(activity => (
                <div key={activity.id} className="flex items-center space-x-3">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      activity.type === 'venue_approved'
                        ? 'bg-emerald-500'
                        : activity.type === 'payment_received'
                        ? 'bg-blue-500'
                        : activity.type === 'feature_enabled'
                        ? 'bg-indigo-500'
                        : 'bg-red-500'
                    }`}
                  ></div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-900 dark:text-slate-50">{activity.description}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{formatTimestamp(activity.timestamp)}</p>
                  </div>
                </div>
              )) : (
                <div className="text-center py-8">
                  <p className="text-slate-500 dark:text-slate-400">No hay actividad reciente</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alertas y Notificaciones</CardTitle>
            <CardDescription>Alertas importantes del sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts && alerts.length > 0 ? alerts.map((alert: any) => (
                <div
                  key={alert.id}
                  className={`flex items-start space-x-3 p-3 rounded-lg border ${
                    alert.type === 'error'
                      ? 'bg-red-50 border-red-100 dark:bg-red-500/10 dark:border-red-500/20'
                      : alert.type === 'warning'
                      ? 'bg-amber-50 border-amber-100 dark:bg-amber-500/10 dark:border-amber-500/20'
                      : 'bg-blue-50 border-blue-100 dark:bg-blue-500/10 dark:border-blue-500/20'
                  }`}
                >
                  {alert.type === 'error' && <AlertTriangle className="w-4 h-4 text-red-500 dark:text-red-400 mt-0.5" />}
                  {alert.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400 mt-0.5" />}
                  {alert.type === 'info' && <Clock className="w-4 h-4 text-blue-500 dark:text-blue-400 mt-0.5" />}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-50">{alert.title}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{alert.message}</p>
                  </div>
                  {!alert.isRead && <div className="w-2 h-2 bg-red-500 rounded-full"></div>}
                </div>
              )) : (
                <div className="text-center py-8">
                  <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-slate-500 dark:text-slate-400">No hay alertas activas</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Performing Venues */}
      <Card>
        <CardHeader>
          <CardTitle>Locales con Mejor Rendimiento</CardTitle>
          <CardDescription>Locales que generan más ingresos este mes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {topVenues && topVenues.length > 0 ? topVenues.map((venue: any, index: number) => (
              <div key={venue.name} className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
                <div className="flex items-center space-x-4">
                  <div className="w-8 h-8 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full flex items-center justify-center text-primary-foreground font-bold text-sm">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-50">{venue.name}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Ingresos: {Currency(venue.revenue)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-slate-900 dark:text-slate-50">Comisión: {Currency(venue.commission)}</p>
                  <p className={`text-sm font-medium ${venue.growth >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {venue.growth >= 0 ? '+' : ''}
                    {venue.growth}%
                  </p>
                </div>
              </div>
            )) : (
              <div className="text-center py-8">
                <p className="text-slate-500 dark:text-slate-400">No hay datos de locales disponibles</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default SuperadminDashboard
