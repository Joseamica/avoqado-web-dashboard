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
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/context/AuthContext'
import { StaffRole } from '@/types'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import countryList from 'react-select-country-list'
import { z } from 'zod'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useTranslation } from 'react-i18next'
// Image upload and crop support
import Cropper from 'react-easy-crop'
import { storage } from '@/firebase'
import { getDownloadURL, ref, uploadBytesResumable, deleteObject } from 'firebase/storage'
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

enum PosType {
  SOFTRESTAURANT = 'SOFTRESTAURANT',
  SQUARE = 'SQUARE',
  TOAST = 'TOAST',
  CLOVER = 'CLOVER',
  ALOHA = 'ALOHA',
  MICROS = 'MICROS',
  NCR = 'NCR',
  CUSTOM = 'CUSTOM',
  NONE = 'NONE',
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
  
  // POS Integration fields
  posType: z.nativeEnum(PosType).nullable().optional(),
  
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

      <div className="container mx-auto pt-6 pb-20 px-3 md:px-4 flex-grow overflow-auto">
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
  const { t } = useTranslation()
  const { venueId } = useCurrentVenue()
  const { user } = useAuth()
  const canEdit = [StaffRole.OWNER, StaffRole.ADMIN, StaffRole.SUPERADMIN].includes((user?.role as StaffRole) || ('' as any))

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
      posType: null,
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
        posType: (venue.posType as PosType) || null,
        latitude: venue.latitude ? Number(venue.latitude) : null,
        longitude: venue.longitude ? Number(venue.longitude) : null,
      })

    }
  }, [venue, form])

  // -------- Logo upload + crop --------
  const [uploading, setUploading] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [fileRef, setFileRef] = useState<any>(null)
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
          setFileRef(storageRef)
          setUploading(false)
          setImageForCrop(null)
          form.setValue('logo', downloadURL, { shouldDirty: true })
          toast({
            title: t('venues.edit.toast.logoUploadedTitle', { defaultValue: 'Logo actualizado' }),
            description: t('venues.edit.toast.logoUploadedDesc', { defaultValue: 'El logo se ha actualizado correctamente.' }),
          })
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
          form.setValue('logo', '', { shouldDirty: true })
          toast({
            title: t('venues.edit.toast.logoRemovedTitle', { defaultValue: 'Logo eliminado' }),
            description: t('venues.edit.toast.logoRemovedDesc', { defaultValue: 'El logo se ha eliminado correctamente.' }),
          })
        })
        .catch(error => {
          console.error('Error removing file:', error)
          toast({
            title: t('venues.edit.toast.logoErrorTitle', { defaultValue: 'Error con el logo' }),
            description: t('venues.edit.toast.logoErrorDesc', { defaultValue: 'No se pudo procesar la imagen del logo.' }),
            variant: 'destructive',
          })
        })
    } else {
      setImageUrl(null)
      form.setValue('logo', '', { shouldDirty: true })
    }
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

      // Add optional fields if they have values
      if (data.website) venueData.website = data.website
      if (data.logo) venueData.logo = data.logo
      if (data.primaryColor) venueData.primaryColor = data.primaryColor
      if (data.secondaryColor) venueData.secondaryColor = data.secondaryColor
      if (data.posType) venueData.posType = data.posType
      if (data.latitude !== null) venueData.latitude = data.latitude
      if (data.longitude !== null) venueData.longitude = data.longitude

      return await api.put(`/api/v1/dashboard/venues/${venueId}`, venueData)
    },
    onSuccess: () => {
      toast({
        title: t('venues.edit.toast.updateSuccess'),
        description: t('venues.edit.toast.updateSuccessDesc'),
      })
      queryClient.invalidateQueries({ queryKey: ['get-venue-data', venueId] })
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || t('venues.edit.toast.updateError')
      toast({
        title: t('venues.edit.toast.updateErrorTitle'),
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
        title: t('venues.edit.toast.deleteSuccess'),
        description: t('venues.edit.toast.deleteSuccessDesc'),
      })
      queryClient.invalidateQueries({ queryKey: ['status'] })
      queryClient.invalidateQueries({ queryKey: ['get-venue-data'] })
      navigate(from)
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || t('venues.edit.toast.deleteError')
      toast({
        title: t('venues.edit.toast.deleteErrorTitle'),
        description: errorMessage,
        variant: 'destructive',
      })
      console.error('Error deleting venue:', error)
    },
  })

  function onSubmit(formValues: VenueFormValues) {
    saveVenue.mutate(formValues)
  }

  if (isLoading) return <VenueSkeleton />
  
  if (!venue) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">{t('venues.edit.notFound')}</h2>
          <p className="text-muted-foreground mb-4">{t('venues.edit.notFoundDesc')}</p>
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
    <div className="flex flex-col min-h-screen bg-background">
      <div className="sticky top-0 z-20 flex flex-row justify-between w-full px-4 py-3 bg-background/95 border-b shadow-md backdrop-blur-sm">
        <div className="space-x-3 flex items-center">
          <Link to={from} className="flex items-center hover:text-primary">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <span className="font-medium truncate max-w-[200px] md:max-w-none">{venue.name}</span>
        </div>
        <div className="space-x-2 flex items-center">
          <Button
            variant="default"
            size="sm"
            className="px-3 md:px-4 whitespace-nowrap"
            disabled={!canEdit || !form.formState.isDirty || saveVenue.isPending}
            onClick={form.handleSubmit(onSubmit)}
          >
            {saveVenue.isPending ? t('common.saving') : t('common.save')}
          </Button>
          {canEdit && (
            <Button variant="destructive" size="sm" className="px-3 md:px-4" onClick={() => setShowDeleteDialog(true)}>
              {t('common.delete')}
            </Button>
          )}
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={handleDialogChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('venues.edit.deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('venues.edit.deleteDialog.description', { venueName: venue.name })}
            </AlertDialogDescription>
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

      <div className="container mx-auto pt-6 pb-20 px-3 md:px-4 flex-grow overflow-auto">
        <Form {...form}>
          {!canEdit && (
            <div className="mb-4 rounded-md border border-border bg-muted/40 text-muted-foreground text-sm px-3 py-2">
              {t('venues.edit.readOnly', { defaultValue: 'Modo solo lectura: no tienes permisos para editar la información del establecimiento.' })}
            </div>
          )}
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 md:space-y-8">
            <fieldset disabled={!canEdit} className={!canEdit ? 'opacity-80' : undefined}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-6">
                <h3 className="text-lg font-medium">{t('venues.edit.sections.basicInfo')}</h3>
                <Separator />

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('venues.edit.labels.name')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('venues.edit.placeholders.name')} {...field} />
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
                      <FormLabel>{t('venues.edit.labels.type')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('venues.edit.placeholders.type')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={VenueType.RESTAURANT}>{t('venues.edit.types.restaurant')}</SelectItem>
                          <SelectItem value={VenueType.BAR}>{t('venues.edit.types.bar')}</SelectItem>
                          <SelectItem value={VenueType.CAFE}>{t('venues.edit.types.cafe')}</SelectItem>
                          <SelectItem value={VenueType.FAST_FOOD}>{t('venues.edit.types.fastFood')}</SelectItem>
                          <SelectItem value={VenueType.FOOD_TRUCK}>{t('venues.edit.types.foodTruck')}</SelectItem>
                          <SelectItem value={VenueType.RETAIL_STORE}>{t('venues.edit.types.retailStore')}</SelectItem>
                          <SelectItem value={VenueType.HOTEL_RESTAURANT}>{t('venues.edit.types.hotelRestaurant')}</SelectItem>
                          <SelectItem value={VenueType.FITNESS_STUDIO}>{t('venues.edit.types.fitnessStudio')}</SelectItem>
                          <SelectItem value={VenueType.SPA}>{t('venues.edit.types.spa')}</SelectItem>
                          <SelectItem value={VenueType.OTHER}>{t('venues.edit.types.other')}</SelectItem>
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
                      <FormLabel>{t('venues.edit.labels.state')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('venues.edit.placeholders.state')} {...field} />
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
                      <FormLabel>{t('venues.edit.labels.zipCode')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('venues.edit.placeholders.zipCode')} {...field} />
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
                      <FormLabel>{t('venues.edit.labels.address')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('venues.edit.placeholders.address')} {...field} />
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
                        <FormLabel>{t('venues.edit.labels.city')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('venues.edit.placeholders.city')} {...field} />
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
                        <FormLabel>{t('venues.edit.labels.country')}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('venues.edit.placeholders.country')} />
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
                      <FormLabel>{t('venues.edit.labels.timezone', { defaultValue: 'Zona horaria' })}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('venues.edit.placeholders.timezone', { defaultValue: 'America/Mexico_City' })} {...field} />
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
                      <FormLabel>{t('venues.edit.labels.currency', { defaultValue: 'Moneda' })}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || 'MXN'}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('venues.edit.placeholders.currency', { defaultValue: 'Selecciona una moneda' })} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="MXN">{t('venues.edit.currencies.mxn')}</SelectItem>
                          <SelectItem value="USD">{t('venues.edit.currencies.usd')}</SelectItem>
                          <SelectItem value="EUR">{t('venues.edit.currencies.eur')}</SelectItem>
                          <SelectItem value="CAD">{t('venues.edit.currencies.cad')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-6">
                <h3 className="text-lg font-medium">{t('venues.edit.sections.contact', { defaultValue: 'Contacto e imágenes' })}</h3>
                <Separator />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('venues.edit.labels.email', { defaultValue: 'Email' })}</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder={t('venues.edit.placeholders.email', { defaultValue: 'email@ejemplo.com' })} {...field} />
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
                      <FormLabel>{t('venues.edit.labels.phone', { defaultValue: 'Teléfono' })}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('venues.edit.placeholders.phone', { defaultValue: '+52 123 456 7890' })} {...field} />
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
                      <FormLabel>{t('venues.edit.labels.website', { defaultValue: 'Sitio web' })}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('venues.edit.placeholders.website', { defaultValue: 'https://tusitio.com' })} {...field} value={field.value || ''} />
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
                      <FormLabel>{t('venues.edit.labels.primaryColor', { defaultValue: 'Color Primario' })}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('venues.edit.placeholders.primaryColor', { defaultValue: '#FF5733' })} {...field} value={field.value || ''} />
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
                      <FormLabel>{t('venues.edit.labels.secondaryColor', { defaultValue: 'Color Secundario' })}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('venues.edit.placeholders.secondaryColor', { defaultValue: '#33C4FF' })} {...field} value={field.value || ''} />
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
                        <FormLabel>{t('venues.edit.labels.latitude', { defaultValue: 'Latitud' })}</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="any" 
                            placeholder={t('venues.edit.placeholders.latitude', { defaultValue: '19.432608' })}
                            {...field} 
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
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
                        <FormLabel>{t('venues.edit.labels.longitude', { defaultValue: 'Longitud' })}</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="any" 
                            placeholder={t('venues.edit.placeholders.longitude', { defaultValue: '-99.133209' })}
                            {...field} 
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Logo upload with crop (optional URL fallback) */}
                {canEdit ? (
                  <FormItem>
                    <FormLabel>{t('venues.edit.labels.logo', { defaultValue: 'Logo' })}</FormLabel>
                    <FormControl>
                      <div className="space-y-3">
                        {imageUrl ? (
                          <div className="flex items-center gap-3">
                            <img src={imageUrl} alt={t('venues.edit.logoAlt', { defaultValue: 'Logo' })} className="h-16 w-16 object-cover rounded" />
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
                            <div className="flex justify-between mt-3">
                              <Button variant="outline" type="button" onClick={() => setImageForCrop(null)} disabled={uploading}>
                                {t('venues.addDialog.upload.cancel', { defaultValue: 'Cancelar' })}
                              </Button>
                              <Button type="button" onClick={handleCropConfirm} disabled={uploading}>
                                {t('venues.addDialog.upload.confirm', { defaultValue: 'Confirmar' })}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Input type="file" onChange={e => handleFileUpload(e.target.files?.[0])} disabled={uploading} />
                        )}
                        <Input
                          placeholder={t('venues.edit.placeholders.logo', { defaultValue: 'https://example.com/logo.jpg' })}
                          value={form.watch('logo') || ''}
                          onChange={e => form.setValue('logo', e.target.value, { shouldDirty: true })}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                ) : (
                  <FormItem>
                    <FormLabel>{t('venues.edit.labels.logo', { defaultValue: 'Logo' })}</FormLabel>
                    <div className="flex items-center gap-3">
                      {venue.logo ? (
                        <img src={venue.logo} alt={t('venues.edit.logoAlt', { defaultValue: 'Logo' })} className="h-16 w-16 object-cover rounded" />
                      ) : (
                        <span className="text-sm text-muted-foreground">{t('venues.edit.noLogo')}</span>
                      )}
                    </div>
                  </FormItem>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-lg font-medium">{t('venues.edit.sections.pos', { defaultValue: 'Integración con POS' })}</h3>
              <Separator />

              <FormField
                control={form.control}
                name="posType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('venues.edit.labels.posType', { defaultValue: 'Sistema POS' })}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('venues.edit.placeholders.posType')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={PosType.SOFTRESTAURANT}>{t('venues.edit.posTypes.softRestaurant')}</SelectItem>
                        <SelectItem value={PosType.SQUARE}>{t('venues.edit.posTypes.square')}</SelectItem>
                        <SelectItem value={PosType.TOAST}>{t('venues.edit.posTypes.toast')}</SelectItem>
                        <SelectItem value={PosType.CLOVER}>{t('venues.edit.posTypes.clover')}</SelectItem>
                        <SelectItem value={PosType.ALOHA}>{t('venues.edit.posTypes.aloha')}</SelectItem>
                        <SelectItem value={PosType.MICROS}>{t('venues.edit.posTypes.micros')}</SelectItem>
                        <SelectItem value={PosType.NCR}>{t('venues.edit.posTypes.ncr')}</SelectItem>
                        <SelectItem value={PosType.CUSTOM}>{t('venues.edit.posTypes.custom')}</SelectItem>
                        <SelectItem value={PosType.NONE}>{t('venues.edit.posTypes.none')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            </fieldset>

          </form>
        </Form>
      </div>
    </div>
  )
}
