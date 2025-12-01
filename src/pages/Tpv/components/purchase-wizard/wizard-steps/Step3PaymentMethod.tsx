import { UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, CreditCard, Building, Wallet } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

export interface Step3Data {
  method: 'card' | 'bank' | 'balance'
  cardNumber?: string
  cardExpiry?: string
  cardCVV?: string
  cardName?: string
  mockToken: string
}

interface Step3PaymentMethodProps {
  form: UseFormReturn<Step3Data>
}

export function Step3PaymentMethod({ form }: Step3PaymentMethodProps) {
  const { t } = useTranslation('tpv')

  const selectedMethod = form.watch('method')

  const paymentMethods = [
    { value: 'card', label: t('purchaseWizard.step3.methods.card'), icon: CreditCard },
    { value: 'bank', label: t('purchaseWizard.step3.methods.bank'), icon: Building },
    { value: 'balance', label: t('purchaseWizard.step3.methods.balance'), icon: Wallet },
  ]

  return (
    <div className="space-y-6">
      {/* Demo Warning */}
      <Alert className="bg-yellow-50 dark:bg-yellow-950/50 border-yellow-200 dark:border-yellow-800">
        <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
        <AlertDescription className="text-yellow-800 dark:text-yellow-200">
          {t('purchaseWizard.step3.demoWarning')}
        </AlertDescription>
      </Alert>

      {/* Payment Method Selection */}
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
                {paymentMethods.map(method => {
                  const Icon = method.icon
                  return (
                    <Card
                      key={method.value}
                      className={`cursor-pointer transition-all ${field.value === method.value ? 'border-primary bg-accent/50' : 'hover:border-muted-foreground'}`}
                      onClick={() => field.onChange(method.value)}
                    >
                      <CardContent className="flex items-center gap-3 p-4">
                        <RadioGroupItem value={method.value} id={method.value} />
                        <Icon className="h-5 w-5 text-muted-foreground" />
                        <Label htmlFor={method.value} className="font-normal cursor-pointer flex-1">
                          {method.label}
                        </Label>
                      </CardContent>
                    </Card>
                  )
                })}
              </RadioGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Card Details (only shown if card is selected) */}
      {selectedMethod === 'card' && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <FormField
              control={form.control}
              name="cardNumber"
              rules={{
                required: { value: true, message: t('purchaseWizard.step3.validation.cardNumberRequired') },
                pattern: {
                  value: /^\d{16}$/,
                  message: t('purchaseWizard.step3.validation.cardNumberInvalid'),
                },
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('purchaseWizard.step3.cardNumber')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('purchaseWizard.step3.cardNumberPlaceholder')}
                      maxLength={16}
                      {...field}
                      onChange={e => {
                        const value = e.target.value.replace(/\D/g, '')
                        field.onChange(value)
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cardExpiry"
                rules={{
                  required: { value: true, message: t('purchaseWizard.step3.validation.cardExpiryRequired') },
                  pattern: {
                    value: /^(0[1-9]|1[0-2])\/\d{2}$/,
                    message: t('purchaseWizard.step3.validation.cardExpiryInvalid'),
                  },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('purchaseWizard.step3.cardExpiry')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('purchaseWizard.step3.cardExpiryPlaceholder')}
                        maxLength={5}
                        {...field}
                        onChange={e => {
                          let value = e.target.value.replace(/\D/g, '')
                          if (value.length >= 2) {
                            value = value.slice(0, 2) + '/' + value.slice(2, 4)
                          }
                          field.onChange(value)
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cardCVV"
                rules={{
                  required: { value: true, message: t('purchaseWizard.step3.validation.cardCVVRequired') },
                  pattern: {
                    value: /^\d{3,4}$/,
                    message: t('purchaseWizard.step3.validation.cardCVVInvalid'),
                  },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('purchaseWizard.step3.cardCVV')}</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder={t('purchaseWizard.step3.cardCVVPlaceholder')}
                        maxLength={4}
                        {...field}
                        onChange={e => {
                          const value = e.target.value.replace(/\D/g, '')
                          field.onChange(value)
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="cardName"
              rules={{
                required: { value: true, message: t('purchaseWizard.step3.validation.cardNameRequired') },
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('purchaseWizard.step3.cardName')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('purchaseWizard.step3.cardNamePlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>
      )}

      {/* Bank Transfer Message */}
      {selectedMethod === 'bank' && (
        <Alert>
          <Building className="h-4 w-4" />
          <AlertDescription>
            {t('purchaseWizard.step3.methods.bank')} - Demo mode (no actual transfer will be processed)
          </AlertDescription>
        </Alert>
      )}

      {/* Account Balance Message */}
      {selectedMethod === 'balance' && (
        <Alert>
          <Wallet className="h-4 w-4" />
          <AlertDescription>
            {t('purchaseWizard.step3.methods.balance')} - Demo mode (no actual charge will be processed)
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
