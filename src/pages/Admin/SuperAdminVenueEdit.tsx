import api from '@/api'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ArrowLeft } from 'lucide-react'
import { useState, useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import countryList from 'react-select-country-list'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'

// Define venue types as string literals instead of enums to avoid linting errors
const VENUE_TYPES = {
  RESTAURANT: 'RESTAURANT',
  STUDIO: 'STUDIO',
  BAR: 'BAR',
  CAFE: 'CAFE',
  OTHER: 'OTHER',
}

const POS_NAMES = {
  WANSOFT: 'WANSOFT',
  SOFTRESTAURANT: 'SOFTRESTAURANT',
  NONE: 'NONE',
}

// Extended schema with editable feature flags for SuperAdmin
const superAdminVenueFormSchema = z.object({
  name: z.string().min(3, { message: 'Name must be at least 3 characters.' }),
  posName: z.string().nullable().optional(),
  posUniqueId: z.string().nullable().optional(),

  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  utc: z.string().nullable().default('America/Mexico_City'),
  instagram: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  website: z.string().nullable().optional(),
  language: z.string().nullable().default('es'),
  image: z.string().nullable().optional(),
  logo: z.string().nullable().optional(),
  cuisine: z.string().nullable().optional(),
  dynamicMenu: z.boolean().default(false),
  wifiName: z.string().nullable().optional(),
  wifiPassword: z.string().nullable().optional(),
  softRestaurantVenueId: z.string().nullable().optional(),
  tipPercentage1: z.string().default('0.10'),
  tipPercentage2: z.string().default('0.15'),
  tipPercentage3: z.string().default('0.20'),
  tipPercentages: z.array(z.number()).default([0.1, 0.15, 0.2]),
  askNameOrdering: z.boolean().default(false),
  googleBusinessId: z.string().nullable().optional(),
  stripeAccountId: z.string().nullable().optional(),
  specialPayment: z.boolean().default(false),
  specialPaymentRef: z.string().nullable().optional(),

  // Features (editable for SuperAdmin)
  ordering: z.boolean().default(false),
  chatbot: z.boolean().default(false),

  // Menta fields
  merchantIdA: z.string().nullable().optional(),
  merchantIdB: z.string().nullable().optional(),
  apiKeyA: z.string().nullable().optional(),
  apiKeyB: z.string().nullable().optional(),
})

type SuperAdminVenueFormValues = z.infer<typeof superAdminVenueFormSchema>

// Skeleton component for loading state
function VenueSkeleton() {
  return (
    <div className={`space-y-6 bg-background h-screen p-4`}>
      <div className="sticky top-0 z-20 flex flex-row justify-between w-full px-4 py-3 bg-background/95 border-b shadow-md backdrop-blur-sm">
        <div className="space-x-3 flex items-center">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-6 w-40" />
        </div>
        <div className="space-x-2 flex items-center">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>

      <div className="container mx-auto pt-6 pb-20 px-3 md:px-4 flex-grow overflow-auto">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96 mb-6" />
        </div>
        <div className="space-y-6 md:space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
              <Skeleton className="h-7 w-48 mb-2" />
              <Skeleton className="h-0.5 w-full mb-6" />
              <div className="space-y-4">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SuperAdminVenueEdit() {
  const { t } = useTranslation()
  const { venueId } = useParams()
  const location = useLocation()
  const { toast } = useToast()
  const navigate = useNavigate()
  const from = (location.state as any)?.from || '/admin/venues'
  const queryClient = useQueryClient()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')

  // Get country list for select dropdown
  const countries = countryList()
    .getData()
    .map(country => ({
      value: country.value,
      label: `${country.label} (${country.value})`,
    }))

  // Set up form with resolver and default values
  const form = useForm<SuperAdminVenueFormValues>({
    resolver: zodResolver(superAdminVenueFormSchema),
    defaultValues: {
      name: '',
      posName: null,
      posUniqueId: '',
      address: '',
      city: '',
      type: null,
      country: '',
      utc: 'America/Mexico_City',
      instagram: '',
      phone: '',
      email: '',
      website: '',
      language: 'es',
      image: '',
      logo: '',
      cuisine: '',
      dynamicMenu: false,
      wifiName: '',
      wifiPassword: '',
      softRestaurantVenueId: '',
      tipPercentage1: '0.10',
      tipPercentage2: '0.15',
      tipPercentage3: '0.20',
      tipPercentages: [0.1, 0.15, 0.2],
      askNameOrdering: false,
      googleBusinessId: '',
      stripeAccountId: '',
      specialPayment: false,
      specialPaymentRef: '',
      ordering: false,
      chatbot: false,
      merchantIdA: '',
      merchantIdB: '',
      apiKeyA: '',
      apiKeyB: '',
    },
  })

  // Query to fetch venue data
  const { data: venue, isLoading } = useQuery({
    queryKey: ['get-venue-data-superadmin', venueId],
    queryFn: async () => {
      const response = await api.get(`/v2/dashboard/${venueId}/venue`)
      return response.data
    },
  })

  // Update form values when venue data is loaded
  useEffect(() => {
    if (venue) {
      console.log('SuperAdmin venue data:', venue)

      form.reset({
        name: venue.name || '',
        posName: venue.posName || null,
        posUniqueId: venue.posUniqueId || '',
        address: venue.address || '',
        city: venue.city || '',
        type: venue.type || null,
        country: venue.country || '',
        utc: venue.utc || 'America/Mexico_City',
        instagram: venue.instagram || '',
        phone: venue.phone || '',
        email: venue.email || '',
        website: venue.website || '',
        language: venue.language || 'es',
        image: venue.image || '',
        logo: venue.logo || '',
        cuisine: venue.cuisine || '',
        dynamicMenu: venue.dynamicMenu || false,
        wifiName: venue.wifiName || '',
        wifiPassword: venue.wifiPassword || '',
        softRestaurantVenueId: venue.softRestaurantVenueId || '',
        tipPercentage1: venue.tipPercentage1 || '0.10',
        tipPercentage2: venue.tipPercentage2 || '0.15',
        tipPercentage3: venue.tipPercentage3 || '0.20',
        tipPercentages: venue.tipPercentages || [0.1, 0.15, 0.2],
        askNameOrdering: venue.askNameOrdering || false,
        googleBusinessId: venue.googleBusinessId || '',
        stripeAccountId: venue.stripeAccountId || '',
        specialPayment: venue.specialPayment || false,
        specialPaymentRef: venue.specialPaymentRef || '',
        ordering: venue.feature?.ordering || false,
        chatbot: venue.feature?.chatbot || false,
        merchantIdA: venue.menta?.merchantIdA || '',
        merchantIdB: venue.menta?.merchantIdB || '',
        apiKeyA: venue.menta?.apiKeyA || '',
        apiKeyB: venue.menta?.apiKeyB || '',
      })
    }
  }, [venue, form])

  // Mutation to save venue data
  const saveVenue = useMutation({
    mutationFn: async (data: SuperAdminVenueFormValues) => {
      // Create a clean object with only the fields that have values
      const venueData: any = {}

      // Process all fields and only include non-null/non-undefined values
      Object.entries(data).forEach(([key, value]) => {
        // Skip the Menta fields and Feature fields as they'll be handled separately
        if (key !== 'merchantIdA' && key !== 'merchantIdB' && key !== 'apiKeyA' && key !== 'apiKeyB' && key !== 'ordering') {
          if (value !== null && value !== undefined && value !== '') {
            venueData[key] = value
          }
        }
      })

      // Add feature object with proper Prisma relation syntax
      venueData.feature = {
        upsert: {
          create: {
            ordering: data.ordering,
            chatbot: data.chatbot,
          },
          update: {
            ordering: data.ordering,
            chatbot: data.chatbot,
          },
        },
      }

      // Only add the menta object if at least one of the fields has a value
      if (data.merchantIdA || data.merchantIdB || data.apiKeyA || data.apiKeyB) {
        venueData.menta = {
          merchantIdA: data.merchantIdA || null,
          merchantIdB: data.merchantIdB || null,
          apiKeyA: data.apiKeyA || null,
          apiKeyB: data.apiKeyB || null,
        }
      }

      return await api.put(`/v2/dashboard/venues/${venueId}`, venueData)
    },
    onSuccess: () => {
      toast({
        title: t('admin.venueEdit.venueUpdated'),
        description: t('admin.venueEdit.venueUpdatedDesc'),
      })
      queryClient.invalidateQueries({ queryKey: ['get-venue-data-superadmin', venueId] })
    },
    onError: error => {
      toast({
        title: t('admin.venueEdit.updateError'),
        description: t('admin.venueEdit.updateErrorDesc'),
        variant: 'destructive',
      })
      console.error('Error updating venue:', error)
    },
  })

  const handleDialogChange = (open: boolean) => {
    setShowDeleteDialog(open)
    if (!open) {
      setDeleteConfirmation('')
    }
  }

  const deleteVenue = useMutation({
    mutationFn: async () => {
      await api.delete(`/v2/dashboard/venues/${venueId}`)
    },
    onSuccess: () => {
      toast({
        title: t('admin.venueEdit.venueDeleted'),
        description: t('admin.venueEdit.venueDeletedDesc'),
      })
      queryClient.invalidateQueries({ queryKey: ['status'] })
      navigate(from)
    },
  })

  function onSubmit(formValues: SuperAdminVenueFormValues) {
    saveVenue.mutate(formValues)
  }

  if (isLoading) return <VenueSkeleton />

  const expectedDeleteText = `delete ${venue?.name}`
  const isDeleteConfirmed = deleteConfirmation.toLowerCase() === expectedDeleteText.toLowerCase()

  return (
    <div className={`p-4 md:p-6 lg:p-8 bg-background min-h-screen`}>
      <Link to="/admin" className={`inline-flex items-center text-sm text-foregroundMuted hover:text-foreground mb-6`}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        {t('admin.venueEdit.backToAdmin')}
      </Link>
      {/* Original content starts here */}
      <div className="sticky top-0 z-20 flex flex-row justify-between w-full px-4 py-3 bg-background/95 border-b shadow-md backdrop-blur-sm">
        <div className="space-x-3 flex items-center">
          <Link to={from} className="flex items-center hover:text-primary">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <span className={`font-medium truncate max-w-[200px] md:max-w-none text-foreground`}>
            {venue?.name} <span className={`text-xs text-foregroundMuted`}>({t('admin.venueEdit.superadmin')})</span>
          </span>
        </div>
        <div className="space-x-2 flex items-center">
          <Button
            variant="outline"
            size="sm"
            className="px-3 md:px-4 whitespace-nowrap"
            disabled={!form.formState.isDirty || saveVenue.isPending}
            onClick={form.handleSubmit(onSubmit)}
          >
            {saveVenue.isPending ? t('admin.venueEdit.saving') : t('admin.venueEdit.save')}
          </Button>
          <Button variant="destructive" size="sm" className="px-3 md:px-4" onClick={() => setShowDeleteDialog(true)}>
            {t('admin.venueEdit.delete')}
          </Button>
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={handleDialogChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.venueEdit.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.venueEdit.deleteConfirmDesc', { venueName: venue?.name })}
            </AlertDialogDescription>
            <div className="mt-4">
              <Input
                value={deleteConfirmation}
                onChange={e => setDeleteConfirmation(e.target.value)}
                placeholder={`delete ${venue?.name}`}
                className="mt-2"
              />
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('admin.venueEdit.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteVenue.mutate()}
              disabled={!isDeleteConfirmed}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteVenue.isPending ? t('admin.venueEdit.deleting') : t('admin.venueEdit.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="max-w-7xl mx-auto p-6 space-y-8">
        <div>
          <h2 className={`text-3xl font-semibold text-foreground`}>{t('admin.venueEdit.title')}</h2>
          <p className={`text-foregroundMuted`}>{t('admin.venueEdit.subtitle')}</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-6">
                <h3 className={`text-lg font-medium text-foreground`}>{t('admin.venueEdit.basicInfo')}</h3>
                <Separator />

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('admin.venueEdit.name')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('admin.venueEdit.namePlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('admin.venueEdit.type')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('admin.venueEdit.selectType')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={VENUE_TYPES.RESTAURANT}>{t('admin.venueEdit.types.restaurant')}</SelectItem>
                          <SelectItem value={VENUE_TYPES.STUDIO}>{t('admin.venueEdit.types.studio')}</SelectItem>
                          <SelectItem value={VENUE_TYPES.BAR}>{t('admin.venueEdit.types.bar')}</SelectItem>
                          <SelectItem value={VENUE_TYPES.CAFE}>{t('admin.venueEdit.types.cafe')}</SelectItem>
                          <SelectItem value={VENUE_TYPES.OTHER}>{t('admin.venueEdit.types.other')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('admin.venueEdit.address')}</FormLabel>
                      <FormControl>
                        <Textarea placeholder={t('admin.venueEdit.addressPlaceholder')} className="resize-none" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('admin.venueEdit.city')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('admin.venueEdit.cityPlaceholder')} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('admin.venueEdit.country')}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('admin.venueEdit.selectCountry')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {countries.map(country => (
                              <SelectItem key={country.value} value={country.value}>
                                {country.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-6">
                <h3 className={`text-lg font-medium text-foreground`}>{t('admin.venueEdit.premiumFeatures')}</h3>
                <Separator />

                <div className="p-4 mb-6 border-l-4 border-amber-500/30 rounded-sm bg-amber-500/10">
                  <h4 className={`text-base font-medium mb-1 text-foreground`}>{t('admin.venueEdit.featureConfigTitle')}</h4>
                  <p className={`text-sm text-foregroundMuted`}>
                    {t('admin.venueEdit.featureConfigDesc')}
                  </p>
                </div>

                <FormField
                  control={form.control}
                  name="ordering"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 border rounded-md hover:bg-muted/50">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>{t('admin.venueEdit.orderingFeature')}</FormLabel>
                        <p className={`text-sm text-foregroundMuted`}>
                          {t('admin.venueEdit.orderingFeatureDesc')}
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="chatbot"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 border rounded-md hover:bg-muted/50">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>{t('admin.venueEdit.chatbotFeature')}</FormLabel>
                        <p className={`text-sm text-foregroundMuted`}>
                          {t('admin.venueEdit.chatbotFeatureDesc')}
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

                {/* Espacio para futuras características premium */}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-6">
                <h3 className={`text-lg font-medium text-foreground`}>{t('admin.venueEdit.contactAndImages')}</h3>
                <Separator />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('admin.venueEdit.email')}</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder={t('admin.venueEdit.emailPlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('admin.venueEdit.phone')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('admin.venueEdit.phonePlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('admin.venueEdit.website')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('admin.venueEdit.websitePlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="instagram"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('admin.venueEdit.instagram')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('admin.venueEdit.instagramPlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-6">
                <h3 className={`text-lg font-medium text-foreground`}>{t('admin.venueEdit.paymentConfig')}</h3>
                <Separator />

                <FormField
                  control={form.control}
                  name="stripeAccountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('admin.venueEdit.stripeAccountId')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('admin.venueEdit.stripeAccountIdPlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="specialPayment"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 border rounded-md">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>{t('admin.venueEdit.specialPayment')}</FormLabel>
                        <p className={cn('text-foregroundMuted')}>{t('admin.venueEdit.specialPaymentDesc')}</p>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-6">
                <h3 className={`text-lg font-medium text-foreground`}>{t('admin.venueEdit.mentaIntegration')}</h3>
                <Separator />

                <FormField
                  control={form.control}
                  name="merchantIdA"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('admin.venueEdit.merchantIdA')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('admin.venueEdit.merchantIdAPlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="merchantIdB"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('admin.venueEdit.merchantIdB')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('admin.venueEdit.merchantIdBPlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="apiKeyA"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('admin.venueEdit.apiKeyA')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('admin.venueEdit.apiKeyAPlaceholder')} {...field} type="password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="apiKeyB"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('admin.venueEdit.apiKeyB')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('admin.venueEdit.apiKeyBPlaceholder')} {...field} type="password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-6">
                <h3 className={`text-lg font-medium text-foreground`}>{t('admin.venueEdit.systemConfig')}</h3>
                <Separator />

                <FormField
                  control={form.control}
                  name="posName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('admin.venueEdit.posSystem')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('admin.venueEdit.selectPosSystem')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={POS_NAMES.WANSOFT}>{t('admin.venueEdit.posNames.wansoft')}</SelectItem>
                          <SelectItem value={POS_NAMES.SOFTRESTAURANT}>{t('admin.venueEdit.posNames.softRestaurant')}</SelectItem>
                          <SelectItem value={POS_NAMES.NONE}>{t('admin.venueEdit.posNames.none')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="posUniqueId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('admin.venueEdit.posUniqueId')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('admin.venueEdit.posUniqueIdPlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </form>
        </Form>
      </div>
    </div>
  )
}
