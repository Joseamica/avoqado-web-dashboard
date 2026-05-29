import { useState } from 'react'
import { UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Package, Info, MapPin } from 'lucide-react'

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

  // Manual mode: escape hatch when Google Maps fails (expired key, network
  // issue, address not in DB). User clicks "Llenar a mano" and we swap the
  // autocomplete for a plain Input + reveal editable city/state/zip/country.
  const [manualMode, setManualMode] = useState(false)

  // Watch parsed address components so we can show a confirmation chip
  // under the autocomplete once the user picks a result from Google Maps.
  const city = form.watch('city')
  const state = form.watch('state')
  const postalCode = form.watch('postalCode')
  const country = form.watch('country')
  const hasParsedLocation = Boolean(city || state || postalCode)

  // Reveal manual fields when user toggled manual mode OR when Maps already
  // populated location (so user can verify/correct what Maps parsed).
  const showManualFields = manualMode || hasParsedLocation

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
              // Custom validate: in autocomplete mode, city must be populated
              // (only happens when user picks a Maps result). In manual mode,
              // the city/state/zip/country fields validate themselves below,
              // so we just need the address field text to be non-empty.
              validate: () => {
                if (manualMode) return true
                return form.getValues('city')
                  ? true
                  : (t('purchaseWizard.step2.validation.addressSelectFromList') as string)
              },
            }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('purchaseWizard.step2.address')}</FormLabel>
                <FormControl>
                  {manualMode ? (
                    <Input placeholder={t('purchaseWizard.step2.addressPlaceholder')} {...field} />
                  ) : (
                    <AddressAutocomplete
                      value={field.value}
                      onAddressSelect={(place: PlaceDetails) => {
                        form.setValue('address', place.address, { shouldValidate: true })
                        form.setValue('city', place.city)
                        form.setValue('state', place.state)
                        form.setValue('postalCode', place.zipCode)
                        form.setValue('country', place.country || 'MX')
                      }}
                      placeholder={t('purchaseWizard.step2.addressPlaceholder')}
                    />
                  )}
                </FormControl>
                <FormMessage />
                {/* Confirmation chip: show what Google Maps parsed so the user
                    sees the implicit city/state/zip we'll send with the order. */}
                {!manualMode && hasParsedLocation && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span>
                      {[city, state, postalCode, country].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                )}
                {/* Escape hatch: when Maps fails (expired key, no suggestions
                    for this address, etc.) the user can switch to manual mode
                    and fill all fields themselves. */}
                {!manualMode && !hasParsedLocation && (
                  <button
                    type="button"
                    onClick={() => setManualMode(true)}
                    className="mt-2 text-xs text-primary hover:underline self-start"
                  >
                    {t('purchaseWizard.step2.enterManually')}
                  </button>
                )}
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

          {/* Manual address fields — shown when the user clicked "Llenar a mano"
              OR when Maps already populated location (so user can correct it).
              When hidden, these fields still live in form state but no UI is
              rendered (most users finish the flow via Maps autocomplete). */}
          {showManualFields && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  rules={{ required: { value: true, message: t('purchaseWizard.step2.validation.cityRequired') } }}
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
                  rules={{ required: { value: true, message: t('purchaseWizard.step2.validation.stateRequired') } }}
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
                  rules={{ required: { value: true, message: t('purchaseWizard.step2.validation.postalCodeRequired') } }}
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
                  rules={{ required: { value: true, message: t('purchaseWizard.step2.validation.countryRequired') } }}
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
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
