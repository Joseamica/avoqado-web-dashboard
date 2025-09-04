import React, { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { getDownloadURL, ref, uploadBytesResumable, deleteObject } from 'firebase/storage'
import { storage } from '@/firebase'
import { Button } from '../ui/button'
import { DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useForm } from 'react-hook-form'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { Switch } from '../ui/switch'
import { getCroppedImg } from '@/utils/cropImage'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/context/AuthContext'
import api from '@/api'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useTranslation } from 'react-i18next'
import * as costManagementAPI from '@/services/cost-management.service'
import { Building, CreditCard, DollarSign, Settings, Calculator, Info } from 'lucide-react'

interface EnhancedAddVenueDialogProps {
  onClose: () => void
  navigate: (path: string) => void
}

interface VenueFormData {
  // Basic venue information
  name: string
  type: string
  logo: string
  pos: string
  address: string
  city: string
  state: string
  country: string
  zipCode: string
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
  const { t } = useTranslation()
  const form = useForm<VenueFormData>({
    defaultValues: {
      name: '',
      type: '',
      logo: '',
      pos: 'SOFTRESTAURANT',
      address: '',
      city: '',
      state: '',
      country: 'MX',
      zipCode: '',
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
  
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const [uploading, setUploading] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [fileRef, setFileRef] = useState<any>(null)
  const [currentStep, setCurrentStep] = useState('basic')

  // Fetch payment providers and merchant accounts for configuration
  const { data: providers } = useQuery({
    queryKey: ['payment-providers'],
    queryFn: () => costManagementAPI.getProvidersList(),
  })

  const { data: merchantAccounts } = useQuery({
    queryKey: ['merchant-accounts'],
    queryFn: () => costManagementAPI.getMerchantAccountsList(),
  })

  // Predefined pricing tiers
  const pricingTiers = {
    STANDARD: {
      name: 'Standard',
      description: 'Basic rates for most venues',
      debitRate: 0.020,      // 2.0%
      creditRate: 0.030,     // 3.0%
      amexRate: 0.040,       // 4.0%
      internationalRate: 0.045, // 4.5%
      fixedFeePerTransaction: 0.75,
      monthlyServiceFee: 799.00,
    },
    PREMIUM: {
      name: 'Premium',
      description: 'Reduced rates for high-volume venues',
      debitRate: 0.018,      // 1.8%
      creditRate: 0.028,     // 2.8%
      amexRate: 0.038,       // 3.8%
      internationalRate: 0.043, // 4.3%
      fixedFeePerTransaction: 0.70,
      monthlyServiceFee: 1299.00,
    },
    ENTERPRISE: {
      name: 'Enterprise',
      description: 'Best rates for enterprise clients',
      debitRate: 0.015,      // 1.5%
      creditRate: 0.025,     // 2.5%
      amexRate: 0.035,       // 3.5%
      internationalRate: 0.040, // 4.0%
      fixedFeePerTransaction: 0.65,
      monthlyServiceFee: 1999.00,
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
      const response = await api.post('/v2/dashboard/venue/enhanced', data)
      return response.data
    },
    onSuccess: (result) => {
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
    const storageRef = ref(storage, `venues/${venueId}/logos/${fileName}`)
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
    mutate({ ...formValues, userId: user?.id })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
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
          <span>Create New Venue</span>
        </DialogTitle>
        <DialogDescription>
          Set up a new venue with complete payment processing and pricing configuration.
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Tabs value={currentStep} onValueChange={setCurrentStep} className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="location">Location</TabsTrigger>
              <TabsTrigger value="payment">Payment Setup</TabsTrigger>
              <TabsTrigger value="pricing">Pricing</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Info className="w-4 h-4" />
                    <span>Basic Information</span>
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
                          <FormLabel>Venue Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Tacos El Rey - Roma Norte" {...field} />
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
                          <FormLabel>Venue Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select venue type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="RESTAURANT">Restaurant</SelectItem>
                              <SelectItem value="BAR">Bar</SelectItem>
                              <SelectItem value="CAFE">Café</SelectItem>
                              <SelectItem value="FAST_FOOD">Fast Food</SelectItem>
                              <SelectItem value="FOOD_TRUCK">Food Truck</SelectItem>
                              <SelectItem value="RETAIL_STORE">Retail Store</SelectItem>
                              <SelectItem value="OTHER">Other</SelectItem>
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
                          <FormLabel>Phone Number</FormLabel>
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
                          message: 'Invalid email address'
                        }
                      }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input placeholder="contact@venue.com" type="email" {...field} />
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
                        <FormLabel>Website (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="https://venue.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    rules={{ required: 'Logo is required' }}
                    name="logo"
                    render={() => (
                      <FormItem>
                        <FormLabel>Venue Logo</FormLabel>
                        <FormControl>
                          <div className="pb-4">
                            {imageUrl ? (
                              <div className="flex flex-col items-center space-y-2">
                                <img src={imageUrl} alt="Logo" className="object-cover rounded-md max-w-32 max-h-32" />
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
                                    Cancel
                                  </Button>
                                  <Button type="button" onClick={handleCropConfirm} disabled={uploading}>
                                    Confirm Logo
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
                  <CardTitle>Location & Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    rules={{ required: 'Address is required' }}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Street Address</FormLabel>
                        <FormControl>
                          <Input placeholder="Álvaro Obregón 123" {...field} />
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
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input placeholder="Mexico City" {...field} />
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
                          <FormLabel>State</FormLabel>
                          <FormControl>
                            <Input placeholder="CDMX" {...field} />
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
                          <FormLabel>ZIP Code</FormLabel>
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
                          <FormLabel>Timezone</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="America/Mexico_City">Mexico City (GMT-6)</SelectItem>
                              <SelectItem value="America/Cancun">Cancun (GMT-5)</SelectItem>
                              <SelectItem value="America/Tijuana">Tijuana (GMT-8)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="currency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Currency</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="MXN">Mexican Peso (MXN)</SelectItem>
                              <SelectItem value="USD">US Dollar (USD)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="pos"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>POS System Integration</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="SOFTRESTAURANT">SoftRestaurant</SelectItem>
                            <SelectItem value="SQUARE">Square</SelectItem>
                            <SelectItem value="TOAST">Toast</SelectItem>
                            <SelectItem value="NONE">No Integration</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="payment" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <CreditCard className="w-4 h-4" />
                    <span>Payment Processing Setup</span>
                  </CardTitle>
                  <CardDescription>
                    Configure payment processing with merchant accounts and routing rules.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="enablePaymentProcessing"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Enable Payment Processing
                          </FormLabel>
                          <div className="text-sm text-muted-foreground">
                            Allow this venue to process payments through Avoqado
                          </div>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
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
                              <FormLabel>Primary Account</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select primary account" />
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
                              <FormLabel>Secondary Account (Optional)</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select secondary account" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="">None</SelectItem>
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
                              <FormLabel>Tertiary Account (Optional)</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select tertiary account" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="">None</SelectItem>
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
                        <h4 className="font-medium mb-2">Payment Routing Rules</h4>
                        <p className="text-sm text-muted-foreground mb-3">
                          Configure automatic routing based on business rules (can be customized later).
                        </p>
                        <div className="text-sm space-y-1">
                          <div>• <strong>Primary Account:</strong> Default for all transactions</div>
                          <div>• <strong>Secondary Account:</strong> Used when customer needs invoice</div>
                          <div>• <strong>Tertiary Account:</strong> Used for high-value transactions (&gt; $5,000)</div>
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
                    <span>Pricing Configuration</span>
                  </CardTitle>
                  <CardDescription>
                    Set transaction fees and monthly charges for this venue.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="setupPricingStructure"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Setup Pricing Structure
                          </FormLabel>
                          <div className="text-sm text-muted-foreground">
                            Configure transaction fees and monthly charges now
                          </div>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
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
                            <FormLabel>Pricing Tier</FormLabel>
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
                          <span>Pricing Preview</span>
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <span className="text-muted-foreground">Debit Cards:</span>
                            <div className="font-medium">{formatPercentage(form.watch('debitRate') || 0)}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Credit Cards:</span>
                            <div className="font-medium">{formatPercentage(form.watch('creditRate') || 0)}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">American Express:</span>
                            <div className="font-medium">{formatPercentage(form.watch('amexRate') || 0)}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">International:</span>
                            <div className="font-medium">{formatPercentage(form.watch('internationalRate') || 0)}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Fixed Fee:</span>
                            <div className="font-medium">{formatCurrency(form.watch('fixedFeePerTransaction') || 0)}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Monthly Fee:</span>
                            <div className="font-medium">{formatCurrency(form.watch('monthlyServiceFee') || 0)}</div>
                          </div>
                        </div>
                      </div>

                      {/* Custom pricing fields for CUSTOM tier */}
                      {form.watch('pricingTier') === 'CUSTOM' && (
                        <div className="space-y-4">
                          <h4 className="font-medium">Custom Pricing Rates</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <FormField
                              control={form.control}
                              name="debitRate"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Debit Rate (%)</FormLabel>
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
                                  <FormLabel>Credit Rate (%)</FormLabel>
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
                                  <FormLabel>Amex Rate (%)</FormLabel>
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
                                  <FormLabel>International Rate (%)</FormLabel>
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
                                  <FormLabel>Fixed Fee per Transaction</FormLabel>
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
                                  <FormLabel>Monthly Service Fee</FormLabel>
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
                Cancel
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
                  Previous
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
                  Next
                </Button>
              ) : (
                <Button 
                  type="submit" 
                  disabled={uploading || !imageUrl || isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isPending ? 'Creating Venue...' : 'Create Venue'}
                </Button>
              )}
            </div>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  )
}