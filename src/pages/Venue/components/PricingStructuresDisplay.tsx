import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertCircle, Building2, DollarSign, Edit, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Currency } from '@/utils/currency'
import { VenuePricingStructure } from '@/services/paymentProvider.service'
import { useVenueDateTime } from '@/utils/datetime'

interface PricingStructuresDisplayProps {
  pricingStructures: VenuePricingStructure[]
  isLoading?: boolean
  onEdit?: (pricing: VenuePricingStructure) => void
  onCreate?: (accountType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY') => void
  showActions?: boolean
}

export const PricingStructuresDisplay: React.FC<PricingStructuresDisplayProps> = ({
  pricingStructures,
  isLoading,
  onEdit,
  onCreate,
  showActions = true,
}) => {
  const { t } = useTranslation(['payment', 'common'])
  const { formatDate } = useVenueDateTime()

  // Group by account type
  const groupedPricing = {
    PRIMARY: pricingStructures.filter(p => p.accountType === 'PRIMARY' && p.active),
    SECONDARY: pricingStructures.filter(p => p.accountType === 'SECONDARY' && p.active),
    TERTIARY: pricingStructures.filter(p => p.accountType === 'TERTIARY' && p.active),
  }

  const renderPricingCard = (accountType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY', pricing: VenuePricingStructure | null) => {
    return (
      <Card key={accountType}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Building2 className="w-5 h-5" />
              <span>{t(`venuePaymentConfig.${accountType.toLowerCase()}Account`)}</span>
            </CardTitle>
            <Badge variant={accountType === 'PRIMARY' ? 'default' : 'secondary'}>
              {t(`common:${accountType.toLowerCase()}`)}
            </Badge>
          </div>
          <CardDescription>{t('venuePaymentConfig.venuePricingDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {pricing ? (
            <div className="space-y-4">
              {/* Header with status and actions */}
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-300">
                  {t('venuePaymentConfig.currentPricing')}
                </Badge>
                {showActions && onEdit && (
                  <Button variant="ghost" size="sm" onClick={() => onEdit(pricing)}>
                    <Edit className="w-4 h-4 mr-1" />
                    {t('venuePaymentConfig.editPricing')}
                  </Button>
                )}
              </div>

              {/* Rates Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">{t('venuePaymentConfig.debitRate')}</div>
                  <div className="text-lg font-bold text-foreground">{(pricing.debitRate * 100).toFixed(2)}%</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">{t('venuePaymentConfig.creditRate')}</div>
                  <div className="text-lg font-bold text-foreground">{(pricing.creditRate * 100).toFixed(2)}%</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">{t('venuePaymentConfig.amexRate')}</div>
                  <div className="text-lg font-bold text-foreground">{(pricing.amexRate * 100).toFixed(2)}%</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">{t('venuePaymentConfig.internationalRate')}</div>
                  <div className="text-lg font-bold text-foreground">{(pricing.internationalRate * 100).toFixed(2)}%</div>
                </div>
              </div>

              {/* Fixed Fee */}
              {pricing.fixedFeePerTransaction && (
                <div className="flex items-center space-x-2 p-3 bg-muted rounded-md">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{t('venuePaymentConfig.fixedFee')}:</span>
                  <span className="text-sm font-medium">{Currency(pricing.fixedFeePerTransaction)}</span>
                </div>
              )}

              {/* Effective dates */}
              <div className="text-xs text-muted-foreground">
                {t('venuePaymentConfig.effectiveFrom')}: {formatDate(pricing.effectiveFrom)}
                {pricing.effectiveTo && ` - ${formatDate(pricing.effectiveTo)}`}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{t('venuePaymentConfig.noPricingStructures')}</AlertDescription>
              </Alert>
              {showActions && onCreate && (
                <Button variant="outline" className="w-full" onClick={() => onCreate(accountType)}>
                  <Plus className="w-4 h-4 mr-2" />
                  {t('venuePaymentConfig.createPricing')}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {['PRIMARY', 'SECONDARY', 'TERTIARY'].map(type => (
          <Card key={type}>
            <CardHeader>
              <CardTitle>{t(`venuePaymentConfig.${type.toLowerCase()}Account`)}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">{t('common:loading')}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {renderPricingCard('PRIMARY', groupedPricing.PRIMARY[0] || null)}
      {renderPricingCard('SECONDARY', groupedPricing.SECONDARY[0] || null)}
      {renderPricingCard('TERTIARY', groupedPricing.TERTIARY[0] || null)}
    </div>
  )
}
