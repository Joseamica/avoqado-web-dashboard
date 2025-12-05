import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/components/ui/card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TimezoneCombobox } from '@/components/timezone-combobox'
import { BusinessTypeCombobox } from '@/components/business-type-combobox'
import { BusinessType } from '@/types'

import { OnboardingStepProps } from '../OnboardingWizard'
import { NavigationButtons } from '../components/NavigationButtons'
export interface BusinessInfoData {
  name: string
  type: BusinessType
  address: string
  city: string
  state: string
  country: string
  zipCode: string
  phone: string
  email: string
  timezone: string
  currency: string
}

interface BusinessInfoStepProps extends OnboardingStepProps {
  onSave: (data: BusinessInfoData) => void
  initialValue?: BusinessInfoData
}

export function BusinessInfoStep({ onNext, onPrevious, isFirstStep, onSave, initialValue }: BusinessInfoStepProps) {
  const { t } = useTranslation('onboarding')
  const { t: tCommon } = useTranslation('common')

  // Form validation schema
  const formSchema = z.object({
    name: z.string().min(1, t('businessInfo.validation.nameRequired')).min(2, t('businessInfo.validation.nameMin')),
    type: z.nativeEnum(BusinessType, {
      errorMap: () => ({ message: t('businessInfo.validation.typeRequired') }),
    }),
    address: z.string().min(1, t('businessInfo.validation.addressRequired')),
    city: z.string().min(1, t('businessInfo.validation.cityRequired')),
    state: z.string().min(1, t('businessInfo.validation.stateRequired')),
    country: z.string().min(1, t('businessInfo.validation.countryRequired')),
    zipCode: z.string().min(1, t('businessInfo.validation.zipCodeRequired')),
    phone: z.string().min(1, t('businessInfo.validation.phoneRequired')),
    email: z.string().min(1, t('businessInfo.validation.emailRequired')).email(t('businessInfo.validation.emailInvalid')),
    timezone: z.string().min(1, t('businessInfo.validation.timezoneRequired')),
    currency: z.string().min(1, t('businessInfo.validation.currencyRequired')),
  })

  const form = useForm<BusinessInfoData>({
    resolver: zodResolver(formSchema),
    defaultValues: initialValue || {
      name: '',
      type: BusinessType.RESTAURANT,
      address: '',
      city: '',
      state: '',
      country: 'MX',
      zipCode: '',
      phone: '',
      email: '',
      timezone: 'America/Mexico_City',
      currency: 'MXN',
    },
  })

  const handleSubmit = (data: BusinessInfoData) => {
    console.log('✅ BusinessInfo form submitted with data:', data)
    onSave(data)
    onNext()
  }

  // Common countries (can be expanded)
  const countries = [
    { code: 'MX', name: 'México' },
    { code: 'US', name: 'United States' },
    { code: 'CA', name: 'Canada' },
    { code: 'ES', name: 'España' },
    { code: 'AR', name: 'Argentina' },
    { code: 'CO', name: 'Colombia' },
    { code: 'CL', name: 'Chile' },
    { code: 'PE', name: 'Perú' },
  ]

  // Common currencies
  const currencies = [
    { code: 'MXN', name: 'Mexican Peso (MXN)' },
    { code: 'USD', name: 'US Dollar (USD)' },
    { code: 'CAD', name: 'Canadian Dollar (CAD)' },
    { code: 'EUR', name: 'Euro (EUR)' },
    { code: 'ARS', name: 'Argentine Peso (ARS)' },
    { code: 'COP', name: 'Colombian Peso (COP)' },
    { code: 'CLP', name: 'Chilean Peso (CLP)' },
    { code: 'PEN', name: 'Peruvian Sol (PEN)' },
  ]

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground">{t('businessInfo.title')}</h2>
        <p className="mt-2 text-muted-foreground">{t('businessInfo.subtitle')}</p>
      </div>

      {/* Form */}
      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form id="business-info-form" onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              {/* Business Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('businessInfo.form.businessName')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('businessInfo.form.businessNamePlaceholder')} {...field} />
                    </FormControl>
                    <FormDescription>{t('businessInfo.form.businessNameHelp')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Business Type */}
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('businessInfo.form.businessType')}</FormLabel>
                    <FormControl>
                      <BusinessTypeCombobox value={field.value} onValueChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Address */}
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('businessInfo.form.address')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('businessInfo.form.addressPlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* City, State (2 columns on desktop) */}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('businessInfo.form.city')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('businessInfo.form.cityPlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('businessInfo.form.state')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('businessInfo.form.statePlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Country, Zip Code (2 columns on desktop) */}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('businessInfo.form.country')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('businessInfo.form.countryPlaceholder')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {countries.map(country => (
                            <SelectItem key={country.code} value={country.code}>
                              {country.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="zipCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('businessInfo.form.zipCode')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('businessInfo.form.zipCodePlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Phone, Email (2 columns on desktop) */}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('businessInfo.form.phone')}</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder={t('businessInfo.form.phonePlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('businessInfo.form.email')}</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder={t('businessInfo.form.emailPlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Timezone */}
              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('businessInfo.form.timezone')}</FormLabel>
                    <FormControl>
                      <TimezoneCombobox value={field.value} onValueChange={field.onChange} />
                    </FormControl>
                    <FormDescription>{t('businessInfo.form.timezoneHelp')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Currency */}
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('businessInfo.form.currency')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {currencies.map(currency => (
                          <SelectItem key={currency.code} value={currency.code}>
                            {currency.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>{t('businessInfo.form.currencyHelp')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Optional Steps Notice */}
              <Card className="border-muted bg-muted/30">
                <CardContent className="pt-6">
                  <div className="flex gap-3">
                    <div className="mt-0.5 text-muted-foreground">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <div className="flex-1 space-y-2">
                      <p className="text-sm font-medium text-foreground">{t('businessInfo.optionalSteps.title')}</p>
                      <p className="text-sm text-muted-foreground">{t('businessInfo.optionalSteps.description')}</p>
                      <ul className="ml-4 list-disc space-y-1 text-sm text-muted-foreground">
                        <li>{t('businessInfo.optionalSteps.step4')}</li>
                        <li>{t('businessInfo.optionalSteps.step5')}</li>
                        <li>{t('businessInfo.optionalSteps.step6')}</li>
                        <li>{t('businessInfo.optionalSteps.step7')}</li>
                      </ul>
                      <p className="text-sm font-medium text-foreground">{t('businessInfo.optionalSteps.choice')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Fixed Navigation buttons */}
      <NavigationButtons
        onPrevious={onPrevious}
        isFirstStep={isFirstStep}
        formId="business-info-form"
      />
    </div>
  )
}
