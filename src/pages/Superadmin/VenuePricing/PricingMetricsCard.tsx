import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, AlertTriangle, CheckCircle2, DollarSign } from 'lucide-react'

interface PricingMetrics {
  totalStructures: number
  activeStructures: number
  averageMargin: number
  lowestMargin: number
  highestMargin: number
  negativeMargins: number
}

interface PricingMetricsCardProps {
  metrics: PricingMetrics
}

export const PricingMetricsCard: React.FC<PricingMetricsCardProps> = ({ metrics }) => {
  const getMarginStatus = (margin: number) => {
    if (margin < 0) return { color: 'text-red-600 dark:text-red-400', label: 'Critical', icon: AlertTriangle }
    if (margin < 0.5) return { color: 'text-yellow-600 dark:text-yellow-400', label: 'Low', icon: AlertTriangle }
    if (margin < 1.5) return { color: 'text-blue-600 dark:text-blue-400', label: 'Good', icon: CheckCircle2 }
    return { color: 'text-green-600 dark:text-green-400', label: 'Excellent', icon: CheckCircle2 }
  }

  const avgStatus = getMarginStatus(metrics.averageMargin)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Structures */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pricing Structures</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.totalStructures}</div>
          <p className="text-xs text-muted-foreground">
            {metrics.activeStructures} active
          </p>
        </CardContent>
      </Card>

      {/* Average Margin */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Profit Margin</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${avgStatus.color}`}>
            +{metrics.averageMargin.toFixed(2)}%
          </div>
          <p className="text-xs text-muted-foreground">
            {avgStatus.label} margin
          </p>
        </CardContent>
      </Card>

      {/* Margin Range */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Margin Range</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            <span className="text-green-600">+{metrics.highestMargin.toFixed(2)}%</span>
            <span className="text-muted-foreground text-sm mx-1">to</span>
            <span className={metrics.lowestMargin < 0 ? 'text-red-600' : 'text-yellow-600'}>
              {metrics.lowestMargin >= 0 ? '+' : ''}{metrics.lowestMargin.toFixed(2)}%
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Across all structures
          </p>
        </CardContent>
      </Card>

      {/* Warnings */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Warnings</CardTitle>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {metrics.negativeMargins > 0 ? (
            <>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {metrics.negativeMargins}
              </div>
              <p className="text-xs text-red-600 dark:text-red-400">
                Negative margins detected!
              </p>
            </>
          ) : (
            <>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                0
              </div>
              <p className="text-xs text-muted-foreground">
                No issues found
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
