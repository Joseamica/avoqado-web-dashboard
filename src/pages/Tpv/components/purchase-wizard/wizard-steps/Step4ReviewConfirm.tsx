import { UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import {
  CartLine,
  TPV_CATALOG,
  calculateCartTotals,
  formatMxnCents,
} from '@/config/tpvCatalog'

import type { Step2Data } from './Step2ShippingInfo'
import type { Step3Data } from './Step3PaymentMethod'

export interface Step4Data {
  acceptTerms: boolean
}

interface Step4ReviewConfirmProps {
  form: UseFormReturn<Step4Data>
  cart: CartLine[]
  step2Data: Step2Data
  step3Data: Step3Data
  onEditStep: (step: number) => void
}

export function Step4ReviewConfirm({
  form,
  cart,
  step2Data,
  step3Data,
  onEditStep,
}: Step4ReviewConfirmProps) {
  const { t } = useTranslation('tpv')
  const { t: tCommon } = useTranslation()
  const totals = calculateCartTotals(cart)

  const methodLabel =
    step3Data.method === 'CARD_STRIPE'
      ? t('purchaseWizard.step3.methods.cardStripe.label')
      : t('purchaseWizard.step3.methods.spei.label')

  return (
    <div className="space-y-4">
      {/* Items */}
      <Card className="border-input">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t('purchaseWizard.step4.itemsTitle')}</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => onEditStep(1)}>
            {tCommon('common.edit')}
          </Button>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {cart.map(line => {
            const entry = TPV_CATALOG[line.catalogKey]
            if (!entry) return null
            return (
              <div key={line.catalogKey} className="flex justify-between">
                <span>
                  {entry.name} × {line.quantity}
                </span>
                <span>{formatMxnCents(entry.unitPriceCents * line.quantity)}</span>
              </div>
            )
          })}
          <div className="pt-2 border-t border-input space-y-1">
            <div className="flex justify-between text-muted-foreground">
              <span>{t('purchaseWizard.step1.cart.subtotal')}</span>
              <span>{formatMxnCents(totals.subtotalCents)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>{t('purchaseWizard.step1.cart.tax')}</span>
              <span>{formatMxnCents(totals.taxCents)}</span>
            </div>
            <div className="flex justify-between font-bold pt-1">
              <span>{t('purchaseWizard.step1.cart.total')}</span>
              <span>{formatMxnCents(totals.totalCents)} MXN</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Shipping */}
      <Card className="border-input">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t('purchaseWizard.step4.shippingTitle')}</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => onEditStep(2)}>
            {tCommon('common.edit')}
          </Button>
        </CardHeader>
        <CardContent className="text-sm space-y-0.5">
          <div>{step2Data.contactName}</div>
          <div className="text-muted-foreground">
            {step2Data.contactEmail} · {step2Data.contactPhone}
          </div>
          <div className="pt-2">
            {step2Data.address}
            {step2Data.addressLine2 ? `, ${step2Data.addressLine2}` : ''}
          </div>
          <div>
            {step2Data.city}, {step2Data.state} {step2Data.postalCode}
          </div>
          <div>{step2Data.country}</div>
        </CardContent>
      </Card>

      {/* Payment */}
      <Card className="border-input">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t('purchaseWizard.step4.paymentTitle')}</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => onEditStep(3)}>
            {tCommon('common.edit')}
          </Button>
        </CardHeader>
        <CardContent className="text-sm">{methodLabel}</CardContent>
      </Card>

      {/* Terms */}
      <FormField
        control={form.control}
        name="acceptTerms"
        rules={{
          required: { value: true, message: t('purchaseWizard.step4.validation.termsRequired') },
        }}
        render={({ field }) => (
          <FormItem className="flex flex-row items-start gap-3 rounded-lg border border-input p-3">
            <FormControl>
              <Checkbox checked={field.value} onCheckedChange={field.onChange} />
            </FormControl>
            <div className="space-y-1 leading-none">
              <FormLabel>{t('purchaseWizard.step4.acceptTerms')}</FormLabel>
              <FormMessage />
            </div>
          </FormItem>
        )}
      />
    </div>
  )
}
