import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, Calculator } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Currency } from '@/utils/currency'
import { VenuePricingStructure, ProviderCostStructure } from '@/services/paymentProvider.service'

interface ProfitCalculatorProps {
  venuePricing?: VenuePricingStructure | null
  costStructure?: (ProviderCostStructure & { accountType: string }) | null
}

export const ProfitCalculator: React.FC<ProfitCalculatorProps> = ({ venuePricing, costStructure }) => {
  const { t } = useTranslation()
  const [transactionAmount, setTransactionAmount] = useState('100')
  const [cardType, setCardType] = useState<'debit' | 'credit' | 'amex' | 'international'>('debit')

  // Calculate costs and profit
  const amount = parseFloat(transactionAmount) || 0

  // Get rates based on card type
  const providerRate = costStructure
    ? cardType === 'debit'
      ? costStructure.debitRate
      : cardType === 'credit'
      ? costStructure.creditRate
      : cardType === 'amex'
      ? costStructure.amexRate
      : costStructure.internationalRate
    : 0

  const venueRate = venuePricing
    ? cardType === 'debit'
      ? venuePricing.debitRate
      : cardType === 'credit'
      ? venuePricing.creditRate
      : cardType === 'amex'
      ? venuePricing.amexRate
      : venuePricing.internationalRate
    : 0

  // Calculate fees
  const providerPercentageFee = amount * providerRate
  const providerFixedFee = costStructure?.fixedCostPerTransaction || 0
  const totalProviderCost = providerPercentageFee + providerFixedFee

  const venuePercentageFee = amount * venueRate
  const venueFixedFee = venuePricing?.fixedFeePerTransaction || 0
  const totalVenueCharge = venuePercentageFee + venueFixedFee

  const profit = totalVenueCharge - totalProviderCost
  const profitMargin = totalVenueCharge > 0 ? (profit / totalVenueCharge) * 100 : 0

  const isConfigured = venuePricing && costStructure

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Calculator className="w-5 h-5" />
          <span>{t('venuePaymentConfig.profitCalculator')}</span>
        </CardTitle>
        <CardDescription>{t('venuePaymentConfig.profitCalculatorDesc')}</CardDescription>
      </CardHeader>
      <CardContent>
        {!isConfigured ? (
          <div className="text-sm text-muted-foreground">
            {t('venuePaymentConfig.configureToCalculate')}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Input Controls */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">{t('venuePaymentConfig.transactionAmount')}</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={transactionAmount}
                    onChange={(e) => setTransactionAmount(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cardType">{t('venuePaymentConfig.cardType')}</Label>
                <select
                  id="cardType"
                  value={cardType}
                  onChange={(e) => setCardType(e.target.value as typeof cardType)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="debit">{t('venuePaymentConfig.debit')}</option>
                  <option value="credit">{t('venuePaymentConfig.credit')}</option>
                  <option value="amex">{t('venuePaymentConfig.amex')}</option>
                  <option value="international">{t('venuePaymentConfig.international')}</option>
                </select>
              </div>
            </div>

            {/* Calculation Breakdown */}
            <div className="space-y-4">
              {/* Provider Cost */}
              <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-red-900 dark:text-red-100">
                    {t('venuePaymentConfig.providerCost')}
                  </span>
                  <Badge variant="outline" className="bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200">
                    -{Currency(totalProviderCost)}
                  </Badge>
                </div>
                <div className="text-xs text-red-700 dark:text-red-300 space-y-1">
                  <div>
                    {(providerRate * 100).toFixed(2)}% × {Currency(amount)} = {Currency(providerPercentageFee)}
                  </div>
                  {providerFixedFee > 0 && <div>+ {Currency(providerFixedFee)} {t('venuePaymentConfig.fixedFee')}</div>}
                </div>
              </div>

              {/* Venue Charge */}
              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    {t('venuePaymentConfig.venueCharge')}
                  </span>
                  <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200">
                    +{Currency(totalVenueCharge)}
                  </Badge>
                </div>
                <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                  <div>
                    {(venueRate * 100).toFixed(2)}% × {Currency(amount)} = {Currency(venuePercentageFee)}
                  </div>
                  {venueFixedFee > 0 && <div>+ {Currency(venueFixedFee)} {t('venuePaymentConfig.fixedFee')}</div>}
                </div>
              </div>

              {/* Net Profit */}
              <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="w-5 h-5 text-green-700 dark:text-green-300" />
                    <span className="text-sm font-medium text-green-900 dark:text-green-100">
                      {t('venuePaymentConfig.netProfit')}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-700 dark:text-green-300">{Currency(profit)}</div>
                    <div className="text-xs text-green-600 dark:text-green-400">
                      {profitMargin.toFixed(2)}% {t('venuePaymentConfig.margin')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
