import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import * as costManagementAPI from '@/services/cost-management.service'
import { useQuery } from '@tanstack/react-query'
import { endOfMonth, format, startOfMonth, subDays } from 'date-fns'
import { 
  Calendar, Download, PieChart, 
  TrendingDown, TrendingUp, Calculator, Target,
  ArrowUp, ArrowDown
} from 'lucide-react'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'

// Import types from the service instead of redefining
import type {
  ProfitMetrics,
  MonthlyProfitData,
  CostStructureAnalysis,
} from '@/services/cost-management.service'

const ProfitAnalyticsDashboard: React.FC = () => {
  const { t, i18n } = useTranslation()
  const [dateRange, setDateRange] = useState({
    startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  })
  const [selectedVenue, setSelectedVenue] = useState<string>('all')
  const [selectedProvider, setSelectedProvider] = useState<string>('all')

  // Fetch profit metrics
  const { data: profitMetrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['profit-metrics', dateRange.startDate, dateRange.endDate, selectedVenue, selectedProvider],
    queryFn: () =>
      costManagementAPI.getProfitMetrics({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        venueId: selectedVenue !== 'all' ? selectedVenue : undefined,
        providerId: selectedProvider !== 'all' ? selectedProvider : undefined,
      }),
  })

  // Fetch monthly profit data
  const { data: monthlyData, isLoading: monthlyLoading } = useQuery({
    queryKey: ['monthly-profits', dateRange.startDate, dateRange.endDate],
    queryFn: () =>
      costManagementAPI.getMonthlyProfits({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      }),
  })

  // Fetch cost structure analysis
  const { data: costAnalysis } = useQuery({
    queryKey: ['cost-analysis'],
    queryFn: () => costManagementAPI.getCostStructureAnalysis(),
  })

  // Fetch venue list for filter
  const { data: venues, isLoading: venuesLoading, error: venuesError } = useQuery({
    queryKey: ['venues-list'],
    queryFn: () => costManagementAPI.getVenuesList(),
    retry: 3,
    staleTime: 5 * 60 * 1000, // 5 minutes
    onError: (error) => {
      console.error('Error loading venues:', error)
    }
  })

  // Fetch provider list for filter
  const { data: providers } = useQuery({
    queryKey: ['providers-list'],
    queryFn: () => costManagementAPI.getProvidersList(),
  })

  const formatCurrency = (amount: number) => {
    const locale = i18n.language?.startsWith('en') ? 'en-US' : 'es-MX'
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'MXN',
    }).format(amount)
  }

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CALCULATED':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
      case 'VERIFIED':
        return 'bg-green-500/10 text-green-700 dark:text-green-400'
      case 'DISPUTED':
        return 'bg-red-500/10 text-red-700 dark:text-red-400'
      case 'FINALIZED':
        return 'bg-purple-500/10 text-purple-700 dark:text-purple-400'
      default:
        return 'bg-muted/50 text-muted-foreground'
    }
  }

  if (metricsLoading || monthlyLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading profit analytics...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 bg-background">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{t('profitAnalytics.title', 'Profit Analytics')}</h1>
          <p className="text-muted-foreground">{t('profitAnalytics.subtitle', "Track Avoqado's profit margins and cost management")}</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" className="flex items-center space-x-2">
            <Download className="w-4 h-4" />
            <span>{t('profitAnalytics.exportData', 'Export Data')}</span>
          </Button>
          <Button variant="outline" className="flex items-center space-x-2">
            <Calculator className="w-4 h-4" />
            <span>{t('profitAnalytics.recalculate', 'Recalculate')}</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="w-5 h-5" />
            <span>{t('profitAnalytics.filtersTitle', 'Filters & Date Range')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Date Range */}
            <div className="flex items-center space-x-2">
              <Label htmlFor="startDate">{t('filters.from', 'From')}</Label>
              <Input
                id="startDate"
                type="date"
                value={dateRange.startDate}
                onChange={e => handleDateRangeChange('startDate', e.target.value)}
                className="w-40"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="endDate">{t('filters.to', 'To')}</Label>
              <Input
                id="endDate"
                type="date"
                value={dateRange.endDate}
                onChange={e => handleDateRangeChange('endDate', e.target.value)}
                className="w-40"
              />
            </div>

            {/* Venue Filter */}
            <div className="space-y-2">
              <Label>{t('filters.venue', 'Venue')}</Label>
              <Select value={selectedVenue} onValueChange={setSelectedVenue}>
                <SelectTrigger>
                  <SelectValue placeholder={t('filters.allVenues', 'All Venues')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('filters.allVenues', 'All Venues')}</SelectItem>
                  {venuesLoading && (
                    <SelectItem value="loading" disabled>
                      {t('common.loadingVenues', 'Loading venues...')}
                    </SelectItem>
                  )}
                  {venuesError && (
                    <SelectItem value="error" disabled>
                      {t('common.errorLoadingVenues', 'Error loading venues')}
                    </SelectItem>
                  )}
                  {venues && venues.length === 0 && (
                    <SelectItem value="empty" disabled>
                      {t('common.noVenuesFound', 'No venues found')}
                    </SelectItem>
                  )}
                  {venues?.map(venue => (
                    <SelectItem key={venue.id} value={venue.id}>
                      {venue.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Debug info in development */}
              {process.env.NODE_ENV === 'development' && (
                <div className="text-xs text-muted-foreground">
                  {t('profitAnalytics.debug.info', 'Debug: {{count}} venues loaded, Loading: {{loading}}', {
                    count: venues?.length || 0,
                    loading: venuesLoading ? t('common.yes', 'Yes') : t('common.no', 'No')
                  })}
                  {venuesError && <div className="text-red-500">{t('profitAnalytics.debug.error', 'Error: {{error}}', { error: String(venuesError) })}</div>}
                </div>
              )}
            </div>

            {/* Provider Filter */}
            <div className="space-y-2">
              <Label>{t('filters.provider', 'Provider')}</Label>
              <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                <SelectTrigger>
                  <SelectValue placeholder={t('filters.allProviders', 'All Providers')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('filters.allProviders', 'All Providers')}</SelectItem>
                  {providers?.map(provider => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quick Ranges */}
            <div className="flex flex-col space-y-2">
              <Label>{t('profitAnalytics.quickRange', 'Quick Range')}</Label>
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" onClick={() => setQuickRange(7)}>{t('profitAnalytics.7days', '7D')}</Button>
                <Button variant="outline" size="sm" onClick={() => setQuickRange(30)}>{t('profitAnalytics.30days', '30D')}</Button>
                <Button variant="outline" size="sm" onClick={() => setQuickRange(90)}>{t('profitAnalytics.90days', '90D')}</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('profitAnalytics.totalGrossProfit', 'Total Gross Profit')}</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(profitMetrics?.totalGrossProfit || 0)}
            </div>
            <div className="flex items-center text-xs text-muted-foreground">
              {profitMetrics?.profitGrowth !== undefined && (
                <>
                  {profitMetrics.profitGrowth >= 0 ? (
                    <TrendingUp className="w-3 h-3 mr-1 text-green-500" />
                  ) : (
                    <TrendingDown className="w-3 h-3 mr-1 text-red-500" />
                  )}
                  <span className={profitMetrics.profitGrowth >= 0 ? 'text-green-500' : 'text-red-500'}>
                    {formatPercentage(profitMetrics.profitGrowth)}
                  </span>
                  <span className="ml-1">vs last period</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('profitAnalytics.averageProfitMargin', 'Average Profit Margin')}</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {((profitMetrics?.averageProfitMargin || 0) * 100).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Profit / Revenue ratio
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('profitAnalytics.providerCosts', 'Provider Costs')}</CardTitle>
            <ArrowDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {formatCurrency(profitMetrics?.totalProviderCosts || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              What we pay providers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('profitAnalytics.venueCharges', 'Venue Charges')}</CardTitle>
            <ArrowUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(profitMetrics?.totalVenueCharges || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              What we charge venues
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analysis */}
      <Tabs defaultValue="venues" className="space-y-4">
        <TabsList>
          <TabsTrigger value="venues">{t('profitAnalytics.tabs.venues', 'Venue Profitability')}</TabsTrigger>
          <TabsTrigger value="providers">{t('profitAnalytics.tabs.providers', 'Provider Costs')}</TabsTrigger>
          <TabsTrigger value="monthly">{t('profitAnalytics.tabs.monthly', 'Monthly Analysis')}</TabsTrigger>
          <TabsTrigger value="cost-structures">{t('profitAnalytics.tabs.costStructures', 'Cost Structures')}</TabsTrigger>
        </TabsList>

        <TabsContent value="venues" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('profitAnalytics.venueAnalysis.title', 'Venue Profit Analysis')}</CardTitle>
              <CardDescription>{t('profitAnalytics.venueAnalysis.description', 'Profit performance by venue')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {profitMetrics?.topVenues?.map((venue, index) => (
                  <div key={venue.venueId} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-100 dark:bg-blue-950/50 rounded-full flex items-center justify-center">
                        <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">#{index + 1}</span>
                      </div>
                      <div>
                        <p className="font-medium">{venue.venueName}</p>
                        <p className="text-sm text-muted-foreground">
                          {venue.transactionCount} txns • {formatCurrency(venue.totalVolume)} volume
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-600 dark:text-green-400">
                        {formatCurrency(venue.totalProfit)}
                      </p>
                      <div className="flex items-center space-x-2">
                        <p className="text-sm text-muted-foreground">
                          {(venue.profitMargin * 100).toFixed(1)}% margin
                        </p>
                        {venue.growth >= 0 ? (
                          <ArrowUp className="w-3 h-3 text-green-500" />
                        ) : (
                          <ArrowDown className="w-3 h-3 text-red-500" />
                        )}
                        <span className={`text-xs ${venue.growth >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {formatPercentage(venue.growth)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="providers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Provider Cost Analysis</CardTitle>
              <CardDescription>Cost breakdown by payment provider</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {profitMetrics?.topProviders?.map(provider => (
                  <div key={provider.providerCode} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">{provider.providerName}</p>
                      <p className="text-sm text-muted-foreground">
                        {provider.totalTransactions} transactions • {(provider.averageRate * 100).toFixed(2)}% avg rate
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-red-600 dark:text-red-400">
                        {formatCurrency(provider.totalCosts)}
                      </p>
                      <div className="w-24 mt-1">
                        <Progress value={provider.share * 100} className="h-2" />
                        <p className="text-xs text-muted-foreground mt-1">
                          {(provider.share * 100).toFixed(1)}% share
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Profit Summary</CardTitle>
              <CardDescription>Monthly aggregated profit data by venue</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('profitAnalytics.table.venue', 'Venue')}</TableHead>
                    <TableHead>{t('profitAnalytics.table.period', 'Period')}</TableHead>
                    <TableHead>{t('profitAnalytics.table.volume', 'Volume')}</TableHead>
                    <TableHead>{t('profitAnalytics.table.transactions', 'Transactions')}</TableHead>
                    <TableHead>{t('profitAnalytics.table.providerCosts', 'Provider Costs')}</TableHead>
                    <TableHead>{t('profitAnalytics.table.venueCharges', 'Venue Charges')}</TableHead>
                    <TableHead>{t('profitAnalytics.table.grossProfit', 'Gross Profit')}</TableHead>
                    <TableHead>{t('profitAnalytics.table.margin', 'Margin')}</TableHead>
                    <TableHead>{t('profitAnalytics.table.status', 'Status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyData?.map(data => (
                    <TableRow key={`${data.venueId}-${data.year}-${data.month}`}>
                      <TableCell className="font-medium">{data.venueName}</TableCell>
                      <TableCell>{data.year}/{data.month.toString().padStart(2, '0')}</TableCell>
                      <TableCell>{formatCurrency(data.totalVolume)}</TableCell>
                      <TableCell>{data.totalTransactions}</TableCell>
                      <TableCell className="text-red-600 dark:text-red-400">
                        {formatCurrency(data.totalProviderCosts)}
                      </TableCell>
                      <TableCell className="text-green-600 dark:text-green-400">
                        {formatCurrency(data.totalVenueCharges)}
                      </TableCell>
                      <TableCell className="font-semibold text-green-600 dark:text-green-400">
                        {formatCurrency(data.totalGrossProfit)}
                      </TableCell>
                      <TableCell>{(data.averageProfitMargin * 100).toFixed(1)}%</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(data.status)}>
                          {data.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cost-structures" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Current Cost Structures</CardTitle>
              <CardDescription>Active cost structures by provider and merchant account</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {costAnalysis?.map(provider => (
                  <div key={provider.providerId} className="border rounded-lg p-4">
                    <h4 className="font-semibold mb-4">{provider.providerName}</h4>
                    <div className="space-y-3">
                      {provider.merchantAccounts.map(account => (
                        <div key={account.id} className="bg-muted/30 rounded p-3">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-medium">{account.alias}</p>
                              <p className="text-sm text-muted-foreground">
                                {formatCurrency(account.transactionVolume)} volume
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-red-600 dark:text-red-400">
                                {formatCurrency(account.totalCosts)}
                              </p>
                              <p className="text-sm text-muted-foreground">total costs</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                            <div>
                              <span className="text-muted-foreground">Debit:</span>
                              <span className="ml-1">{(account.currentCosts.debitRate * 100).toFixed(2)}%</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Credit:</span>
                              <span className="ml-1">{(account.currentCosts.creditRate * 100).toFixed(2)}%</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Amex:</span>
                              <span className="ml-1">{(account.currentCosts.amexRate * 100).toFixed(2)}%</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">International:</span>
                              <span className="ml-1">{(account.currentCosts.internationalRate * 100).toFixed(2)}%</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Fixed:</span>
                              <span className="ml-1">{formatCurrency(account.currentCosts.fixedCostPerTransaction)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Monthly:</span>
                              <span className="ml-1">{formatCurrency(account.currentCosts.monthlyFee)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default ProfitAnalyticsDashboard