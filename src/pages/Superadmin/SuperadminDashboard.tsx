import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, Building2, DollarSign, Users, AlertTriangle, CheckCircle, Clock, RefreshCw } from 'lucide-react'
import { Currency } from '@/utils/currency'
import { useSuperadminDashboard, useRefreshSuperadminData } from '@/hooks/use-superadmin-queries'
import { useTranslation } from 'react-i18next'

// Error component
const DashboardError: React.FC<{ error: Error | null; refetch: () => void }> = ({ error, refetch }) => {
  const { t } = useTranslation('superadmin')
  return (
    <div className="flex items-center justify-center min-h-96">
      <div className="text-center">
        <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">{t('common.errorLoading') || 'Error al Cargar Datos'}</h3>
        <p className="text-muted-foreground mb-4">
          {error?.message || t('common.errorLoadingDashboard') || 'Error al cargar los datos del dashboard'}
        </p>
        <Button onClick={refetch}>{t('header.retry')}</Button>
      </div>
    </div>
  )
}

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
  const { t } = useTranslation('superadmin')
  const { data: dashboardData, isLoading, isError, error, refetch, isFetching } = useSuperadminDashboard()

  const refreshAllData = useRefreshSuperadminData()

  // Helper to format relative timestamps in current language
  const formatRelative = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    if (diffInMinutes < 1) return t('dashboard.recentActivity.relative.lessThanMinute')
    if (diffInMinutes < 60) {
      const count = diffInMinutes
      return t('dashboard.recentActivity.relative.minutes', { count })
    }
    if (diffInMinutes < 1440) {
      const count = Math.floor(diffInMinutes / 60)
      return t('dashboard.recentActivity.relative.hours', { count })
    }
    const count = Math.floor(diffInMinutes / 1440)
    return t('dashboard.recentActivity.relative.days', { count })
  }

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
          <h1 className="text-3xl font-bold text-foreground">{t('dashboard.title')}</h1>
          <p className="text-muted-foreground">{t('dashboard.subtitle')}</p>
        </div>
        <div className="flex items-center space-x-3">
          <Badge
            variant="secondary"
            className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
          >
            <CheckCircle className="w-3 h-3 mr-1" />
            {t('header.systemOperational')}
          </Badge>
          <Button onClick={refreshAllData} disabled={isFetching} className="bg-emerald-600 hover:bg-emerald-700 text-primary-foreground">
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            {isFetching ? t('dashboard.refreshing') : t('dashboard.refresh')}
          </Button>
        </div>
      </div>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.kpis.totalRevenue')}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Currency(kpis?.totalRevenue || 0)}</div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              <TrendingUp className="h-3 w-3 inline mr-1 text-emerald-500" />+{(kpis?.growthRate || 0).toFixed(1)}%{' '}
              {t('dashboard.kpis.lastMonthSuffix')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.kpis.platformRevenue')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Currency(kpis?.monthlyRecurringRevenue || 0)}</div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 inline mr-1 text-emerald-500" />
              {t('dashboard.kpis.mrrChangeText')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.kpis.activeVenues')}</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(kpis?.activeVenues || 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {(kpis?.totalVenues || 0).toLocaleString()} {t('dashboard.kpis.totalVenuesSuffix')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.kpis.arpu')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis?.averageRevenuePerUser ? Currency(kpis.averageRevenuePerUser) : 'N/A'}</div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 inline mr-1 text-emerald-500" />
              {t('dashboard.kpis.arpuSubtitle')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.revenueBreakdown.title')}</CardTitle>
            <CardDescription>{t('dashboard.revenueBreakdown.desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-sm text-foreground/80">{t('dashboard.revenueBreakdown.subs')}</span>
                </div>
                <span className="font-medium text-foreground">{Currency(kpis?.subscriptionRevenue || 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                  <span className="text-sm text-foreground/80">{t('dashboard.revenueBreakdown.features')}</span>
                </div>
                <span className="font-medium text-foreground">{Currency(kpis?.featureRevenue || 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                  <span className="text-sm text-foreground/80">{t('dashboard.revenueBreakdown.commissions')}</span>
                </div>
                <span className="font-medium text-foreground">{Currency(kpis?.totalCommissionRevenue || 0)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.system.title')}</CardTitle>
            <CardDescription>{t('dashboard.system.desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm">{t('dashboard.system.status')}</span>
                  <span className="text-sm font-medium text-emerald-600">{t('dashboard.system.operational')}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-muted-foreground">{t('dashboard.system.allServices')}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-600">{(kpis?.activeVenues || 0).toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">{t('dashboard.system.activeVenues')}</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{(kpis?.totalUsers || 0).toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">{t('dashboard.system.totalUsers')}</div>
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
            <span>{t('dashboard.platformRevenueAnalytics.title')}</span>
          </CardTitle>
          <CardDescription>{t('dashboard.platformRevenueAnalytics.desc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div className="text-center p-4 bg-linear-to-r from-emerald-50 to-teal-50 dark:from-emerald-500/10 dark:to-teal-500/10 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {Currency(dashboardData.revenueMetrics?.totalPlatformRevenue || 0)}
              </div>
              <div className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">
                {t('dashboard.platformRevenueAnalytics.totalPlatform')}
              </div>
              <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">{t('dashboard.platformRevenueAnalytics.tagline')}</div>
            </div>

            <div className="text-center p-4 bg-blue-50 dark:bg-blue-500/10 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {Currency(dashboardData.revenueMetrics?.totalCommissionRevenue || 0)}
              </div>
              <div className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                {t('dashboard.platformRevenueAnalytics.transCommissions')}
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">{t('dashboard.platformRevenueAnalytics.fromPayments')}</div>
            </div>

            <div className="text-center p-4 bg-purple-50 dark:bg-purple-500/10 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {Currency(dashboardData.revenueMetrics?.subscriptionRevenue || 0)}
              </div>
              <div className="text-sm text-purple-700 dark:text-purple-300 font-medium">
                {t('dashboard.platformRevenueAnalytics.venueSubscriptions')}
              </div>
              <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">{t('dashboard.platformRevenueAnalytics.monthlyFees')}</div>
            </div>

            <div className="text-center p-4 bg-amber-50 dark:bg-amber-500/10 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {Currency(dashboardData.revenueMetrics?.featureRevenue || 0)}
              </div>
              <div className="text-sm text-amber-700 dark:text-amber-300 font-medium">
                {t('dashboard.platformRevenueAnalytics.premiumFeatures')}
              </div>
              <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                {t('dashboard.platformRevenueAnalytics.additionalFeatures')}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-medium text-foreground/80">{t('dashboard.platformRevenueAnalytics.financialMetrics')}</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{t('dashboard.platformRevenueAnalytics.invoicedRevenue')}:</span>
                  <span className="font-medium">{Currency(dashboardData.revenueMetrics?.invoicedRevenue || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{t('dashboard.platformRevenueAnalytics.settledRevenue')}:</span>
                  <span className="font-medium">{Currency(dashboardData.revenueMetrics?.settledRevenue || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{t('dashboard.platformRevenueAnalytics.processedTransactions')}:</span>
                  <span className="font-medium">{(dashboardData.revenueMetrics?.transactionCount || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-foreground/80">{t('dashboard.platformRevenueAnalytics.projections')}</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{t('dashboard.platformRevenueAnalytics.avgPerVenue')}:</span>
                  <span className="font-medium">
                    {Currency(kpis?.activeVenues > 0 ? (dashboardData.revenueMetrics?.totalPlatformRevenue || 0) / kpis.activeVenues : 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{t('dashboard.platformRevenueAnalytics.newVenuesThisMonth')}:</span>
                  <span className="font-medium text-emerald-600">+{dashboardData.revenueMetrics?.newVenues || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{t('dashboard.platformRevenueAnalytics.growthRate')}:</span>
                  <span className={`font-medium ${(kpis?.growthRate || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {(kpis?.growthRate || 0) >= 0 ? '+' : ''}
                    {(kpis?.growthRate || 0).toFixed(1)}%
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
            <CardTitle>{t('dashboard.recentActivity.title')}</CardTitle>
            <CardDescription>{t('dashboard.recentActivity.desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity && recentActivity.length > 0 ? (
                recentActivity.map(activity => (
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
                      <p className="text-sm text-foreground">{activity.description}</p>
                      <p className="text-xs text-muted-foreground">{formatRelative(activity.timestamp)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">{t('dashboard.recentActivity.empty')}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.alerts.title')}</CardTitle>
            <CardDescription>{t('dashboard.alerts.desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts && alerts.length > 0 ? (
                alerts.map((alert: any) => (
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
                    {alert.type === 'error' && <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5" />}
                    {alert.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5" />}
                    {alert.type === 'info' && <Clock className="w-4 h-4 text-blue-500 mt-0.5" />}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{alert.title}</p>
                      <p className="text-xs text-muted-foreground">{alert.message}</p>
                    </div>
                    {!alert.isRead && <div className="w-2 h-2 bg-red-500 rounded-full"></div>}
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-muted-foreground">{t('dashboard.alerts.empty')}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Performing Venues */}
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.topVenues.title')}</CardTitle>
          <CardDescription>{t('dashboard.topVenues.desc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {topVenues && topVenues.length > 0 ? (
              topVenues.map((venue: any, index: number) => (
                <div
                  key={venue.name}
                  className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-8 h-8 bg-linear-to-r from-emerald-500 to-teal-600 rounded-full flex items-center justify-center text-primary-foreground font-bold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{venue.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {t('dashboard.topVenues.revenue')} {Currency(venue.revenue)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-foreground">
                      {t('dashboard.topVenues.commission')} {Currency(venue.commission)}
                    </p>
                    <p
                      className={`text-sm font-medium ${
                        venue.growth >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {venue.growth >= 0 ? '+' : ''}
                      {venue.growth}%
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-slate-500 dark:text-slate-400">{t('dashboard.topVenues.empty')}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default SuperadminDashboard
