import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { DollarSign, TrendingUp, CreditCard, Percent, Info } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { paymentProviderAPI } from '@/services/paymentProvider.service'
import { useTranslation } from 'react-i18next'
import { Currency } from '@/utils/currency'

const PaymentAnalytics: React.FC = () => {
  const { t } = useTranslation()

  const { data: metrics, isLoading } = useQuery({
    queryKey: ['payment-analytics-profit-metrics'],
    queryFn: () => paymentProviderAPI.getProfitMetrics(),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">{t('common.loading')}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">{t('paymentAnalytics.title')}</h1>
        <p className="text-muted-foreground">{t('paymentAnalytics.subtitle')}</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('paymentAnalytics.metrics.totalVolume')}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Currency(metrics?.totalVolume || 0)}</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.totalTransactions || 0} {t('paymentAnalytics.metrics.transactions')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('paymentAnalytics.metrics.totalProfit')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{Currency(metrics?.totalProfit || 0)}</div>
            <p className="text-xs text-muted-foreground">
              {t('paymentAnalytics.metrics.providerCost')}: {Currency(metrics?.totalProviderCost || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('paymentAnalytics.metrics.averageMargin')}</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {((metrics?.averageMargin || 0) * 100).toFixed(2)}%
            </div>
            <p className="text-xs text-muted-foreground">{t('paymentAnalytics.metrics.marginDesc')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('paymentAnalytics.metrics.avgTransaction')}</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Currency(metrics?.averageTransactionSize || 0)}</div>
            <p className="text-xs text-muted-foreground">{t('paymentAnalytics.metrics.perTransaction')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Fixed Fees Information */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          {t('paymentAnalytics.fixedFeesInfo')}
        </AlertDescription>
      </Alert>

      {/* Card Type Breakdown */}
      {metrics?.byCardType && metrics.byCardType.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('paymentAnalytics.cardTypes.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics.byCardType.map(cardType => (
                <div key={cardType.type} className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium">{cardType.type}</div>
                    <div className="text-sm text-muted-foreground">
                      {cardType.count} {t('paymentAnalytics.cardTypes.transactions')} • {Currency(cardType.avgSize)} {t('paymentAnalytics.cardTypes.average')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{Currency(cardType.volume)}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Venues */}
      {metrics?.topVenues && metrics.topVenues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('paymentAnalytics.topVenues.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics.topVenues.map(venue => (
                <div key={venue.venueId} className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium">{venue.venueName}</div>
                    <div className="text-sm text-muted-foreground">
                      {venue.transactions} {t('paymentAnalytics.topVenues.transactions')} • {((venue.margin || 0) * 100).toFixed(1)}% {t('paymentAnalytics.topVenues.margin')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-green-600">{Currency(venue.profit)}</div>
                    <div className="text-sm text-muted-foreground">{Currency(venue.volume)} {t('paymentAnalytics.topVenues.volume')}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default PaymentAnalytics
