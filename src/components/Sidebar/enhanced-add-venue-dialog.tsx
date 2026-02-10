import React, { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { getDownloadURL, ref, uploadBytesResumable, deleteObject } from 'firebase/storage'
import { storage, buildStoragePath } from '@/firebase'
import { Button } from '../ui/button'
import { DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useForm } from 'react-hook-form'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Input } from '../ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { Switch } from '../ui/switch'
import { getCroppedImg } from '@/utils/cropImage'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import api from '@/api'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useTranslation } from 'react-i18next'
import { TimezoneCombobox } from '@/components/timezone-combobox'
import * as costManagementAPI from '@/services/cost-management.service'
import { Building, CreditCard, DollarSign, Calculator, Info } from 'lucide-react'
import { BusinessType } from '@/types'
import { AddressAutocomplete, type PlaceDetails } from '@/components/address-autocomplete'
import { getIntlLocale } from '@/utils/i18n-locale'

interface EnhancedAddVenueDialogProps {
  onClose: () => void
  navigate: (path: string) => void
}

interface VenueFormData {
  // Basic venue information
  name: string
  type: string
  logo?: string
  address: string
  city: string
  state: string
  country: string
  zipCode: string
  latitude: number | null
  longitude: number | null
  phone: string
  email: string
  website?: string

  // Payment configuration
  enablePaymentProcessing: boolean
  primaryAccountId?: string
  secondaryAccountId?: string
  tertiaryAccountId?: string
  routingRules?: any

  // Pricing configuration
  setupPricingStructure: boolean
  pricingTier: 'STANDARD' | 'PREMIUM' | 'ENTERPRISE' | 'CUSTOM'
  debitRate?: number
  creditRate?: number
  amexRate?: number
  internationalRate?: number
  fixedFeePerTransaction?: number
  monthlyServiceFee?: number
  minimumMonthlyVolume?: number

  // Business configuration
  currency: string
  timezone: string
  businessType: string
}

export function EnhancedAddVenueDialog({ onClose, navigate }: EnhancedAddVenueDialogProps) {
  const { t, i18n } = useTranslation()
  const { t: tCommon } = useTranslation('common')
  const localeCode = getIntlLocale(i18n.language)
  const form = useForm<VenueFormData>({
    defaultValues: {
      name: '',
      type: '',
      logo: '',
      address: '',
      city: '',
      state: '',
      country: 'MX',
      zipCode: '',
      latitude: null as number | null,
      longitude: null as number | null,
      phone: '',
      email: '',
      website: '',
      enablePaymentProcessing: true,
      setupPricingStructure: true,
      pricingTier: 'STANDARD',
      currency: 'MXN',
      timezone: 'America/Mexico_City',
      businessType: 'RESTAURANT',
    },
  })

  const { venueSlug } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [uploading, setUploading] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [fileRef, setFileRef] = useState<any>(null)
  const [currentStep, setCurrentStep] = useState('basic')

  // Fetch merchant accounts for configuration
  const { data: merchantAccounts } = useQuery({
    queryKey: ['merchant-accounts'],
    queryFn: () => costManagementAPI.getMerchantAccountsList(),
  })

  // Predefined pricing tiers
  const pricingTiers = {
    STANDARD: {
      name: 'Standard',
      description: 'Basic rates for most venues',
      debitRate: 0.02, // 2.0%
      creditRate: 0.03, // 3.0%
      amexRate: 0.04, // 4.0%
      internationalRate: 0.045, // 4.5%
      fixedFeePerTransaction: 0.75,
      monthlyServiceFee: 799.0,
    },
    PREMIUM: {
      name: 'Premium',
      description: 'Reduced rates for high-volume venues',
      debitRate: 0.018, // 1.8%
      creditRate: 0.028, // 2.8%
      amexRate: 0.038, // 3.8%
      internationalRate: 0.043, // 4.3%
      fixedFeePerTransaction: 0.7,
      monthlyServiceFee: 1299.0,
    },
    ENTERPRISE: {
      name: 'Enterprise',
      description: 'Best rates for enterprise clients',
      debitRate: 0.015, // 1.5%
      creditRate: 0.025, // 2.5%
      amexRate: 0.035, // 3.5%
      internationalRate: 0.04, // 4.0%
      fixedFeePerTransaction: 0.65,
      monthlyServiceFee: 1999.0,
    },
    CUSTOM: {
      name: 'Custom',
      description: 'Negotiate custom rates',
      debitRate: 0,
      creditRate: 0,
      amexRate: 0,
      internationalRate: 0,
      fixedFeePerTransaction: 0,
      monthlyServiceFee: 0,
    },
  }

  const { mutate, isPending } = useMutation({
    mutationFn: async (data: VenueFormData) => {
      const response = await api.post('/api/v1/dashboard/venues/enhanced', data)
      return response.data
    },
    onSuccess: result => {
      toast({
        title: 'Venue Created Successfully',
        description: 'Venue has been created with payment processing and pricing configuration.',
      })
      queryClient.invalidateQueries({ queryKey: ['venues'] })
      form.reset()
      navigate(`/venues/${result.venueId}/dashboard`)
      onClose()
    },
    onError: (error: any) => {
      toast({
        title: 'Error Creating Venue',
        description: error.message || 'Failed to create venue.',
        variant: 'destructive',
      })
    },
  })

  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [imageForCrop, setImageForCrop] = useState<string | null>(null)

  const onCropComplete = useCallback((_, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const handleFileUpload = (file: File) => {
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => setImageForCrop(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleCropConfirm = async () => {
    if (!imageForCrop || !croppedAreaPixels) return

    const croppedImage = await getCroppedImg(imageForCrop, croppedAreaPixels)
    const blob = await fetch(croppedImage).then(res => res.blob())

    const fileName = `cropped_${Date.now()}.jpg`
    const storageRef = ref(storage, buildStoragePath(`venues/${venueSlug}/logos/${fileName}`))
    const uploadTask = uploadBytesResumable(storageRef, blob)

    setUploading(true)

    uploadTask.on(
      'state_changed',
      null,
      error => {
        console.error('Error uploading file:', error)
        setUploading(false)
      },
      () => {
        getDownloadURL(uploadTask.snapshot.ref).then(downloadURL => {
          setImageUrl(downloadURL)
          setFileRef(storageRef)
          setUploading(false)
          setImageForCrop(null)
          form.setValue('logo', downloadURL, { shouldValidate: true })
        })
      },
    )
  }

  const handleFileRemove = () => {
    if (fileRef) {
      deleteObject(fileRef)
        .then(() => {
          setImageUrl(null)
          setFileRef(null)
        })
        .catch(error => {
          console.error('Error removing file:', error)
        })
    }
  }

  // Update pricing when tier changes
  const handlePricingTierChange = (tier: string) => {
    form.setValue('pricingTier', tier as any)
    const tierConfig = pricingTiers[tier as keyof typeof pricingTiers]
    if (tierConfig && tier !== 'CUSTOM') {
      form.setValue('debitRate', tierConfig.debitRate)
      form.setValue('creditRate', tierConfig.creditRate)
      form.setValue('amexRate', tierConfig.amexRate)
      form.setValue('internationalRate', tierConfig.internationalRate)
      form.setValue('fixedFeePerTransaction', tierConfig.fixedFeePerTransaction)
      form.setValue('monthlyServiceFee', tierConfig.monthlyServiceFee)
    }
  }

  function onSubmit(formValues: VenueFormData) {
    mutate(formValues)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(localeCode, {
      style: 'currency',
      currency: 'MXN',
    }).format(amount)
  }

  const formatPercentage = (rate: number) => {
    return `${(rate * 100).toFixed(2)}%`
  }

  return (
    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center space-x-2">
          <Building className="w-5 h-5" />
          <span>{t('venueMgmt.addVenue.title')}</span>
        </DialogTitle>
        <DialogDescription>{t('venueMgmt.addVenue.description')}</DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Tabs value={currentStep} onValueChange={setCurrentStep} className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">{t('venueMgmt.tabs.basicInfo')}</TabsTrigger>
              <TabsTrigger value="location">{t('venueMgmt.tabs.location')}</TabsTrigger>
              <TabsTrigger value="payment">{t('venueMgmt.tabs.payment')}</TabsTrigger>
              <TabsTrigger value="pricing">{t('venueMgmt.tabs.pricing')}</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Info className="w-4 h-4" />
                    <span>{t('venueMgmt.basicInfo.title')}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      rules={{ required: 'Venue name is required' }}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('venueMgmt.basicInfo.venueName')}</FormLabel>
                          <FormControl>
                            <Input placeholder={t('venueMgmt.basicInfo.venueNamePlaceholder')} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      rules={{ required: 'Venue type is required' }}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('venueMgmt.basicInfo.venueType')}</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t('venueMgmt.basicInfo.venueTypePlaceholder')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Object.values(BusinessType).map(type => (
                                <SelectItem key={type} value={type}>
                                  {t(`venueMgmt.types.${type}`, { defaultValue: type.replace(/_/g, ' ') })}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="phone"
                      rules={{ required: 'Phone number is required' }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('venueMgmt.basicInfo.phoneNumber')}</FormLabel>
                          <FormControl>
                            <Input placeholder="+52-55-1234-5678" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email"
                      rules={{
                        required: 'Email is required',
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: 'Invalid email address',
                        },
                      }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('venueMgmt.basicInfo.email')}</FormLabel>
                          <FormControl>
                            <Input placeholder={t('venueMgmt.basicInfo.emailPlaceholder')} type="email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('venueMgmt.basicInfo.websiteOptional')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('venueMgmt.basicInfo.websitePlaceholder')} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="logo"
                    render={() => (
                      <FormItem>
                        <FormLabel>{t('venueMgmt.basicInfo.venueLogo')}</FormLabel>
                        <FormControl>
                          <div className="pb-4">
                            {imageUrl ? (
                              <div className="flex flex-col items-center space-y-2">
                                <img
                                  src={imageUrl}
                                  alt={t('venueMgmt.basicInfo.logoAlt')}
                                  className="object-cover rounded-md max-w-32 max-h-32"
                                />
                                <Button type="button" variant="outline" onClick={handleFileRemove} disabled={uploading}>
                                  Remove Logo
                                </Button>
                              </div>
                            ) : imageForCrop ? (
                              <div>
                                <div className="relative w-full h-64 bg-muted">
                                  <Cropper
                                    image={imageForCrop}
                                    crop={crop}
                                    zoom={zoom}
                                    aspect={4 / 3}
                                    onCropChange={setCrop}
                                    onZoomChange={setZoom}
                                    onCropComplete={onCropComplete}
                                  />
                                </div>
                                <div className="flex justify-between mt-4">
                                  <Button variant="outline" type="button" onClick={() => setImageForCrop(null)} disabled={uploading}>
                                    {t('cancel')}
                                  </Button>
                                  <Button type="button" onClick={handleCropConfirm} disabled={uploading}>
                                    {t('venueMgmt.basicInfo.confirmLogo')}
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <Input
                                type="file"
                                accept="image/*"
                                onChange={e => handleFileUpload(e.target.files?.[0])}
                                className="block w-full p-2 text-sm border rounded-md"
                                disabled={uploading}
                              />
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="location" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>{t('venueMgmt.location.title')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    rules={{ required: 'Address is required' }}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('venueMgmt.location.streetAddress')}</FormLabel>
                        <FormControl>
                          <AddressAutocomplete
                            value={field.value}
                            onAddressSelect={(place: PlaceDetails) => {
                              form.setValue('address', place.address)
                              form.setValue('city', place.city)
                              form.setValue('state', place.state)
                              form.setValue('country', place.country)
                              form.setValue('zipCode', place.zipCode)
                              form.setValue('latitude', place.latitude)
                              form.setValue('longitude', place.longitude)
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      rules={{ required: 'City is required' }}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('venueMgmt.location.city')}</FormLabel>
                          <FormControl>
                            <Input placeholder={t('venueMgmt.location.cityPlaceholder')} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      rules={{ required: 'State is required' }}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('venueMgmt.location.state')}</FormLabel>
                          <FormControl>
                            <Input placeholder={t('venueMgmt.location.statePlaceholder')} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      rules={{ required: 'ZIP code is required' }}
                      name="zipCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('venueMgmt.location.zipCode')}</FormLabel>
                          <FormControl>
                            <Input placeholder="06700" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="timezone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('venueMgmt.location.timezone')}</FormLabel>
                          <FormControl>
                            <TimezoneCombobox
                              value={field.value}
                              onValueChange={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="currency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('venueMgmt.location.currency')}</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="MXN">{t('venueMgmt.currencies.MXN')}</SelectItem>
                              <SelectItem value="USD">{t('venueMgmt.currencies.USD')}</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="payment" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <CreditCard className="w-4 h-4" />
                    <span>{t('venueMgmt.paymentSetup.title')}</span>
                  </CardTitle>
                  <CardDescription>{t('venueMgmt.paymentSetup.description')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="enablePaymentProcessing"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">{t('venueMgmt.paymentSetup.enablePaymentProcessing')}</FormLabel>
                          <div className="text-sm text-muted-foreground">{t('venueMgmt.paymentSetup.enablePaymentProcessingDesc')}</div>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {form.watch('enablePaymentProcessing') && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="primaryAccountId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('venueMgmt.paymentSetup.primaryAccount')}</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder={t('venueMgmt.paymentSetup.primaryAccountPlaceholder')} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {merchantAccounts?.map(account => (
                                    <SelectItem key={account.id} value={account.id}>
                                      {account.alias || account.externalMerchantId} ({account.providerName})
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
                          name="secondaryAccountId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('venueMgmt.paymentSetup.secondaryAccountOptional')}</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder={t('venueMgmt.paymentSetup.secondaryAccountPlaceholder')} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="">{tCommon('none')}</SelectItem>
                                  {merchantAccounts?.map(account => (
                                    <SelectItem key={account.id} value={account.id}>
                                      {account.alias || account.externalMerchantId} ({account.providerName})
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
                          name="tertiaryAccountId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('venueMgmt.paymentSetup.tertiaryAccountOptional')}</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder={t('venueMgmt.paymentSetup.tertiaryAccountPlaceholder')} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="">{tCommon('none')}</SelectItem>
                                  {merchantAccounts?.map(account => (
                                    <SelectItem key={account.id} value={account.id}>
                                      {account.alias || account.externalMerchantId} ({account.providerName})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="rounded-lg border p-4 bg-muted/30">
                        <h4 className="font-medium mb-2">{t('venueMgmt.paymentSetup.rules.title')}</h4>
                        <p className="text-sm text-muted-foreground mb-3">
                          {t('venueMgmt.paymentSetup.routingDesc')}
                        </p>
                        <div className="text-sm space-y-1">
                          <div>
                            • <strong>{t('venueMgmt.paymentSetup.rules.primary')}</strong> {t('venueMgmt.paymentSetup.rules.primaryDesc')}
                          </div>
                          <div>
                            • <strong>{t('venueMgmt.paymentSetup.rules.secondary')}</strong>{' '}
                            {t('venueMgmt.paymentSetup.rules.secondaryDesc')}
                          </div>
                          <div>
                            • <strong>{t('venueMgmt.paymentSetup.rules.tertiary')}</strong> {t('venueMgmt.paymentSetup.rules.tertiaryDesc')}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="pricing" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Calculator className="w-4 h-4" />
                    <span>{t('venueMgmt.pricing.title')}</span>
                  </CardTitle>
                  <CardDescription>{t('venueMgmt.pricing.pricingDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="setupPricingStructure"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">{t('venueMgmt.pricing.setupTitle')}</FormLabel>
                          <div className="text-sm text-muted-foreground">{t('venueMgmt.pricing.setupDesc')}</div>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {form.watch('setupPricingStructure') && (
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="pricingTier"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('venueMgmt.pricing.tier')}</FormLabel>
                            <Select onValueChange={handlePricingTierChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {Object.entries(pricingTiers).map(([key, tier]) => (
                                  <SelectItem key={key} value={key}>
                                    <div>
                                      <div className="font-medium">{tier.name}</div>
                                      <div className="text-xs text-muted-foreground">{tier.description}</div>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Pricing Tier Preview */}
                      <div className="rounded-lg border p-4 bg-blue-50 dark:bg-blue-950/30">
                        <h4 className="font-medium mb-3 flex items-center space-x-2">
                          <DollarSign className="w-4 h-4" />
                          <span>{t('venueMgmt.pricing.preview.title')}</span>
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <span className="text-muted-foreground">{t('venueMgmt.pricing.preview.debitCards')}</span>
                            <div className="font-medium">{formatPercentage(form.watch('debitRate') || 0)}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">{t('venueMgmt.pricing.preview.creditCards')}</span>
                            <div className="font-medium">{formatPercentage(form.watch('creditRate') || 0)}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">{t('venueMgmt.pricing.preview.amex')}</span>
                            <div className="font-medium">{formatPercentage(form.watch('amexRate') || 0)}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">{t('venueMgmt.pricing.preview.international')}</span>
                            <div className="font-medium">{formatPercentage(form.watch('internationalRate') || 0)}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">{t('venueMgmt.pricing.preview.fixedFee')}</span>
                            <div className="font-medium">{formatCurrency(form.watch('fixedFeePerTransaction') || 0)}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">{t('venueMgmt.pricing.preview.monthlyFee')}</span>
                            <div className="font-medium">{formatCurrency(form.watch('monthlyServiceFee') || 0)}</div>
                          </div>
                        </div>
                      </div>

                      {/* Custom pricing fields for CUSTOM tier */}
                      {form.watch('pricingTier') === 'CUSTOM' && (
                        <div className="space-y-4">
                          <h4 className="font-medium">{t('venueMgmt.pricing.customRates')}</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <FormField
                              control={form.control}
                              name="debitRate"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('venueMgmt.pricing.debitRate')}</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      step="0.001"
                                      min="0"
                                      max="0.1"
                                      placeholder="0.020"
                                      {...field}
                                      onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="creditRate"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('venueMgmt.pricing.creditRate')}</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      step="0.001"
                                      min="0"
                                      max="0.1"
                                      placeholder="0.030"
                                      {...field}
                                      onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="amexRate"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('venueMgmt.pricing.amexRate')}</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      step="0.001"
                                      min="0"
                                      max="0.1"
                                      placeholder="0.040"
                                      {...field}
                                      onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="internationalRate"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('venueMgmt.pricing.internationalRate')}</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      step="0.001"
                                      min="0"
                                      max="0.1"
                                      placeholder="0.045"
                                      {...field}
                                      onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="fixedFeePerTransaction"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('venueMgmt.pricing.fixedFeePerTransaction')}</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      placeholder="0.75"
                                      {...field}
                                      onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="monthlyServiceFee"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('venueMgmt.pricing.monthlyServiceFee')}</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      placeholder="799.00"
                                      {...field}
                                      onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <DialogFooter className="flex justify-between">
            <div className="flex space-x-2">
              <Button variant="outline" type="button" onClick={onClose} disabled={uploading || isPending}>
                {t('cancel')}
              </Button>
              {currentStep !== 'basic' && (
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => {
                    const steps = ['basic', 'location', 'payment', 'pricing']
                    const currentIndex = steps.indexOf(currentStep)
                    if (currentIndex > 0) {
                      setCurrentStep(steps[currentIndex - 1])
                    }
                  }}
                  disabled={uploading || isPending}
                >
                  {tCommon('previous')}
                </Button>
              )}
            </div>
            <div className="flex space-x-2">
              {currentStep !== 'pricing' ? (
                <Button
                  type="button"
                  onClick={() => {
                    const steps = ['basic', 'location', 'payment', 'pricing']
                    const currentIndex = steps.indexOf(currentStep)
                    if (currentIndex < steps.length - 1) {
                      setCurrentStep(steps[currentIndex + 1])
                    }
                  }}
                  disabled={uploading || isPending}
                >
                  {tCommon('next')}
                </Button>
              ) : (
                <Button type="submit" disabled={uploading || !imageUrl || isPending} className="bg-green-600 hover:bg-green-700">
                  {isPending ? t('venueMgmt.addVenue.creating') : t('venueMgmt.addVenue.create')}
                </Button>
              )}
            </div>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  )
}
