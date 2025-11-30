import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, RefreshCw, Package, AlertTriangle, TrendingUp, ChevronRight, ExternalLink } from 'lucide-react'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { modifierInventoryApi, type ModifierLowStockItem, type ModifierUsageStats } from '@/services/inventory.service'
import { Currency } from '@/utils/currency'
import { Link } from 'react-router-dom'
import { subDays, format } from 'date-fns'

type DateRange = '7d' | '30d' | '90d'

export function ModifierInventoryAnalytics() {
  const { t } = useTranslation('inventory')
  const { venueId } = useCurrentVenue()
  const [dateRange, setDateRange] = useState<DateRange>('30d')

  const getDateRange = (range: DateRange) => {
    const endDate = new Date()
    const startDate = subDays(endDate, range === '7d' ? 7 : range === '30d' ? 30 : 90)
    return {
      startDate: format(startDate, "yyyy-MM-dd'T'HH:mm:ss'Z'"),
      endDate: format(endDate, "yyyy-MM-dd'T'HH:mm:ss'Z'"),
    }
  }

  const {
    data: summary,
    isLoading,
    refetch,
    isRefetching,
    isError,
    error,
  } = useQuery({
    queryKey: ['modifier-inventory-summary', venueId, dateRange],
    queryFn: async () => {
      const { startDate, endDate } = getDateRange(dateRange)
      const response = await modifierInventoryApi.getSummary(venueId, { startDate, endDate })
      return response.data.data
    },
    enabled: !!venueId,
  })

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
          <h3 className="text-lg font-medium mb-2">{t('common.error', 'Error Loading Data')}</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
            {error instanceof Error ? error.message : t('common.errorGeneric', 'An error occurred while loading modifier analytics.')}
          </p>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('common.retry', 'Retry')}
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!summary) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t('modifierAnalytics.title', 'Modifier Inventory Analytics')}</h2>
          <p className="text-sm text-muted-foreground">{t('modifierAnalytics.description', 'Track modifier usage and inventory impact')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={(value: DateRange) => setDateRange(value)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">{t('common.last7Days', 'Last 7 days')}</SelectItem>
              <SelectItem value="30d">{t('common.last30Days', 'Last 30 days')}</SelectItem>
              <SelectItem value="90d">{t('common.last90Days', 'Last 90 days')}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
            <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('modifierAnalytics.totalModifiers', 'Modifiers with Inventory')}</CardDescription>
            <CardTitle className="text-2xl">{summary.totalModifiersWithInventory}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Package className="h-4 w-4" />
              <span>{t('modifierAnalytics.trackingInventory', 'tracking inventory')}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('modifierAnalytics.lowStock', 'Low Stock Alerts')}</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              {summary.totalModifiersLowStock}
              {summary.totalModifiersLowStock > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {t('common.attention', 'Attention')}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              <span>{t('modifierAnalytics.needsRestock', 'needs restock')}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('modifierAnalytics.totalCostImpact', 'Total Cost Impact')}</CardDescription>
            <CardTitle className="text-2xl">{Currency(summary.totalCostImpactPeriod)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span>
                {dateRange === '7d' && t('modifierAnalytics.last7Days', 'last 7 days')}
                {dateRange === '30d' && t('modifierAnalytics.last30Days', 'last 30 days')}
                {dateRange === '90d' && t('modifierAnalytics.last90Days', 'last 90 days')}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Modifiers */}
      {summary.lowStockModifiers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {t('modifierAnalytics.lowStockModifiers', 'Low Stock Modifiers')}
            </CardTitle>
            <CardDescription>{t('modifierAnalytics.lowStockDescription', 'Modifiers with raw materials below reorder point')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {summary.lowStockModifiers.map((item: ModifierLowStockItem) => (
                <div key={item.modifierId} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-destructive/10">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{item.modifierName}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.groupName} • {item.rawMaterialName}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {item.currentStock.toFixed(1)} / {item.reorderPoint.toFixed(1)} {item.unit}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ~{item.estimatedUsesRemaining} {t('modifierAnalytics.usesRemaining', 'uses remaining')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Cost Modifiers */}
      {summary.topCostModifiers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              {t('modifierAnalytics.topCostModifiers', 'Top Cost Modifiers')}
            </CardTitle>
            <CardDescription>{t('modifierAnalytics.topCostDescription', 'Modifiers with highest inventory cost impact')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {summary.topCostModifiers.slice(0, 5).map((item: ModifierUsageStats, index: number) => (
                <div key={item.modifierId} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{item.modifierName}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.groupName}
                        {item.inventoryMode && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            {item.inventoryMode === 'ADDITION' ? t('modifiers.inventory.modeAddition', 'Addition') : t('modifiers.inventory.modeSubstitution', 'Substitution')}
                          </Badge>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{Currency(item.totalCostImpact)}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.timesUsed}x {t('modifierAnalytics.used', 'used')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {summary.topCostModifiers.length > 5 && (
              <div className="mt-4 text-center">
                <Link to="../../menumaker/modifier-groups" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                  {t('modifierAnalytics.viewAllModifiers', 'View all modifiers')}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {summary.totalModifiersWithInventory === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">{t('modifierAnalytics.noModifiersTracked', 'No Modifiers with Inventory Tracking')}</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              {t('modifierAnalytics.noModifiersDescription', 'Configure inventory tracking for modifiers to see usage analytics and cost impact.')}
            </p>
            <Link to="../../menumaker/modifier-groups">
              <Button variant="outline">
                {t('modifierAnalytics.configureModifiers', 'Configure Modifiers')}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
