import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, DollarSign } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Currency } from '@/utils/currency'
import { ProviderCostStructure } from '@/services/paymentProvider.service'

interface CostStructuresDisplayProps {
  costStructures: (ProviderCostStructure & {
    accountType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY'
  })[]
  isLoading?: boolean
}

export const CostStructuresDisplay: React.FC<CostStructuresDisplayProps> = ({ costStructures, isLoading }) => {
  const { t } = useTranslation()

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('venuePaymentConfig.providerCosts')}</CardTitle>
          <CardDescription>{t('venuePaymentConfig.providerCostsDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
        </CardContent>
      </Card>
    )
  }

  if (costStructures.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('venuePaymentConfig.providerCosts')}</CardTitle>
          <CardDescription>{t('venuePaymentConfig.providerCostsDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{t('venuePaymentConfig.noCostStructures')}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('venuePaymentConfig.providerCosts')}</CardTitle>
        <CardDescription>{t('venuePaymentConfig.providerCostsDesc')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {costStructures.map((cost, index) => (
            <div key={cost.id} className="space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Badge variant={cost.accountType === 'PRIMARY' ? 'default' : 'secondary'}>
                    {t(`common.${cost.accountType.toLowerCase()}`)}
                  </Badge>
                  <span className="font-medium">{cost.merchantAccount?.displayName || cost.merchantAccount?.alias}</span>
                  {cost.merchantAccount?.provider && (
                    <span className="text-sm text-muted-foreground">({cost.merchantAccount.provider.name})</span>
                  )}
                </div>
                {!cost.active && <Badge variant="outline">{t('common.inactive')}</Badge>}
              </div>

              {/* Rates Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">{t('venuePaymentConfig.debitRate')}</div>
                  <div className="text-sm font-medium">{(cost.debitRate * 100).toFixed(2)}%</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">{t('venuePaymentConfig.creditRate')}</div>
                  <div className="text-sm font-medium">{(cost.creditRate * 100).toFixed(2)}%</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">{t('venuePaymentConfig.amexRate')}</div>
                  <div className="text-sm font-medium">{(cost.amexRate * 100).toFixed(2)}%</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">{t('venuePaymentConfig.internationalRate')}</div>
                  <div className="text-sm font-medium">{(cost.internationalRate * 100).toFixed(2)}%</div>
                </div>
              </div>

              {/* Fixed Fee */}
              {cost.fixedCostPerTransaction && (
                <div className="flex items-center space-x-2 text-sm">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{t('venuePaymentConfig.fixedFee')}:</span>
                  <span className="font-medium">{Currency(cost.fixedCostPerTransaction)}</span>
                </div>
              )}

              {/* Divider between cost structures */}
              {index < costStructures.length - 1 && <div className="border-t border-border" />}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
