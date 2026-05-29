import { UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Package, Info } from 'lucide-react'

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AddressAutocomplete, type PlaceDetails } from '@/components/address-autocomplete'

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
}

interface Step2ShippingInfoProps {
  form: UseFormReturn<Step2Data>
  wasPreFilled?: boolean
}

export function Step2ShippingInfo({ form, wasPreFilled }: Step2ShippingInfoProps) {
  const { t } = useTranslation('tpv')

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
                  <AddressAutocomplete
                    value={field.value}
                    onAddressSelect={(place: PlaceDetails) => {
                      form.setValue('address', place.address)
                      form.setValue('city', place.city)
                      form.setValue('state', place.state)
                      form.setValue('postalCode', place.zipCode)
                      form.setValue('country', place.country)
                    }}
                    placeholder={t('purchaseWizard.step2.addressPlaceholder')}
                  />
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
    </div>
  )
}
