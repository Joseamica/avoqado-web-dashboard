import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import * as superadminAPI from '@/services/superadmin.service'
import { useQuery } from '@tanstack/react-query'
import { endOfMonth, format, startOfMonth, subDays } from 'date-fns'
import { BarChart3, Building, Calendar, CreditCard, DollarSign, Download, PieChart, TrendingDown, TrendingUp } from 'lucide-react'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'

const RevenueDashboard: React.FC = () => {
  const { t, i18n } = useTranslation()
  const [dateRange, setDateRange] = useState({
    startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
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
    const locale = i18n.language?.startsWith('en') ? 'en-US' : 'es-MX'
    return new Intl.NumberFormat(locale, {
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
      startDate: format(start, 'yyyy-MM-dd'),
      endDate: format(end, 'yyyy-MM-dd'),
    })
  }

  if (metricsLoading || breakdownLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground mx-auto"></div>
          <p className="mt-2 text-muted-foreground">{t('revenue.loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 bg-background">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{t('revenue.title')}</h1>
          <p className="text-muted-foreground">{t('revenue.subtitle')}</p>
        </div>
        <Button variant="outline" className="flex items-center space-x-2">
          <Download className="w-4 h-4" />
          <span>{t('revenue.export')}</span>
        </Button>
      </div>

      {/* Date Range Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="w-5 h-5" />
            <span>{t('revenue.dateRange.title')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <Label htmlFor="startDate">{t('revenue.dateRange.from')}</Label>
              <Input
                id="startDate"
                type="date"
                value={dateRange.startDate}
                onChange={e => handleDateRangeChange('startDate', e.target.value)}
                className="w-40"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="endDate">{t('revenue.dateRange.to')}</Label>
              <Input
                id="endDate"
                type="date"
                value={dateRange.endDate}
                onChange={e => handleDateRangeChange('endDate', e.target.value)}
                className="w-40"
              />
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm" onClick={() => setQuickRange(7)}>
                {t('revenue.dateRange.last7')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setQuickRange(30)}>
                {t('revenue.dateRange.last30')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setQuickRange(90)}>
                {t('revenue.dateRange.last90')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Revenue Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('revenue.kpis.totalRevenue')}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics?.totalRevenue || 0)}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              {metrics?.growthRate !== undefined && (
                <>
                  {metrics.growthRate >= 0 ? (
                    <TrendingUp className="w-3 h-3 mr-1 text-green-500 dark:text-green-400" />
                  ) : (
                    <TrendingDown className="w-3 h-3 mr-1 text-red-500 dark:text-red-400" />
                  )}
                  <span className={metrics.growthRate >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}>
                    {formatPercentage(metrics.growthRate)}
                  </span>
                  <span className="ml-1">{t('revenue.kpis.growthSuffix')}</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('revenue.kpis.commissionRevenue')}</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics?.commissionRevenue || 0)}</div>
            <p className="text-xs text-muted-foreground">{t('revenue.kpis.commissionSubtitle')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('revenue.kpis.subscriptionRevenue')}</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics?.subscriptionRevenue || 0)}</div>
            <p className="text-xs text-muted-foreground">{t('revenue.kpis.subscriptionSubtitle')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('revenue.kpis.featureRevenue')}</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics?.featureRevenue || 0)}</div>
            <p className="text-xs text-muted-foreground">{t('revenue.kpis.featureSubtitle')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Transaction Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('revenue.transactions.total')}</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.transactionCount?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">{t('revenue.transactions.completed')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('revenue.transactions.aov')}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics?.averageOrderValue || 0)}</div>
            <p className="text-xs text-muted-foreground">{t('revenue.transactions.perTx')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Breakdown */}
      <Tabs defaultValue="venues" className="space-y-4">
        <TabsList>
          <TabsTrigger value="venues">{t('revenue.tabs.venues')}</TabsTrigger>
          <TabsTrigger value="features">{t('revenue.tabs.features')}</TabsTrigger>
          <TabsTrigger value="timeline">{t('revenue.tabs.timeline')}</TabsTrigger>
          <TabsTrigger value="commissions">{t('revenue.tabs.commissions')}</TabsTrigger>
        </TabsList>

        <TabsContent value="venues" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('revenue.venues.title')}</CardTitle>
              <CardDescription>{t('revenue.venues.desc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {breakdown?.byVenue?.slice(0, 10).map((venue, index) => (
                  <div key={venue.venueId} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-100 dark:bg-blue-950/50 rounded-full flex items-center justify-center">
                        <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">#{index + 1}</span>
                      </div>
                      <div>
                        <p className="font-medium">{venue.venueName}</p>
                        <p className="text-sm text-muted-foreground">{venue.transactionCount} {t('revenue.venues.transactions')}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(venue.revenue)}</p>
                      <p className="text-sm text-muted-foreground">{t('revenue.venues.commissionPrefix')} {formatCurrency(venue.commission)}</p>
                    </div>
                  </div>
                )) || <p className="text-center text-muted-foreground py-8">{t('revenue.venues.empty')}</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('revenue.features.title')}</CardTitle>
              <CardDescription>{t('revenue.features.desc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {breakdown?.byFeature?.map(feature => (
                  <div key={feature.featureCode} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">{feature.featureName}</p>
                      <p className="text-sm text-muted-foreground">
                        {t('revenue.features.meta', { count: feature.activeVenues, amount: formatCurrency(feature.monthlyRevenue) })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(feature.totalRevenue)}</p>
                      <Badge variant="secondary">{feature.featureCode}</Badge>
                    </div>
                  </div>
                )) || <p className="text-center text-muted-foreground py-8">{t('revenue.features.empty')}</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('revenue.timeline.title')}</CardTitle>
              <CardDescription>{t('revenue.timeline.desc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {breakdown?.byPeriod?.map(period => (
                  <div key={period.date} className="flex items-center justify-between p-3 hover:bg-muted/50 rounded">
                    <div>
                      <p className="font-medium">{format(new Date(period.date), 'MMM dd, yyyy')}</p>
                      <p className="text-sm text-muted-foreground">{period.transactionCount} {t('revenue.timeline.transactions')}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(period.revenue)}</p>
                      <p className="text-sm text-muted-foreground">{t('revenue.timeline.commissionPrefix')} {formatCurrency(period.commission)}</p>
                    </div>
                  </div>
                )) || <p className="text-center text-muted-foreground py-8">{t('revenue.timeline.empty')}</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commissions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('revenue.commissions.title')}</CardTitle>
              <CardDescription>{t('revenue.commissions.desc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {formatCurrency(breakdown?.commissionAnalysis?.totalCommission || 0)}
                    </p>
                    <p className="text-sm text-muted-foreground">{t('revenue.commissions.total')}</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 dark:bg-green-950/50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {breakdown?.commissionAnalysis?.averageCommissionRate?.toFixed(1) || 0}%
                    </p>
                    <p className="text-sm text-muted-foreground">{t('revenue.commissions.avgRate')}</p>
                  </div>
                  <div className="text-center p-4 bg-purple-50 dark:bg-purple-950/50 rounded-lg">
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {formatCurrency(breakdown?.commissionAnalysis?.projectedMonthlyCommission || 0)}
                    </p>
                    <p className="text-sm text-muted-foreground">{t('revenue.commissions.monthlyProjection')}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium mb-3">{t('revenue.commissions.byVenue')}</h4>
                  {breakdown?.commissionAnalysis?.commissionByVenue?.slice(0, 10).map(venue => (
                    <div key={venue.venueId} className="flex items-center justify-between p-3 border rounded">
                      <p className="font-medium">{venue.venueName}</p>
                      <p className="font-semibold">{formatCurrency(venue.commission)}</p>
                    </div>
                  )) || <p className="text-center text-muted-foreground py-4">{t('revenue.commissions.empty')}</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default RevenueDashboard
