import api from '@/api'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { useTokenBudget, formatTokenCount, getTokenWarningLevel } from '@/hooks/use-token-budget'
import {
  purchaseTokens,
  updateAutoRecharge,
  type AutoRechargeSettings,
} from '@/services/chatService'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Loader2, Settings2, Zap } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AddTokensDialog } from './AddTokensDialog'

interface TokenBudgetSectionProps {
  venueId: string
}

export function TokenBudgetSection({ venueId }: TokenBudgetSectionProps) {
  const { t, i18n } = useTranslation('billing')
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Fetch token budget status
  const { data: tokenBudget, isLoading, error } = useTokenBudget()

  // Local state for dialog and settings
  const [showSettings, setShowSettings] = useState(false)
  const [showAddFundsDialog, setShowAddFundsDialog] = useState(false)

  // Local state for auto-recharge settings
  const [autoRechargeEnabled, setAutoRechargeEnabled] = useState(false)
  const [autoRechargeThreshold, setAutoRechargeThreshold] = useState(1000)
  const [autoRechargeAmount, setAutoRechargeAmount] = useState(10000)

  // Fetch payment methods with card details for the dialog
  const { data: paymentMethods } = useQuery<Array<{ id: string; card: { brand: string; last4: string } }>>({
    queryKey: ['paymentMethods', venueId],
    queryFn: async () => {
      const response = await api.get(`/api/v1/dashboard/venues/${venueId}/payment-methods`)
      return response.data.data || []
    },
    enabled: !!venueId,
  })

  const hasPaymentMethod = paymentMethods && paymentMethods.length > 0
  const defaultPaymentMethod = paymentMethods?.[0]

  // Purchase mutation
  const purchaseMutation = useMutation({
    mutationFn: ({ tokenAmount, paymentMethodId }: { tokenAmount: number; paymentMethodId: string }) =>
      purchaseTokens(tokenAmount, paymentMethodId),
    onSuccess: (_, { tokenAmount }) => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'tokenBudget'] })
      setShowAddFundsDialog(false)
      toast({
        title: t('tokenBudget.purchaseSuccess'),
        description: t('tokenBudget.purchaseSuccessDesc', { amount: formatTokenCount(tokenAmount) }),
      })
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error || error.message
      toast({
        title: t('tokenBudget.purchaseError'),
        description: message,
        variant: 'destructive',
      })
    },
  })

  // Auto-recharge settings mutation
  const autoRechargeMutation = useMutation({
    mutationFn: (settings: AutoRechargeSettings) => updateAutoRecharge(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'tokenBudget'] })
      toast({
        title: t('tokenBudget.settingsUpdated'),
        description: t('tokenBudget.settingsUpdatedDesc'),
      })
    },
    onError: (error: Error) => {
      toast({
        title: t('tokenBudget.settingsError'),
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  // Format currency - use venue's currency from pricing config (default to MXN)
  const venueCurrency = tokenBudget?.pricing?.currency || 'MXN'
  const formatCurrency = (amount: number, currency: string = venueCurrency) => {
    return new Intl.NumberFormat(i18n.language, {
      style: 'currency',
      currency,
    }).format(amount)
  }

  // Calculate price for token amount
  const calculatePrice = (tokens: number): number => {
    if (!tokenBudget?.pricing) return 0
    return (tokens / 1000) * tokenBudget.pricing.pricePerThousandTokens
  }

  // Handle save auto-recharge settings
  const handleSaveSettings = () => {
    autoRechargeMutation.mutate({
      enabled: autoRechargeEnabled,
      threshold: autoRechargeThreshold,
      amount: autoRechargeAmount,
    })
  }

  const warningLevel = getTokenWarningLevel(tokenBudget)

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            {t('tokenBudget.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (error || !tokenBudget) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            {t('tokenBudget.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{t('tokenBudget.loadError')}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              {t('tokenBudget.title')}
            </CardTitle>
            <CardDescription className="mt-1">{t('tokenBudget.subtitle')}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowAddFundsDialog(true)}
              disabled={!hasPaymentMethod}
              size="sm"
            >
              {t('tokenBudget.addFundsButton')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              className="gap-2"
            >
              <Settings2 className="h-4 w-4" />
              {t('tokenBudget.settings')}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Usage */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{t('tokenBudget.currentUsage')}</p>
              <p className="text-xs text-muted-foreground">
                {t('tokenBudget.freeTokensIncluded', { amount: formatTokenCount(tokenBudget.pricing.freeTokensPerMonth) })}
              </p>
            </div>
            <Badge
              variant={warningLevel === 'normal' ? 'secondary' : 'outline'}
              className={
                warningLevel === 'overage'
                  ? 'border-red-500 text-red-600 dark:text-red-400'
                  : warningLevel === 'danger'
                    ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                    : warningLevel === 'warning'
                      ? 'border-yellow-500 text-yellow-600 dark:text-yellow-400'
                      : ''
              }
            >
              {warningLevel === 'overage' && <AlertTriangle className="h-3 w-3 mr-1" />}
              {/* Show different message based on whether user has purchased tokens */}
              {tokenBudget.extraTokensBalance > 0 && tokenBudget.freeTokensRemaining === 0
                ? `${formatTokenCount(tokenBudget.totalAvailable)} ${t('tokenBudget.totalAvailable').toLowerCase()}`
                : `${tokenBudget.percentageUsed}% ${t('tokenBudget.used')}`
              }
            </Badge>
          </div>

          {/* Progress bar - shows remaining tokens as % of monthly allocation */}
          {(() => {
            // Calculate a meaningful progress value
            // Show what % of the monthly free allocation is still available
            const freeTokens = tokenBudget.pricing.freeTokensPerMonth
            const remainingPct = Math.min(100, (tokenBudget.totalAvailable / freeTokens) * 100)

            return (
              <Progress
                value={remainingPct}
                className={`h-3 ${
                  warningLevel === 'overage'
                    ? '[&>div]:bg-red-500'
                    : warningLevel === 'danger'
                      ? '[&>div]:bg-orange-500'
                      : warningLevel === 'warning'
                        ? '[&>div]:bg-yellow-500'
                        : '[&>div]:bg-green-500'
                }`}
              />
            )
          })()}

          {/* Token breakdown */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold">{formatTokenCount(tokenBudget.freeTokensRemaining)}</p>
              <p className="text-xs text-muted-foreground">{t('tokenBudget.freeRemaining')}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold">{formatTokenCount(tokenBudget.totalTokensPurchased || 0)}</p>
              <p className="text-xs text-muted-foreground">{t('tokenBudget.purchased')}</p>
            </div>
            <div className="p-3 rounded-lg bg-primary/10">
              <p className="text-2xl font-bold text-primary">{formatTokenCount(tokenBudget.totalAvailable)}</p>
              <p className="text-xs text-muted-foreground">{t('tokenBudget.totalAvailable')}</p>
            </div>
          </div>

          {/* Overage warning */}
          {tokenBudget.isInOverage && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {t('tokenBudget.overageWarning', {
                  tokens: formatTokenCount(tokenBudget.overageTokensUsed),
                  cost: formatCurrency(tokenBudget.overageCost),
                })}
              </AlertDescription>
            </Alert>
          )}

          {/* Warning message from API */}
          {tokenBudget.warning && !tokenBudget.isInOverage && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{tokenBudget.warning}</AlertDescription>
            </Alert>
          )}
        </div>

        {/* No Payment Method Warning */}
        {!hasPaymentMethod && (
          <Alert className="border-t pt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{t('tokenBudget.noPaymentMethod')}</AlertDescription>
          </Alert>
        )}

        {/* Auto-Recharge Settings */}
        {showSettings && (
          <div className="border-t pt-6 space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              {t('tokenBudget.autoRechargeTitle')}
            </h4>
            <p className="text-sm text-muted-foreground">{t('tokenBudget.autoRechargeDesc')}</p>

            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
              <div>
                <p className="font-medium">{t('tokenBudget.enableAutoRecharge')}</p>
                <p className="text-sm text-muted-foreground">{t('tokenBudget.enableAutoRechargeDesc')}</p>
              </div>
              <Switch
                checked={autoRechargeEnabled}
                onCheckedChange={setAutoRechargeEnabled}
              />
            </div>

            {autoRechargeEnabled && (
              <div className="grid gap-4 md:grid-cols-2 p-4 rounded-lg border">
                <div className="space-y-2">
                  <Label htmlFor="recharge-threshold">{t('tokenBudget.threshold')}</Label>
                  <Input
                    id="recharge-threshold"
                    type="number"
                    min={100}
                    step={100}
                    value={autoRechargeThreshold}
                    onChange={(e) => setAutoRechargeThreshold(parseInt(e.target.value) || 100)}
                  />
                  <p className="text-xs text-muted-foreground">{t('tokenBudget.thresholdDesc')}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recharge-amount">{t('tokenBudget.rechargeAmount')}</Label>
                  <Input
                    id="recharge-amount"
                    type="number"
                    min={1000}
                    step={1000}
                    value={autoRechargeAmount}
                    onChange={(e) => setAutoRechargeAmount(parseInt(e.target.value) || 1000)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('tokenBudget.rechargeAmountDesc', {
                      price: formatCurrency(calculatePrice(autoRechargeAmount)),
                    })}
                  </p>
                </div>
              </div>
            )}

            <Button
              onClick={handleSaveSettings}
              disabled={autoRechargeMutation.isPending}
              variant="outline"
              className="w-full"
            >
              {autoRechargeMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {t('tokenBudget.saveSettings')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>

    {/* Add Tokens Dialog */}
    <AddTokensDialog
      open={showAddFundsDialog}
      onOpenChange={setShowAddFundsDialog}
      tokenBudget={tokenBudget}
      onPurchase={(amount, paymentMethodId) =>
        purchaseMutation.mutate({ tokenAmount: amount, paymentMethodId })
      }
      isPurchasing={purchaseMutation.isPending}
      defaultPaymentMethod={defaultPaymentMethod}
    />
    </>
  )
}
