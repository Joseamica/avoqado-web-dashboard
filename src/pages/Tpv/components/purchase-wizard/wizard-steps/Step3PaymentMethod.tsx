import { CreditCard, Building } from 'lucide-react'
import { UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { Card, CardContent } from '@/components/ui/card'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

export type PaymentMethod = 'CARD_STRIPE' | 'SPEI'

export interface Step3Data {
  method: PaymentMethod
}

interface Step3PaymentMethodProps {
  form: UseFormReturn<Step3Data>
}

export function Step3PaymentMethod({ form }: Step3PaymentMethodProps) {
  const { t } = useTranslation('tpv')

  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="method"
        rules={{
          required: { value: true, message: t('purchaseWizard.step3.validation.methodRequired') },
        }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('purchaseWizard.step3.selectMethod')}</FormLabel>
            <FormControl>
              <RadioGroup value={field.value} onValueChange={field.onChange} className="grid grid-cols-1 gap-3">
                <Card
                  data-tour="tpv-payment-card"
                  className={`cursor-pointer transition-all border-input ${
                    field.value === 'CARD_STRIPE'
                      ? 'border-primary bg-accent/50'
                      : 'hover:border-muted-foreground'
                  }`}
                  onClick={() => field.onChange('CARD_STRIPE')}
                >
                  <CardContent className="flex items-center gap-3 p-4">
                    <RadioGroupItem value="CARD_STRIPE" id="CARD_STRIPE" />
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <Label htmlFor="CARD_STRIPE" className="font-normal cursor-pointer">
                        {t('purchaseWizard.step3.methods.cardStripe.label')}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {t('purchaseWizard.step3.methods.cardStripe.desc')}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card
                  data-tour="tpv-payment-spei"
                  className={`cursor-pointer transition-all border-input ${
                    field.value === 'SPEI'
                      ? 'border-primary bg-accent/50'
                      : 'hover:border-muted-foreground'
                  }`}
                  onClick={() => field.onChange('SPEI')}
                >
                  <CardContent className="flex items-center gap-3 p-4">
                    <RadioGroupItem value="SPEI" id="SPEI" />
                    <Building className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <Label htmlFor="SPEI" className="font-normal cursor-pointer">
                        {t('purchaseWizard.step3.methods.spei.label')}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {t('purchaseWizard.step3.methods.spei.desc')}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </RadioGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
