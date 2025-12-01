import { UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Package, Info } from 'lucide-react'

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

export interface Step2Data {
  contactName: string
  contactEmail: string
  contactPhone: string
  address: string
  addressLine2?: string
  city: string
  state: string
  postalCode: string
  country: string
  shippingSpeed: 'standard' | 'express' | 'overnight'
}

interface Step2ShippingInfoProps {
  form: UseFormReturn<Step2Data>
  wasPreFilled?: boolean
}

export function Step2ShippingInfo({ form, wasPreFilled }: Step2ShippingInfoProps) {
  const { t } = useTranslation('tpv')

  const shippingOptions = [
    { value: 'standard', label: t('purchaseWizard.step2.shippingOptions.standard') },
    { value: 'express', label: t('purchaseWizard.step2.shippingOptions.express') },
    { value: 'overnight', label: t('purchaseWizard.step2.shippingOptions.overnight') },
  ]

  return (
    <div className="space-y-6">
      {/* Pre-fill Status Message */}
      {wasPreFilled === false && (
        <Alert className="bg-amber-50 border-amber-200">
          <Info className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-900">
            {t('purchaseWizard.step2.venueDataIncomplete')}
          </AlertDescription>
        </Alert>
      )}

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" />
            {t('purchaseWizard.step2.contactInfo')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField
            control={form.control}
            name="contactName"
            rules={{
              required: { value: true, message: t('purchaseWizard.step2.validation.contactNameRequired') },
            }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('purchaseWizard.step2.contactName')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('purchaseWizard.step2.contactNamePlaceholder')} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="contactEmail"
            rules={{
              required: { value: true, message: t('purchaseWizard.step2.validation.contactEmailRequired') },
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: t('purchaseWizard.step2.validation.contactEmailInvalid'),
              },
            }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('purchaseWizard.step2.contactEmail')}</FormLabel>
                <FormControl>
                  <Input type="email" placeholder={t('purchaseWizard.step2.contactEmailPlaceholder')} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="contactPhone"
            rules={{
              required: { value: true, message: t('purchaseWizard.step2.validation.contactPhoneRequired') },
            }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('purchaseWizard.step2.contactPhone')}</FormLabel>
                <FormControl>
                  <Input type="tel" placeholder={t('purchaseWizard.step2.contactPhonePlaceholder')} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      {/* Shipping Address */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('purchaseWizard.step2.shippingAddress')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField
            control={form.control}
            name="address"
            rules={{
              required: { value: true, message: t('purchaseWizard.step2.validation.addressRequired') },
            }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('purchaseWizard.step2.address')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('purchaseWizard.step2.addressPlaceholder')} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="addressLine2"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('purchaseWizard.step2.addressLine2')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('purchaseWizard.step2.addressLine2Placeholder')} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="city"
              rules={{
                required: { value: true, message: t('purchaseWizard.step2.validation.cityRequired') },
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('purchaseWizard.step2.city')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('purchaseWizard.step2.cityPlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="state"
              rules={{
                required: { value: true, message: t('purchaseWizard.step2.validation.stateRequired') },
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('purchaseWizard.step2.state')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('purchaseWizard.step2.statePlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="postalCode"
              rules={{
                required: { value: true, message: t('purchaseWizard.step2.validation.postalCodeRequired') },
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('purchaseWizard.step2.postalCode')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('purchaseWizard.step2.postalCodePlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="country"
              rules={{
                required: { value: true, message: t('purchaseWizard.step2.validation.countryRequired') },
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('purchaseWizard.step2.country')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('purchaseWizard.step2.countryPlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </CardContent>
      </Card>

      {/* Shipping Speed */}
      <FormField
        control={form.control}
        name="shippingSpeed"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('purchaseWizard.step2.shippingSpeed')}</FormLabel>
            <FormControl>
              <RadioGroup value={field.value} onValueChange={field.onChange} className="flex flex-col gap-3">
                {shippingOptions.map(option => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={option.value} id={option.value} />
                    <Label htmlFor={option.value} className="font-normal cursor-pointer flex-1">
                      {option.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
