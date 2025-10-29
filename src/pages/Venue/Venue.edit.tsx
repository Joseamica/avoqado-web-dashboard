import api from '@/api'
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { ColorPicker } from '@/components/ui/color-picker'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/context/AuthContext'
import { StaffRole } from '@/types'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, AlertCircle, FileText } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import countryList from 'react-select-country-list'
import { z } from 'zod'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useTranslation } from 'react-i18next'
import { TimezoneCombobox } from '@/components/timezone-combobox'
import { useVenueEditActions } from './VenueEditLayout'
// Image upload and crop support
import Cropper from 'react-easy-crop'
import { storage } from '@/firebase'
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage'
import { getCroppedImg } from '@/utils/cropImage'

// Enums to match Prisma schema exactly
enum VenueType {
  RESTAURANT = 'RESTAURANT',
  BAR = 'BAR',
  CAFE = 'CAFE',
  FAST_FOOD = 'FAST_FOOD',
  FOOD_TRUCK = 'FOOD_TRUCK',
  RETAIL_STORE = 'RETAIL_STORE',
  HOTEL_RESTAURANT = 'HOTEL_RESTAURANT',
  FITNESS_STUDIO = 'FITNESS_STUDIO',
  SPA = 'SPA',
  OTHER = 'OTHER',
}

const venueFormSchema = z.object({
  // Required fields from Prisma schema
  name: z.string().min(3, { message: 'El nombre debe tener al menos 3 caracteres.' }),
  address: z.string().min(1, { message: 'La dirección es requerida.' }),
  city: z.string().min(1, { message: 'La ciudad es requerida.' }),
  state: z.string().min(1, { message: 'El estado es requerido.' }),
  country: z.string().min(1, { message: 'El país es requerido.' }).default('MX'),
  zipCode: z.string().min(1, { message: 'El código postal es requerido.' }),
  phone: z.string().min(1, { message: 'El teléfono es requerido.' }),
  email: z.string().email({ message: 'Debe ser un email válido.' }),

  // Optional fields from Prisma schema
  type: z.nativeEnum(VenueType).default(VenueType.RESTAURANT),
  timezone: z.string().default('America/Mexico_City'),
  currency: z.string().default('MXN'),
  website: z.string().nullable().optional(),
  logo: z.string().nullable().optional(),
  primaryColor: z.string().nullable().optional(),
  secondaryColor: z.string().nullable().optional(),

  // Location coordinates
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
})

type VenueFormValues = z.infer<typeof venueFormSchema>

// Add a VenueSkeleton component
function VenueSkeleton() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
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

      <div className="container mx-auto pt-6 pb-20 px-3 md:px-4 grow overflow-auto">
        <div className="space-y-6 md:space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
              <Skeleton className="h-7 w-48 mb-2" />
              <Skeleton className="h-0.5 w-full mb-6" />

              <div className="space-y-4">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>

              <div className="space-y-4">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>

              <div className="space-y-4">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>

              <div className="space-y-4">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-20 w-full" />
              </div>
            </div>

            <div className="space-y-6">
              <Skeleton className="h-7 w-48 mb-2" />
              <Skeleton className="h-0.5 w-full mb-6" />

              <div className="space-y-4">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>

              <div className="space-y-4">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>

              <div className="space-y-4">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>

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

export default function EditVenue() {
  const { t } = useTranslation('venue')
  const { venueId } = useCurrentVenue()
  const { user } = useAuth()
  const canEdit = [StaffRole.OWNER, StaffRole.ADMIN, StaffRole.SUPERADMIN].includes((user?.role as StaffRole) || ('' as any))
  const { setActions } = useVenueEditActions()

  // Get the list of countries - moved to top of component
  const countries = useMemo(() => {
    // Obtener la lista de países pero usar el código ISO de dos letras como valor
    const list = countryList().getData()
    return list.map((country: any) => ({
      value: country.value,
      label: `${country.label} (${country.value})`, // Mostrar el código junto al nombre
    }))
  }, [])

  const location = useLocation()
  const { toast } = useToast()
  const navigate = useNavigate()
  const from = (location.state as any)?.from || '/'
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const queryClient = useQueryClient()

  const { data: venue, isLoading } = useQuery({
    queryKey: ['get-venue-data', venueId],
    queryFn: async () => {
      const response = await api.get(`/api/v1/dashboard/venues/${venueId}`)
      return response.data
    },
    enabled: !!venueId,
  })

  const form = useForm<VenueFormValues>({
    resolver: zodResolver(venueFormSchema),
    defaultValues: {
      name: '',
      address: '',
      city: '',
      state: '',
      country: 'MX',
      zipCode: '',
      phone: '',
      email: '',
      type: VenueType.RESTAURANT,
      timezone: 'America/Mexico_City',
      currency: 'MXN',
      website: '',
      logo: '',
      primaryColor: '',
      secondaryColor: '',
      latitude: null,
      longitude: null,
    },
  })

  // Update form values when venue data is loaded
  useEffect(() => {
    if (venue) {
      form.reset({
        name: venue.name || '',
        address: venue.address || '',
        city: venue.city || '',
        state: venue.state || '',
        country: venue.country || 'MX',
        zipCode: venue.zipCode || '',
        phone: venue.phone || '',
        email: venue.email || '',
        type: (venue.type as VenueType) || VenueType.RESTAURANT,
        timezone: venue.timezone || 'America/Mexico_City',
        currency: venue.currency || 'MXN',
        website: venue.website || '',
        logo: venue.logo || '',
        primaryColor: venue.primaryColor || '',
        secondaryColor: venue.secondaryColor || '',
        latitude: venue.latitude ? Number(venue.latitude) : null,
        longitude: venue.longitude ? Number(venue.longitude) : null,
      })
    }
  }, [venue, form])

  // -------- Logo upload + crop --------
  const [uploading, setUploading] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)
  const [imageForCrop, setImageForCrop] = useState<string | null>(null)

  const onCropComplete = useCallback((_: any, area: any) => setCroppedAreaPixels(area), [])

  useEffect(() => {
    if (venue?.logo) setImageUrl(venue.logo)
  }, [venue])

  const handleFileUpload = (file: File | undefined | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setImageForCrop(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleCropConfirm = async () => {
    if (!imageForCrop || !croppedAreaPixels || !venueId) return
    const croppedImage = await getCroppedImg(imageForCrop, croppedAreaPixels)
    const blob = await fetch(croppedImage).then(r => r.blob())

    const fileName = `cropped_${Date.now()}.jpg`
    const storageRef = ref(storage, `venues/${venueId}/logos/${fileName}`)
    const uploadTask = uploadBytesResumable(storageRef, blob)
    setUploading(true)
    uploadTask.on(
      'state_changed',
      () => {},
      error => {
        console.error('Error uploading file:', error)
        setUploading(false)
      },
      () => {
        getDownloadURL(uploadTask.snapshot.ref).then(downloadURL => {
          setImageUrl(downloadURL)
          setUploading(false)
          setImageForCrop(null)
          form.setValue('logo', downloadURL, { shouldDirty: true })

          // Auto-save the logo change immediately
          // Backend will auto-delete the old logo from Firebase Storage
          saveVenue.mutate({ ...form.getValues(), logo: downloadURL })

          toast({
            title: t('edit.toast.logoUploadedTitle', { defaultValue: 'Logo actualizado' }),
            description: t('edit.toast.logoUploadedDesc', { defaultValue: 'El logo se ha actualizado correctamente.' }),
          })
        })
      },
    )
  }

  const handleFileRemove = () => {
    // Update local state
    setImageUrl(null)
    form.setValue('logo', '', { shouldDirty: true })

    // Build payload explicitly to ensure logo is removed
    // IMPORTANT: Backend removes null/undefined fields, so use empty string instead
    const currentValues = form.getValues()
    const payload = {
      ...currentValues,
      logo: '', // Empty string (not null) so backend doesn't filter it out
    }

    // 🎯 NO need to delete from Firebase here - backend auto-cleanup handles it!
    // Backend compares old logo vs new logo and deletes the old one automatically
    // This prevents orphaned files even if user refreshes page or edits from another device

    // Auto-save the logo removal immediately
    saveVenue.mutate(payload, {
      onSuccess: () => {
        toast({
          title: t('edit.toast.logoRemovedTitle', { defaultValue: 'Logo eliminado' }),
          description: t('edit.toast.logoRemovedDesc', { defaultValue: 'El logo se ha eliminado correctamente.' }),
        })
      },
      onError: error => {
        console.error('Error saving logo removal:', error)
        toast({
          title: t('edit.toast.logoErrorTitle', { defaultValue: 'Error con el logo' }),
          description: t('edit.toast.logoErrorDesc', { defaultValue: 'No se pudo procesar la imagen del logo.' }),
          variant: 'destructive',
        })
      },
    })
  }

  const saveVenue = useMutation({
    mutationFn: async (data: VenueFormValues) => {
      // Create venue data object matching Prisma schema
      const venueData: any = {
        name: data.name,
        address: data.address,
        city: data.city,
        state: data.state,
        country: data.country,
        zipCode: data.zipCode,
        phone: data.phone,
        email: data.email,
        type: data.type,
        timezone: data.timezone,
        currency: data.currency,
      }

      // Add optional fields - explicitly handle null/undefined vs empty string
      if (data.website !== undefined && data.website !== null) venueData.website = data.website
      if (data.logo !== undefined) venueData.logo = data.logo // Include even if null (to clear)
      if (data.primaryColor !== undefined && data.primaryColor !== null) venueData.primaryColor = data.primaryColor
      if (data.secondaryColor !== undefined && data.secondaryColor !== null) venueData.secondaryColor = data.secondaryColor
      if (data.latitude !== null && data.latitude !== undefined) venueData.latitude = data.latitude
      if (data.longitude !== null && data.longitude !== undefined) venueData.longitude = data.longitude

      return await api.put(`/api/v1/dashboard/venues/${venueId}`, venueData)
    },
    onSuccess: () => {
      toast({
        title: t('edit.toast.updateSuccess'),
        description: t('edit.toast.updateSuccessDesc'),
      })
      queryClient.invalidateQueries({ queryKey: ['get-venue-data', venueId] })
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || t('edit.toast.updateError')
      toast({
        title: t('edit.toast.updateErrorTitle'),
        description: errorMessage,
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
      await api.delete(`/api/v1/dashboard/venues/${venueId}`)
    },
    onSuccess: () => {
      toast({
        title: t('edit.toast.deleteSuccess'),
        description: t('edit.toast.deleteSuccessDesc'),
      })
      queryClient.invalidateQueries({ queryKey: ['status'] })
      queryClient.invalidateQueries({ queryKey: ['get-venue-data'] })
      navigate(from)
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || t('edit.toast.deleteError')
      toast({
        title: t('edit.toast.deleteErrorTitle'),
        description: errorMessage,
        variant: 'destructive',
      })
      console.error('Error deleting venue:', error)
    },
  })

  const onSubmit = useCallback((formValues: VenueFormValues) => {
    saveVenue.mutate(formValues)
  }, [saveVenue])

  // Register actions with parent layout
  useEffect(() => {
    setActions({
      onSave: form.handleSubmit(onSubmit),
      onCancel: () => form.reset(),
      isDirty: form.formState.isDirty,
      isLoading: saveVenue.isPending,
      canEdit: canEdit,
    })
  }, [form.formState.isDirty, saveVenue.isPending, canEdit, setActions, form, onSubmit])

  if (isLoading) return <VenueSkeleton />

  if (!venue) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">{t('edit.notFound')}</h2>
          <p className="text-muted-foreground mb-4">{t('edit.notFoundDesc')}</p>
          <Button onClick={() => navigate(from)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('common.goBack')}
          </Button>
        </div>
      </div>
    )
  }

  const expectedDeleteText = `delete ${venue.name}`
  const isDeleteConfirmed = deleteConfirmation.toLowerCase() === expectedDeleteText.toLowerCase()

  return (
    <>
      <AlertDialog open={showDeleteDialog} onOpenChange={handleDialogChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('edit.deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('edit.deleteDialog.description', { venueName: venue.name })}</AlertDialogDescription>
            <div className="mt-4">
              <Input
                value={deleteConfirmation}
                onChange={e => setDeleteConfirmation(e.target.value)}
                placeholder={`delete ${venue.name}`}
                className="mt-2"
              />
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteVenue.mutate()}
              disabled={!isDeleteConfirmed}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteVenue.isPending ? t('common.deleting') : t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="container mx-auto pt-6 pb-20 px-3 md:px-4 grow overflow-auto">
        {/* KYC Rejection Warning */}
        {venue.kycStatus === 'REJECTED' && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="font-semibold">{t('edit.kycRejected.title')}</AlertTitle>
            <AlertDescription className="mt-2">
              <p className="mb-3">{t('edit.kycRejected.description')}</p>
              {venue.kycRejectionReason && (
                <p className="mb-4 p-3 bg-destructive/10 rounded-md border border-destructive/20 text-sm">
                  <strong>{t('edit.kycRejected.reason')}</strong> {venue.kycRejectionReason}
                </p>
              )}
              <Button asChild variant="outline" size="sm" className="border-destructive/50 hover:bg-destructive/10">
                <Link to={`/venues/${venue.slug}/edit/documents`}>
                  <FileText className="mr-2 h-4 w-4" />
                  {t('edit.kycRejected.resubmitButton')}
                </Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          {!canEdit && (
            <div className="mb-4 rounded-md border border-border bg-muted/40 text-muted-foreground text-sm px-3 py-2">
              {t('edit.readOnly')}
            </div>
          )}
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 md:space-y-8">
            <fieldset disabled={!canEdit} className={!canEdit ? 'opacity-80' : undefined}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-6">
                  <h3 className="text-lg font-medium">{t('edit.sections.basicInfo')}</h3>
                  <Separator />

                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('edit.labels.name')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('edit.placeholders.name')} {...field} />
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
                        <FormLabel>{t('edit.labels.type')}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('edit.placeholders.type')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={VenueType.RESTAURANT}>{t('edit.types.restaurant')}</SelectItem>
                            <SelectItem value={VenueType.BAR}>{t('edit.types.bar')}</SelectItem>
                            <SelectItem value={VenueType.CAFE}>{t('edit.types.cafe')}</SelectItem>
                            <SelectItem value={VenueType.FAST_FOOD}>{t('edit.types.fastFood')}</SelectItem>
                            <SelectItem value={VenueType.FOOD_TRUCK}>{t('edit.types.foodTruck')}</SelectItem>
                            <SelectItem value={VenueType.RETAIL_STORE}>{t('edit.types.retailStore')}</SelectItem>
                            <SelectItem value={VenueType.HOTEL_RESTAURANT}>{t('edit.types.hotelRestaurant')}</SelectItem>
                            <SelectItem value={VenueType.FITNESS_STUDIO}>{t('edit.types.fitnessStudio')}</SelectItem>
                            <SelectItem value={VenueType.SPA}>{t('edit.types.spa')}</SelectItem>
                            <SelectItem value={VenueType.OTHER}>{t('edit.types.other')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('edit.labels.state')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('edit.placeholders.state')} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="zipCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('edit.labels.zipCode')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('edit.placeholders.zipCode')} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('edit.labels.address')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('edit.placeholders.address')} {...field} />
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
                          <FormLabel>{t('edit.labels.city')}</FormLabel>
                          <FormControl>
                            <Input placeholder={t('edit.placeholders.city')} {...field} />
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
                          <FormLabel>{t('edit.labels.country')}</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ''}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t('edit.placeholders.country')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {countries.map((country: any) => (
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

                  <FormField
                    control={form.control}
                    name="timezone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('edit.labels.timezone', { defaultValue: 'Zona horaria' })}</FormLabel>
                        <FormControl>
                          <TimezoneCombobox value={field.value} onValueChange={field.onChange} disabled={!canEdit} />
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
                        <FormLabel>{t('edit.labels.currency', { defaultValue: 'Moneda' })}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || 'MXN'}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue
                                placeholder={t('edit.placeholders.currency', { defaultValue: 'Selecciona una moneda' })}
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="MXN">{t('edit.currencies.mxn')}</SelectItem>
                            <SelectItem value="USD">{t('edit.currencies.usd')}</SelectItem>
                            <SelectItem value="EUR">{t('edit.currencies.eur')}</SelectItem>
                            <SelectItem value="CAD">{t('edit.currencies.cad')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-6">
                  <h3 className="text-lg font-medium">{t('edit.sections.contact')}</h3>
                  <Separator />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('edit.labels.email', { defaultValue: 'Email' })}</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder={t('edit.placeholders.email', { defaultValue: 'email@ejemplo.com' })}
                            {...field}
                          />
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
                        <FormLabel>{t('edit.labels.phone', { defaultValue: 'Teléfono' })}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('edit.placeholders.phone', { defaultValue: '+52 123 456 7890' })} {...field} />
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
                        <FormLabel>{t('edit.labels.website', { defaultValue: 'Sitio web' })}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t('edit.placeholders.website', { defaultValue: 'https://tusitio.com' })}
                            {...field}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="primaryColor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('edit.labels.primaryColor', { defaultValue: 'Color Primario' })}</FormLabel>
                        <FormControl>
                          <ColorPicker
                            placeholder={t('edit.placeholders.primaryColor', { defaultValue: '#FF5733' })}
                            value={field.value || ''}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="secondaryColor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('edit.labels.secondaryColor', { defaultValue: 'Color Secundario' })}</FormLabel>
                        <FormControl>
                          <ColorPicker
                            placeholder={t('edit.placeholders.secondaryColor', { defaultValue: '#33C4FF' })}
                            value={field.value || ''}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="latitude"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('edit.labels.latitude', { defaultValue: 'Latitud' })}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="any"
                              placeholder={t('edit.placeholders.latitude', { defaultValue: '19.432608' })}
                              {...field}
                              value={field.value ?? ''}
                              onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="longitude"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('edit.labels.longitude', { defaultValue: 'Longitud' })}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="any"
                              placeholder={t('edit.placeholders.longitude', { defaultValue: '-99.133209' })}
                              {...field}
                              value={field.value ?? ''}
                              onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Logo upload with crop */}
                  {canEdit ? (
                    <FormItem>
                      <FormLabel>{t('edit.labels.logo', { defaultValue: 'Logo' })}</FormLabel>
                      <FormControl>
                        <div className="pb-4">
                          {imageUrl ? (
                            <div className="flex flex-col items-center space-y-2">
                              <img src={imageUrl} alt={t('edit.logoAlt', { defaultValue: 'Logo' })} className="max-w-xs max-h-48 object-cover rounded-md" />
                              <Button type="button" variant="outline" onClick={handleFileRemove} disabled={uploading}>
                                {t('common.remove', { defaultValue: 'Quitar' })}
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
                                  {t('venues.addDialog.upload.cancel', { defaultValue: 'Cancelar' })}
                                </Button>
                                <Button type="button" onClick={handleCropConfirm} disabled={uploading}>
                                  {t('venues.addDialog.upload.confirm', { defaultValue: 'Confirmar' })}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Input
                              type="file"
                              onChange={e => handleFileUpload(e.target.files?.[0])}
                              className="block w-full p-2 text-sm border rounded-md"
                              disabled={uploading}
                            />
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  ) : (
                    <FormItem>
                      <FormLabel>{t('edit.labels.logo', { defaultValue: 'Logo' })}</FormLabel>
                      <div className="flex items-center gap-3">
                        {venue.logo ? (
                          <img
                            src={venue.logo}
                            alt={t('edit.logoAlt', { defaultValue: 'Logo' })}
                            className="h-16 w-16 object-cover rounded"
                          />
                        ) : (
                          <span className="text-sm text-muted-foreground">{t('edit.noLogo')}</span>
                        )}
                      </div>
                    </FormItem>
                  )}
                </div>
              </div>

              {/* Danger Zone Section */}
              <div className="space-y-6 mt-8">
                <Separator />
                <div className="rounded-lg border-2 border-destructive/50 bg-destructive/5 p-6">
                  <h3 className="text-lg font-medium text-destructive mb-2">
                    {t('edit.dangerZone.title', { defaultValue: 'Zona de Peligro' })}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t('edit.dangerZone.description', { defaultValue: 'Las acciones en esta sección son irreversibles. Procede con precaución.' })}
                  </p>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setShowDeleteDialog(true)}
                    disabled={!canEdit}
                  >
                    {t('edit.dangerZone.deleteButton', { defaultValue: 'Eliminar Local' })}
                  </Button>
                </div>
              </div>
            </fieldset>
          </form>
        </Form>
      </div>
    </>
  )
}
