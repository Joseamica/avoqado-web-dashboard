import { UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Smartphone, Edit, MapPin, CreditCard, Truck } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

import type { Step1Data } from './Step1Configuration'
import type { Step2Data } from './Step2ShippingInfo'
import type { Step3Data } from './Step3PaymentMethod'

export interface Step4Data {
  acceptTerms: boolean
}

interface Step4ReviewConfirmProps {
  form: UseFormReturn<Step4Data>
  step1Data: Step1Data
  step2Data: Step2Data
  step3Data: Step3Data
  onEditStep: (step: number) => void
}

const PRODUCT = {
  name: 'PAX A910S',
  price: 349,
  imageUrl: 'https://custom-images.strikinglycdn.com/res/hrscywv4p/image/upload/c_limit,fl_lossy,h_9000,w_1200,f_auto,q_auto/1402119/570292_470056.png',
}

const SHIPPING_COSTS = {
  standard: 0,
  express: 15,
  overnight: 35,
}

const TAX_RATE = 0.16 // 16% tax

export function Step4ReviewConfirm({ form, step1Data, step2Data, step3Data, onEditStep }: Step4ReviewConfirmProps) {
  const { t } = useTranslation('tpv')

  // Calculate pricing
  const subtotal = PRODUCT.price * step1Data.quantity
  const shippingCost = SHIPPING_COSTS[step2Data.shippingSpeed]
  const tax = (subtotal + shippingCost) * TAX_RATE
  const total = subtotal + shippingCost + tax

  // Format payment method display
  const paymentMethodDisplay = {
    card: t('purchaseWizard.step3.methods.card'),
    bank: t('purchaseWizard.step3.methods.bank'),
    balance: t('purchaseWizard.step3.methods.balance'),
  }[step3Data.method]

  return (
    <div className="space-y-6">
      {/* Product */}
      <Card className="border-primary bg-accent/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            {t('purchaseWizard.step4.terminalSelected')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 flex items-center justify-center bg-background rounded-lg overflow-hidden border border-border flex-shrink-0">
              <img
                src={PRODUCT.imageUrl}
                alt={PRODUCT.name}
                className="w-full h-full object-contain p-1"
              />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-lg">{PRODUCT.name}</p>
              <p className="text-sm text-muted-foreground">
                {t('purchaseWizard.step4.quantity')}: {step1Data.quantity}
              </p>
            </div>
            <p className="text-2xl font-bold text-primary">${PRODUCT.price}</p>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{t('purchaseWizard.step4.configuration')}</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => onEditStep(1)}>
              <Edit className="h-4 w-4 mr-2" />
              {t('purchaseWizard.step4.edit')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('purchaseWizard.step4.quantity')}</span>
            <span className="font-medium">
              {step1Data.quantity} {step1Data.quantity === 1 ? t('purchaseWizard.step4.terminals', { count: 1 }) : t('purchaseWizard.step4.terminals_other', { count: step1Data.quantity })}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('purchaseWizard.step4.naming')}</span>
            <span className="font-medium">
              {step1Data.namePrefix} 1{step1Data.quantity > 1 ? ` - ${step1Data.namePrefix} ${step1Data.quantity}` : ''}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('purchaseWizard.step4.serialMode')}</span>
            <span className="font-medium">
              {step1Data.autoGenerate ? t('purchaseWizard.step1.autoGenerate') : t('purchaseWizard.step1.manual')}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Shipping Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              {t('purchaseWizard.step4.shipping')}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => onEditStep(2)}>
              <Edit className="h-4 w-4 mr-2" />
              {t('purchaseWizard.step4.edit')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">{t('purchaseWizard.step4.deliveryAddress')}</p>
            <p className="text-sm">{step2Data.contactName}</p>
            <p className="text-sm">{step2Data.address}</p>
            {step2Data.addressLine2 && <p className="text-sm">{step2Data.addressLine2}</p>}
            <p className="text-sm">
              {step2Data.city}, {step2Data.state} {step2Data.postalCode}
            </p>
            <p className="text-sm">{step2Data.country}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {step2Data.contactEmail} • {step2Data.contactPhone}
            </p>
          </div>
          <Separator />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-2">
              <Truck className="h-4 w-4" />
              {t('purchaseWizard.step4.shippingSpeed')}
            </span>
            <span className="font-medium">
              {step2Data.shippingSpeed === 'standard' && t('purchaseWizard.step2.shippingOptions.standard')}
              {step2Data.shippingSpeed === 'express' && t('purchaseWizard.step2.shippingOptions.express')}
              {step2Data.shippingSpeed === 'overnight' && t('purchaseWizard.step2.shippingOptions.overnight')}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Payment Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              {t('purchaseWizard.step4.payment')}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => onEditStep(3)}>
              <Edit className="h-4 w-4 mr-2" />
              {t('purchaseWizard.step4.edit')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('purchaseWizard.step4.paymentMethod')}</span>
            <span className="font-medium">{paymentMethodDisplay}</span>
          </div>
          {step3Data.method === 'card' && step3Data.cardNumber && (
            <p className="text-sm text-muted-foreground mt-1">**** **** **** {step3Data.cardNumber.slice(-4)}</p>
          )}
        </CardContent>
      </Card>

      {/* Pricing Breakdown */}
      <Card className="bg-accent/30">
        <CardHeader>
          <CardTitle className="text-lg">{t('purchaseWizard.step4.pricingBreakdown')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {t('purchaseWizard.step4.unitPrice')} ({step1Data.quantity}x)
            </span>
            <span>${PRODUCT.price.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('purchaseWizard.step4.subtotal')}</span>
            <span className="font-medium">${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('purchaseWizard.step4.shippingCost')}</span>
            <span>${shippingCost.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('purchaseWizard.step4.tax')}</span>
            <span>${tax.toFixed(2)}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-lg font-bold">
            <span>{t('purchaseWizard.step4.total')}</span>
            <span className="text-primary">${total.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Terms & Conditions */}
      <FormField
        control={form.control}
        name="acceptTerms"
        rules={{
          required: { value: true, message: t('purchaseWizard.step4.validation.termsRequired') },
        }}
        render={({ field }) => (
          <FormItem>
            <div className="flex items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={field.onChange} id="terms" />
              </FormControl>
              <div className="space-y-1 leading-none">
                <Label htmlFor="terms" className="text-sm font-normal cursor-pointer">
                  {t('purchaseWizard.step4.acceptTerms')}
                </Label>
              </div>
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
