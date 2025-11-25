import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { formatTokenCount } from '@/hooks/use-token-budget'
import { type TokenBudgetStatus } from '@/services/chatService'
import { CreditCard, Loader2, Pencil } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

interface AddTokensDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tokenBudget: TokenBudgetStatus | undefined
  onPurchase: (amount: number, paymentMethodId: string) => void
  isPurchasing: boolean
  defaultPaymentMethod?: {
    id: string
    card: {
      brand: string
      last4: string
    }
  }
  onChangePaymentMethod?: () => void
}

export function AddTokensDialog({
  open,
  onOpenChange,
  tokenBudget,
  onPurchase,
  isPurchasing,
  defaultPaymentMethod,
  onChangePaymentMethod,
}: AddTokensDialogProps) {
  const { t, i18n } = useTranslation('billing')
  const [amount, setAmount] = useState(20000)

  // Use venue's currency from pricing config (default to MXN)
  const currency = tokenBudget?.pricing?.currency || 'MXN'

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat(i18n.language, { style: 'currency', currency }).format(value)

  const price = tokenBudget?.pricing
    ? (amount / 1000) * tokenBudget.pricing.pricePerThousandTokens
    : 0

  const newBalance = (tokenBudget?.totalAvailable || 0) + amount

  const presetAmounts = [20000, 50000, 100000, 200000]

  const handlePurchase = () => {
    if (amount >= 20000 && defaultPaymentMethod?.id) {
      onPurchase(amount, defaultPaymentMethod.id)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('tokenBudget.addFunds.title')}</DialogTitle>
          <DialogDescription>
            {t('tokenBudget.addFunds.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Amount selector */}
          <div className="space-y-3">
            <Label>{t('tokenBudget.tokenAmount')}</Label>
            <div className="flex gap-2">
              {presetAmounts.map(val => (
                <Button
                  key={val}
                  variant={amount === val ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAmount(val)}
                  className="flex-1"
                >
                  {formatTokenCount(val)}
                </Button>
              ))}
            </div>
            <Input
              type="number"
              value={amount}
              onChange={e => setAmount(Number(e.target.value) || 0)}
              min={20000}
              step={10000}
              placeholder={t('tokenBudget.addFunds.customAmount')}
            />
          </div>

          {/* Summary section - Claude.ai style */}
          <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {t('tokenBudget.addFunds.balanceAfter')}
              </span>
              <span className="font-medium">
                {formatTokenCount(newBalance)} tokens
              </span>
            </div>
            <Separator />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {t('tokenBudget.addFunds.tokensToAdd')}
              </span>
              <span className="font-medium">{formatTokenCount(amount)} tokens</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {t('tokenBudget.addFunds.pricePerToken')}
              </span>
              <span className="font-medium">
                {tokenBudget?.pricing
                  ? formatCurrency(tokenBudget.pricing.pricePerThousandTokens / 1000)
                  : '-'}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between font-medium">
              <span>{t('tokenBudget.addFunds.totalToPay')}</span>
              <span className="text-lg">{formatCurrency(price)}</span>
            </div>
          </div>

          {/* Payment method */}
          {defaultPaymentMethod && (
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    {t('tokenBudget.addFunds.paymentMethod')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {defaultPaymentMethod.card.brand} •••• {defaultPaymentMethod.card.last4}
                  </p>
                </div>
              </div>
              {onChangePaymentMethod && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={onChangePaymentMethod}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}

          {/* Disclaimer */}
          <p className="text-xs text-muted-foreground">
            {t('tokenBudget.addFunds.disclaimer')}
          </p>
        </div>

        <DialogFooter>
          <Button
            onClick={handlePurchase}
            disabled={isPurchasing || amount < 20000 || !defaultPaymentMethod}
            className="w-full"
          >
            {isPurchasing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {t('tokenBudget.addFunds.buyButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
