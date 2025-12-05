import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { CreditCard, Plus, Check } from 'lucide-react'
import { StripePaymentMethod } from '@/components/StripePaymentMethod'
import api from '@/api'
import getIcon from '@/utils/getIcon'

interface PaymentMethod {
  id: string
  card: {
    brand: string
    last4: string
    exp_month: number
    exp_year: number
  }
  customer?: string
}

interface PaymentMethodSelectorProps {
  venueId: string
  onPaymentMethodSelected: (paymentMethodId: string) => void
  buttonText?: string
  showAddNewInitially?: boolean
}

/**
 * Smart component that:
 * 1. Checks if payment methods exist
 * 2. If yes: Shows list of existing methods + option to add new
 * 3. If no: Shows StripePaymentMethod form
 * 4. Allows selecting existing or creating new payment method
 */
export function PaymentMethodSelector({
  venueId,
  onPaymentMethodSelected,
  buttonText = 'Continue',
  showAddNewInitially = false,
}: PaymentMethodSelectorProps) {
  const { t } = useTranslation('payment')
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null)
  const [showAddNew, setShowAddNew] = useState(showAddNewInitially)

  // Fetch existing payment methods
  const { data: paymentMethods, isLoading } = useQuery<PaymentMethod[]>({
    queryKey: ['paymentMethods', venueId],
    queryFn: async () => {
      const response = await api.get(`/api/v1/dashboard/venues/${venueId}/payment-methods`)
      return response.data.data
    },
    enabled: !!venueId,
  })

  // Auto-select first payment method if only one exists
  useEffect(() => {
    if (paymentMethods && paymentMethods.length === 1 && !showAddNew) {
      setSelectedPaymentMethodId(paymentMethods[0].id)
    }
  }, [paymentMethods, showAddNew])

  // Get card brand display name
  const getCardBrand = (brand: string) => {
    const brandMap: Record<string, string> = {
      visa: 'Visa',
      mastercard: 'Mastercard',
      amex: 'American Express',
      discover: 'Discover',
      diners: 'Diners Club',
      jcb: 'JCB',
      unionpay: 'UnionPay',
    }
    return brandMap[brand.toLowerCase()] || 'Card'
  }

  // Handle payment method created from Stripe form
  const handlePaymentMethodCreated = (paymentMethodId: string) => {
    onPaymentMethodSelected(paymentMethodId)
  }

  // Handle continue with selected payment method
  const handleContinue = () => {
    if (selectedPaymentMethodId) {
      onPaymentMethodSelected(selectedPaymentMethodId)
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-sm text-muted-foreground">{t('selector.loading')}</p>
      </div>
    )
  }

  // No payment methods exist OR user wants to add new
  if (!paymentMethods || paymentMethods.length === 0 || showAddNew) {
    return (
      <div className="space-y-4">
        {/* Show back button if returning from "Add new" */}
        {paymentMethods && paymentMethods.length > 0 && showAddNew && (
          <Button variant="outline" size="sm" onClick={() => setShowAddNew(false)}>
            {t('selector.backToExisting')}
          </Button>
        )}

        {/* Stripe payment method form with SetupIntent validation */}
        <StripePaymentMethod venueId={venueId} onPaymentMethodCreated={handlePaymentMethodCreated} buttonText={buttonText} />
      </div>
    )
  }

  // Payment methods exist - show selection UI
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <Label className="text-base font-medium">{t('selector.selectMethod')}</Label>

        <RadioGroup value={selectedPaymentMethodId || ''} onValueChange={setSelectedPaymentMethodId}>
          {paymentMethods.map(method => (
            <Card
              key={method.id}
              className={`cursor-pointer transition-all ${
                selectedPaymentMethodId === method.id ? 'border-primary ring-2 ring-primary/20' : 'hover:border-primary/50'
              }`}
              onClick={() => setSelectedPaymentMethodId(method.id)}
            >
              <CardContent className="flex items-center gap-4 p-4">
                {/* Radio button */}
                <RadioGroupItem value={method.id} id={method.id} />

                {/* Card icon */}
                <div className="flex items-center justify-center w-12 h-8 bg-background border border-border rounded">
                  {getIcon(method.card.brand)}
                </div>

                {/* Card details */}
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {getCardBrand(method.card.brand)} •••• {method.card.last4}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('selector.expires')} {String(method.card.exp_month).padStart(2, '0')}/{method.card.exp_year}
                  </p>
                </div>

                {/* Selected badge */}
                {selectedPaymentMethodId === method.id && (
                  <Badge variant="default" className="gap-1">
                    <Check className="h-3 w-3" />
                    {t('selector.selected')}
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </RadioGroup>
      </div>

      {/* Add new payment method option */}
      <Button variant="outline" className="w-full" onClick={() => setShowAddNew(true)}>
        <Plus className="h-4 w-4 mr-2" />
        {t('selector.addNew')}
      </Button>

      {/* Continue button */}
      <Button className="w-full" onClick={handleContinue} disabled={!selectedPaymentMethodId}>
        <CreditCard className="h-4 w-4 mr-2" />
        {buttonText}
      </Button>
    </div>
  )
}
